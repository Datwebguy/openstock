import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import {
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  deriveDbcPoolAddress,
  deriveDammV2PoolAddress,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

const DEFAULT_RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * PoolConfig per xStock quote mint. The quote mint is fixed on each config account, so every stock needs its own.
 * Lookup order: METEORA_DBC_CONFIG_BY_MINT JSON map, then METEORA_DBC_CONFIG_<SYMBOL> (e.g. METEORA_DBC_CONFIG_NVDAX).
 * There is no global fallback — reusing one stock's config for another would fail on-chain.
 */
export function resolveDbcConfigAddress(opts: { quoteMint: string; pairedStockSymbol?: string | null }): string | null {
  const mapRaw = process.env.METEORA_DBC_CONFIG_BY_MINT?.trim();
  if (mapRaw) {
    try {
      const hit = (JSON.parse(mapRaw) as Record<string, string>)[opts.quoteMint.trim()];
      if (typeof hit === "string" && isValidPubkey(hit)) return hit;
    } catch {
      console.error("METEORA_DBC_CONFIG_BY_MINT is not valid JSON");
    }
  }
  const symbolKey = (opts.pairedStockSymbol || "").replace(/[^a-zA-Z0-9]/g, "");
  if (!symbolKey) return null;
  for (const key of [symbolKey, symbolKey.toUpperCase()]) {
    const bySymbol = process.env[`METEORA_DBC_CONFIG_${key}`]?.trim();
    if (bySymbol && isValidPubkey(bySymbol)) return bySymbol;
  }
  return null;
}

function isValidPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return value.length >= 32;
  } catch {
    return false;
  }
}

export type DbcConfigSummary = {
  configAddress: string;
  quoteMint: string;
  quoteDecimals: number;
  /** Quote (xStock) amount that must be raised before the pool migrates. */
  migrationThresholdUi: number;
  /** Base fee on the curve, in bps. */
  baseFeeBps: number;
  dynamicFee: boolean;
  /** Share of trading fees that goes to the pool creator; the rest goes to feeClaimer. */
  creatorTradingFeePercent: number;
  feeClaimer: string;
  migrationTarget: "DAMM v1" | "DAMM v2" | "unknown";
};

const configSummaryCache = new Map<string, { at: number; value: DbcConfigSummary }>();

/** Reads the PoolConfig account from mainnet so the UI shows what the chain will actually enforce. */
export async function readDbcConfigSummary(configAddress: string): Promise<DbcConfigSummary | null> {
  const cached = configSummaryCache.get(configAddress);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value;
  try {
    const connection = new Connection(DEFAULT_RPC, "confirmed");
    const client = DynamicBondingCurveClient.create(connection, "confirmed");
    const config = await client.state.getPoolConfig(configAddress);
    if (!config) return null;
    const supply = await connection.getTokenSupply(config.quoteMint);
    const quoteDecimals = supply.value.decimals;
    const cliffNumerator = Number(config.poolFees.baseFee.cliffFeeNumerator.toString());
    const value: DbcConfigSummary = {
      configAddress,
      quoteMint: config.quoteMint.toBase58(),
      quoteDecimals,
      migrationThresholdUi: Number(config.migrationQuoteThreshold.toString()) / 10 ** quoteDecimals,
      baseFeeBps: Math.round((cliffNumerator / 1_000_000_000) * 10_000),
      dynamicFee: Boolean(config.poolFees.dynamicFee?.initialized),
      creatorTradingFeePercent: Number(config.creatorTradingFeePercentage),
      feeClaimer: config.feeClaimer.toBase58(),
      migrationTarget: config.migrationOption === 1 ? "DAMM v2" : config.migrationOption === 0 ? "DAMM v1" : "unknown",
    };
    configSummaryCache.set(configAddress, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn("Could not read DBC PoolConfig", configAddress, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Public links for a DBC pool / mint. Meteora has no DLMM page for DBC pools, so link the chain explorer. */
export function dbcLinks(poolAddress: string, mintAddress: string, txSignature?: string) {
  return {
    poolUrl: `https://solscan.io/account/${poolAddress}`,
    tokenUrl: `https://solscan.io/token/${mintAddress}`,
    txUrl: txSignature ? `https://solscan.io/tx/${txSignature}` : `https://solscan.io/token/${mintAddress}`,
  };
}

/** The SDK types the account as `{ poolState }`, older builds decode it flat — accept both. */
function poolStateOf(account: unknown): { config: PublicKey; creator: PublicKey; baseMint: PublicKey } {
  const raw = account as { poolState?: unknown };
  return (raw.poolState ?? raw) as { config: PublicKey; creator: PublicKey; baseMint: PublicKey };
}

export { SOL_MINT, USDC_MINT } from "./solana";

// In-memory cache for token badge existence check
const tokenBadgeCache = new Map<string, boolean>();

/**
 * Checks whether an xStock quote mint has an on-chain token badge PDA on Solana Mainnet.
 * In Meteora DBC, Token-2022 quote tokens require an on-chain Token Badge:
 * PDA: ["token_badge", quoteMint] with DYNAMIC_BONDING_CURVE_PROGRAM_ID.
 *
 * OpenStock only launches against tokenized stocks. SOL and USDC are not quote assets.
 * Token-2022 xStocks without an initialized on-chain badge account return false.
 * We never invent or mock a badge.
 */
export async function checkMeteoraDbcBadgeSupport(quoteMint: string): Promise<boolean> {

  const cached = tokenBadgeCache.get(quoteMint);
  if (cached !== undefined) return cached;

  try {
    const mintPubkey = new PublicKey(quoteMint);
    const [tokenBadge] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_badge"), mintPubkey.toBuffer()],
      DYNAMIC_BONDING_CURVE_PROGRAM_ID
    );

    const connection = new Connection(DEFAULT_RPC, "confirmed");
    const accountInfo = await connection.getAccountInfo(tokenBadge);
    const supported = accountInfo !== null;

    tokenBadgeCache.set(quoteMint, supported);
    return supported;
  } catch (err) {
    console.warn(`Error querying on-chain Meteora DBC token badge for ${quoteMint}:`, err);
    tokenBadgeCache.set(quoteMint, false);
    return false;
  }
}

export type MeteoraDbcLaunchPayload = {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  quoteMint: string;
  creatorWallet: string;
  creatorFeeBps: number;
  supply: number;
  /** Underlying xStock ticker (NVDAx / AAPLx) for per-stock PoolConfig lookup. */
  pairedStockSymbol?: string;
  /** Metaplex-style JSON metadata URL (≤200 chars) — must point at JSON, not the image. */
  metadataUri: string;
};

export type PreparedDbcLaunch = {
  transactionBase64: string;
  mintAddress: string;
  poolAddress: string;
  quoteMint: string;
  explorerUrl: string;
  poolUrl: string;
};

export type MeteoraDbcLaunchResult = {
  success: boolean;
  poolAddress: string;
  mintAddress: string;
  txHash: string;
  explorerUrl: string;
  poolUrl: string;
};

/**
 * Derives the anticipated Meteora DBC pool address for a pair
 */
export function getMeteoraDbcPoolAddress(quoteMint: string, baseMint: string, config?: string): string {
  try {
    if (!config) return "";
    const poolConfig = new PublicKey(config);
    const poolPubkey = deriveDbcPoolAddress(
      new PublicKey(quoteMint),
      new PublicKey(baseMint),
      poolConfig
    );
    return poolPubkey.toBase58();
  } catch {
    return "";
  }
}

/**
 * Prepares the authentic Meteora DBC initializeVirtualPoolWithSplToken transaction.
 * Generates the baseMint keypair, builds the instruction targeting the on-chain DBC program,
 * partially signs with baseMint, and returns the serialized transaction for the user's wallet.
 */
export async function prepareMeteoraDbcPoolTx(
  payload: MeteoraDbcLaunchPayload,
  /** Persists metadata for the freshly generated mint and returns its public JSON URI. */
  writeMetadata?: (mintAddress: string) => Promise<string>
): Promise<PreparedDbcLaunch> {
  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const payer = new PublicKey(payload.creatorWallet);
  const creator = payer;
  const quoteMint = new PublicKey(payload.quoteMint);
  const configAddress = resolveDbcConfigAddress({
    quoteMint: payload.quoteMint,
    pairedStockSymbol: payload.pairedStockSymbol,
  });
  if (!configAddress) {
    throw new Error(`Meteora DBC is not configured for ${payload.pairedStockSymbol ?? "this stock"}. Launch on Pump.fun instead.`);
  }
  const config = new PublicKey(configAddress);

  // Generate deterministic keypair for the newly minted token
  const baseMintKeypair = Keypair.generate();
  const baseMint = baseMintKeypair.publicKey;
  const metadataUri = writeMetadata ? await writeMetadata(baseMint.toBase58()) : payload.metadataUri;
  if (!metadataUri || metadataUri.length > 200) throw new Error("Token metadata URL is missing or too long.");

  const pool = deriveDbcPoolAddress(quoteMint, baseMint, config);

  // Check for TokenBadge if quote token is Token-2022
  let tokenBadgeRemainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
  try {
    const [tokenBadge] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_badge"), quoteMint.toBuffer()],
      DYNAMIC_BONDING_CURVE_PROGRAM_ID
    );
    const badgeAccount = await connection.getAccountInfo(tokenBadge);
    if (badgeAccount !== null) {
      tokenBadgeRemainingAccounts = [{ pubkey: tokenBadge, isSigner: false, isWritable: false }];
    }
  } catch {
    // Standard SPL Token quotes do not need token badge
  }

  // Official SDK builder: it resolves the quote token program (xStocks are Token-2022) from the config.
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const tx: Transaction = await client.creator.createPool({
    name: payload.name.slice(0, 32),
    symbol: payload.symbol.slice(0, 10),
    uri: metadataUri,
    payer,
    poolCreator: creator,
    config,
    baseMint,
    tokenBadge: tokenBadgeRemainingAccounts[0]?.pubkey,
  });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  // Partially sign with the baseMint keypair so client only needs to sign as payer
  tx.partialSign(baseMintKeypair);

  const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
  const poolAddress = pool.toBase58();
  const mintAddress = baseMint.toBase58();

  return {
    transactionBase64: serialized,
    mintAddress,
    poolAddress,
    quoteMint: payload.quoteMint,
    explorerUrl: dbcLinks(poolAddress, mintAddress).tokenUrl,
    poolUrl: dbcLinks(poolAddress, mintAddress).poolUrl,
  };
}

/**
 * Prepares the DBC → DAMM v2 migration using the SDK's own builder (handles Token-2022 xStock quotes).
 */
export async function prepareMeteoraDammMigrationTx(
  poolAddress: string,
  payerWallet: string,
  targetDammConfig?: string
): Promise<{ transactionBase64: string; dammPoolAddress: string }> {
  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const pool = new PublicKey(poolAddress);
  const payer = new PublicKey(payerWallet);

  const poolAccount = await client.state.getPool(pool);
  if (!poolAccount) throw new Error(`Meteora DBC pool ${poolAddress} not found on Solana.`);

  const dammConfigKey = targetDammConfig || process.env.METEORA_DAMM_V2_CONFIG;
  if (!dammConfigKey) throw new Error("Migration is not configured on this deployment (METEORA_DAMM_V2_CONFIG).");
  const dammConfig = new PublicKey(dammConfigKey);

  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } = await client.migration.migrateToDammV2({
    payer,
    pool,
    dammConfig,
  });
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;
  transaction.partialSign(firstPositionNftKeypair, secondPositionNftKeypair);

  const state = poolStateOf(poolAccount);
  const config = await client.state.getPoolConfig(state.config);
  if (!config) throw new Error("DBC PoolConfig for this pool was not found.");
  return {
    transactionBase64: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
    dammPoolAddress: deriveDammV2PoolAddress(dammConfig, state.baseMint, config.quoteMint).toBase58(),
  };
}

/**
 * Queries live on-chain curve progress directly from Meteora DBC program.
 */
export async function queryOnChainDbcProgress(poolAddress: string): Promise<number | null> {
  try {
    const connection = new Connection(DEFAULT_RPC, "confirmed");
    const client = DynamicBondingCurveClient.create(connection, "confirmed");
    const progress = await client.state.getPoolQuoteTokenCurveProgress(new PublicKey(poolAddress));
    if (typeof progress === "number") {
      return progress;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Prepares and confirms a Meteora DBC launch directly with the user's wallet.
 */
export async function executeMeteoraDbcLaunch(
  payload: MeteoraDbcLaunchPayload,
  userSignature: string,
  mintAddress: string,
  poolAddress: string
): Promise<MeteoraDbcLaunchResult> {
  const configAddress = resolveDbcConfigAddress({ quoteMint: payload.quoteMint, pairedStockSymbol: payload.pairedStockSymbol });
  if (!configAddress) throw new Error("Meteora DBC is not configured for this stock.");
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(userSignature)) throw new Error("A valid transaction signature is required.");

  // The pool address must be the one derived from (quote, mint, config) — a client cannot register an arbitrary pool.
  const expectedPool = deriveDbcPoolAddress(new PublicKey(payload.quoteMint), new PublicKey(mintAddress), new PublicKey(configAddress)).toBase58();
  if (expectedPool !== poolAddress) throw new Error("Pool address does not match this token and stock.");

  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const status = await connection.getSignatureStatus(userSignature, { searchTransactionHistory: true });
  if (!status.value || status.value.err || !status.value.confirmationStatus) {
    throw new Error("The pool transaction is not confirmed on Solana yet.");
  }
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const poolAccount = await client.state.getPool(poolAddress);
  const pool = poolAccount ? poolStateOf(poolAccount) : null;
  if (!pool || pool.baseMint.toBase58() !== mintAddress || pool.creator.toBase58() !== payload.creatorWallet) {
    throw new Error("The DBC pool was not found on Solana for this wallet.");
  }

  const links = dbcLinks(poolAddress, mintAddress, userSignature);
  return {
    success: true,
    poolAddress,
    mintAddress,
    txHash: userSignature,
    explorerUrl: links.txUrl,
    poolUrl: links.poolUrl,
  };
}

export type CreatorPoolFeeSnapshot = {
  poolAddress: string;
  creatorBaseFeeRaw: string;
  creatorQuoteFeeRaw: string;
  unclaimedBaseFeeRaw: string;
  unclaimedQuoteFeeRaw: string;
};

/**
 * Read creator fee balances for pools owned by this wallet (quote side = xStock when stock-paired).
 */
export async function getCreatorPoolFees(creatorWallet: string): Promise<CreatorPoolFeeSnapshot[]> {
  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const pools = await client.state.getPoolsFeesByCreator(new PublicKey(creatorWallet));
  const snapshots: CreatorPoolFeeSnapshot[] = [];

  for (const pool of pools) {
    let unclaimedBase = pool.creatorBaseFee?.toString?.() ?? "0";
    let unclaimedQuote = pool.creatorQuoteFee?.toString?.() ?? "0";
    try {
      const breakdown = await client.state.getPoolFeeBreakdown(pool.poolAddress);
      unclaimedBase = breakdown.creator.unclaimedBaseFee.toString();
      unclaimedQuote = breakdown.creator.unclaimedQuoteFee.toString();
    } catch {
      /* fall back to getPoolsFeesByCreator totals */
    }
    snapshots.push({
      poolAddress: pool.poolAddress.toBase58(),
      creatorBaseFeeRaw: pool.creatorBaseFee?.toString?.() ?? "0",
      creatorQuoteFeeRaw: pool.creatorQuoteFee?.toString?.() ?? "0",
      unclaimedBaseFeeRaw: unclaimedBase,
      unclaimedQuoteFeeRaw: unclaimedQuote,
    });
  }

  return snapshots;
}

/**
 * Prepare an unsigned claimCreatorTradingFee transaction for the pool creator.
 * Fees settle in base + quote (xStock quote for stock-paired DBC pools).
 */
export async function prepareClaimCreatorTradingFeeTx(params: {
  poolAddress: string;
  creatorWallet: string;
  maxBaseAmount?: string;
  maxQuoteAmount?: string;
}): Promise<{ transactionBase64: string; poolAddress: string }> {
  const { BN } = await import("@coral-xyz/anchor");
  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const creator = new PublicKey(params.creatorWallet);
  const pool = new PublicKey(params.poolAddress);

  const maxBaseAmount = new BN(params.maxBaseAmount ?? "18446744073709551615");
  const maxQuoteAmount = new BN(params.maxQuoteAmount ?? "18446744073709551615");

  const tx = await client.creator.claimCreatorTradingFee({
    creator,
    payer: creator,
    pool,
    maxBaseAmount,
    maxQuoteAmount,
    receiver: creator,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = creator;

  return {
    transactionBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    poolAddress: params.poolAddress,
  };
}
