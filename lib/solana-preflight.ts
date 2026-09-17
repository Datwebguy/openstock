import {
  Connection,
  Transaction,
  VersionedTransaction,
  ComputeBudgetProgram,
  PublicKey,
  type SimulatedTransactionResponse,
} from "@solana/web3.js";

export type PriorityFeeTier = "low" | "standard" | "fast" | "turbo";

export interface PriorityFeeConfig {
  tier: PriorityFeeTier;
  microLamports: number;
  computeUnits: number;
}

export interface SimulationResult {
  success: boolean;
  unitsConsumed?: number;
  logs?: string[];
  error?: string;
  humanMessage?: string;
}

export interface HardenedExecutionResult {
  signature: string;
  unitsConsumed?: number;
  priorityFeeMicroLamports: number;
  confirmedSlot?: number;
}

// Fallback prioritization fees (in micro-lamports per CU)
const DEFAULT_PRIORITY_FEES: Record<PriorityFeeTier, number> = {
  low: 10_000,       // 0.00001 SOL per 1M CU
  standard: 50_000,  // 0.00005 SOL per 1M CU
  fast: 150_000,     // 0.00015 SOL per 1M CU
  turbo: 500_000,    // 0.00050 SOL per 1M CU
};

/**
 * Translates low-level Solana RPC & Wallet error payloads into friendly, actionable human messages.
 */
export function translateWalletError(error: unknown): string {
  if (!error) return "An unknown transaction error occurred.";

  const message = typeof error === "string" ? error : (error as Error).message || "";
  const code = (error as { code?: number | string })?.code;

  // Wallet user rejection
  if (
    code === 4001 ||
    code === "4001" ||
    /user rejected/i.test(message) ||
    /transaction cancelled/i.test(message) ||
    /declined/i.test(message)
  ) {
    return "Transaction cancelled by user in wallet.";
  }

  // Insufficient SOL / Lamports
  if (
    /insufficient lamports/i.test(message) ||
    /insufficient funds/i.test(message) ||
    /Attempt to debit an account but found no record of a prior credit/i.test(message)
  ) {
    return "Insufficient SOL in your wallet to cover rent exemption and network priority fees.";
  }

  // Blockhash expiry / Network latency
  if (
    /blockhash not found/i.test(message) ||
    /blockhash expired/i.test(message) ||
    /Transaction was not confirmed in/i.test(message)
  ) {
    return "Transaction timed out due to Solana network congestion. Priority fee has been calibrated; please retry.";
  }

  // Slippage tolerance exceeded
  if (/slippage/i.test(message) || /exceeded max/i.test(message) || /custom program error: 0x1771/i.test(message)) {
    return "Market price moved beyond slippage tolerance during execution. Please increase slippage slightly and retry.";
  }

  // Rate limits
  if (/429/i.test(message) || /too many requests/i.test(message)) {
    return "Solana RPC node rate limit encountered. Backing off automatically...";
  }

  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

/**
 * Dynamically queries recent prioritization fees from the Solana mainnet cluster
 * and returns recommended micro-lamports for the requested tier.
 */
export async function getDynamicPriorityFee(
  connection: Connection,
  tier: PriorityFeeTier = "standard"
): Promise<number> {
  try {
    const recentFees = await connection.getRecentPrioritizationFees().catch(() => []);
    if (!recentFees || recentFees.length === 0) {
      return DEFAULT_PRIORITY_FEES[tier];
    }

    // Sort ascending by prioritizationFee
    const fees = recentFees
      .map((f) => f.prioritizationFee)
      .filter((fee) => fee > 0)
      .sort((a, b) => a - b);

    if (fees.length === 0) {
      return DEFAULT_PRIORITY_FEES[tier];
    }

    const len = fees.length;
    let selectedFee: number;

    switch (tier) {
      case "low":
        selectedFee = fees[Math.floor(len * 0.25)];
        break;
      case "standard":
        selectedFee = fees[Math.floor(len * 0.5)];
        break;
      case "fast":
        selectedFee = fees[Math.floor(len * 0.75)];
        break;
      case "turbo":
        selectedFee = fees[Math.floor(len * 0.95)];
        break;
      default:
        selectedFee = fees[Math.floor(len * 0.5)];
    }

    // Bound between minimum reasonable fee and maximum reasonable cap
    const minCap = DEFAULT_PRIORITY_FEES[tier];
    const maxCap = 2_500_000; // max 0.0025 SOL per 1M CU safety ceiling
    return Math.min(Math.max(selectedFee, minCap), maxCap);
  } catch (err) {
    console.warn("Could not query dynamic priority fees, using fallback:", err);
    return DEFAULT_PRIORITY_FEES[tier];
  }
}

/**
 * Prepends ComputeBudgetProgram instructions to a legacy Transaction:
 * 1. Compute Unit Limit (e.g. 200,000 CU)
 * 2. Compute Unit Price (priority fee in micro-lamports)
 */
export function applyComputeBudget(
  transaction: Transaction,
  units: number = 200_000,
  microLamports: number = 50_000
): Transaction {
  const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units,
  });
  const cuPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports,
  });

  // Prepend at index 0 and 1 so they are processed before instruction logic
  transaction.instructions.unshift(cuPriceIx);
  transaction.instructions.unshift(cuLimitIx);
  return transaction;
}

/**
 * Preflight simulation runner.
 * Simulates the transaction against the Solana validator cluster without committing.
 * Identifies insufficient balance, instruction failures, or custom program errors prior to wallet signature prompts.
 */
export async function preflightSimulate(
  connection: Connection,
  transaction: Transaction,
  feePayer: PublicKey
): Promise<SimulationResult> {
  try {
    // Clone transaction to avoid mutating caller reference
    const clone = new Transaction();
    clone.recentBlockhash = transaction.recentBlockhash;
    clone.feePayer = feePayer;
    clone.add(...transaction.instructions);

    if (!clone.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      clone.recentBlockhash = blockhash;
    }

    const simResponse: { value: SimulatedTransactionResponse } = await connection.simulateTransaction(clone, undefined, true);
    const value = simResponse.value;

    if (value.err) {
      const errStr = typeof value.err === "string" ? value.err : JSON.stringify(value.err);
      return {
        success: false,
        unitsConsumed: value.unitsConsumed,
        logs: value.logs ?? undefined,
        error: errStr,
        humanMessage: translateWalletError(errStr),
      };
    }

    return {
      success: true,
      unitsConsumed: value.unitsConsumed,
      logs: value.logs ?? undefined,
    };
  } catch (simErr: unknown) {
    const message = simErr instanceof Error ? simErr.message : String(simErr);
    return {
      success: false,
      error: message,
      humanMessage: translateWalletError(simErr),
    };
  }
}

/**
 * End-to-end hardened execution pipeline:
 * 1. Obtains dynamic priority fee from cluster
 * 2. Injects ComputeBudget instructions
 * 3. Simulates transaction preflight
 * 4. Requests wallet signature
 * 5. Broadcasts raw transaction and awaits cluster confirmation
 */
export async function executeHardenedTransaction(params: {
  connection: Connection;
  transaction: Transaction;
  payerPubkey: PublicKey;
  solanaProvider: {
    signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>;
    signTransaction?: (tx: Transaction) => Promise<Transaction>;
  };
  tier?: PriorityFeeTier;
  estimatedUnits?: number;
  skipSimulation?: boolean;
  onStatus?: (msg: string) => void;
}): Promise<HardenedExecutionResult> {
  const {
    connection,
    transaction,
    payerPubkey,
    solanaProvider,
    tier = "standard",
    estimatedUnits = 180_000,
    skipSimulation = false,
    onStatus = () => {},
  } = params;

  onStatus("Estimating network congestion and priority fees...");
  const microLamports = await getDynamicPriorityFee(connection, tier);

  // Apply compute budget instructions
  applyComputeBudget(transaction, estimatedUnits, microLamports);

  onStatus("Fetching latest blockhash...");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPubkey;

  // Preflight validation simulation
  if (!skipSimulation) {
    onStatus("Validating preflight simulation on Solana mainnet...");
    const sim = await preflightSimulate(connection, transaction, payerPubkey);
    if (!sim.success) {
      throw new Error(sim.humanMessage || sim.error || "Preflight simulation failed.");
    }
  }

  onStatus("Please approve transaction in your wallet...");
  let signature = "";

  if (solanaProvider.signAndSendTransaction) {
    const res = await solanaProvider.signAndSendTransaction(transaction);
    signature = res.signature;
  } else if (solanaProvider.signTransaction) {
    const signed = await solanaProvider.signTransaction(transaction);
    onStatus("Broadcasting transaction to Solana cluster...");
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true, // We already verified simulation
      maxRetries: 3,
    });
  } else {
    throw new Error("Connected wallet does not provide transaction signing capabilities.");
  }

  onStatus("Confirming block inclusion on Solana mainnet...");
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    const errMsg = JSON.stringify(confirmation.value.err);
    throw new Error(translateWalletError(errMsg));
  }

  return {
    signature,
    priorityFeeMicroLamports: microLamports,
    confirmedSlot: confirmation.context.slot,
  };
}
