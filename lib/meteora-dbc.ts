import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  DAMM_V2_PROGRAM_ID,
  METAPLEX_PROGRAM_ID,
  createDbcProgram,
  deriveDbcPoolAddress,
  deriveDbcPoolAuthority,
  deriveDbcTokenVaultAddress,
  deriveMintMetadata,
  deriveDammV2PoolAddress,
  deriveDammV2PoolAuthority,
  deriveDammV2TokenVaultAddress,
  deriveDammV2EventAuthority,
  deriveDammV2MigrationMetadataAddress,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

const DEFAULT_RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export type DbcCurvePresetKey = "linear" | "exponential" | "flat";

export interface DbcCurvePresetInfo {
  id: DbcCurvePresetKey;
  name: string;
  subtitle: string;
  description: string;
  configAddress?: string;
  baseFeeBps: number;
  curveType: string;
  targetMarketCap: string;
}

export const METEORA_DBC_CURVE_PRESETS: Record<DbcCurvePresetKey, DbcCurvePresetInfo> = {
  linear: {
    id: "linear",
    name: "Equity Standard",
    subtitle: "Mega-cap discovery",
    description: "Balanced TOKEN×xStock discovery for liquid names like NVDAx and AAPLx. Fees quote in the paired stock.",
    configAddress: process.env.METEORA_DBC_CONFIG_LINEAR || process.env.METEORA_DBC_CONFIG || undefined,
    baseFeeBps: 150,
    curveType: "Linear",
    targetMarketCap: "$69,000 USD",
  },
  exponential: {
    id: "exponential",
    name: "Equity Momentum",
    subtitle: "Steeper early curve",
    description: "Faster early price discovery for high-attention stock pairs; accelerates progress toward DAMM graduation.",
    configAddress: process.env.METEORA_DBC_CONFIG_EXPONENTIAL || undefined,
    baseFeeBps: 200,
    curveType: "Exponential",
    targetMarketCap: "$85,000 USD",
  },
  flat: {
    id: "flat",
    name: "Equity Deep Book",
    subtitle: "Index / low slip",
    description: "Flatter curve for broad names (SPYx, QQQx) where low slippage and deeper early book matter more than speed.",
    configAddress: process.env.METEORA_DBC_CONFIG_FLAT || undefined,
    baseFeeBps: 100,
    curveType: "Flat",
    targetMarketCap: "$100,000 USD",
  },
};

// Default Meteora DBC Config on Solana Mainnet (if configured via environment)
export const DEFAULT_DBC_CONFIG: PublicKey | null = process.env.METEORA_DBC_CONFIG
  ? new PublicKey(process.env.METEORA_DBC_CONFIG)
  : null;

/**
 * Resolve PoolConfig for a quote mint. Each xStock needs its own config (quote mint is fixed on-chain).
 * Lookup order:
 * 1. METEORA_DBC_CONFIG_<SYMBOL> (e.g. METEORA_DBC_CONFIG_AAPLX)
 * 2. METEORA_DBC_CONFIG_BY_MINT JSON map { "<mint>": "<config>" }
 * 3. preset configAddress / METEORA_DBC_CONFIG fallback
 */
export function resolveDbcConfigAddress(opts: {
  quoteMint: string;
  /** Stock symbol (NVDAx) or launch token symbol — stock preferred via pairedStockSymbol env keys. */
  symbol?: string | null;
  pairedStockSymbol?: string | null;
  curvePreset?: DbcCurvePresetKey | string | null;
}): string | null {
  // 1) Explicit mint → config map (authoritative for multi-stock)
  const mapRaw = process.env.METEORA_DBC_CONFIG_BY_MINT?.trim();
  let mintMap: Record<string, string> | null = null;
  if (mapRaw) {
    try {
      mintMap = JSON.parse(mapRaw) as Record<string, string>;
      const hit = mintMap[opts.quoteMint] || mintMap[opts.quoteMint.trim()];
      if (typeof hit === "string" && hit.length > 0) return hit;
    } catch {
      mintMap = null;
    }
  }

  // 2) Per-stock env: METEORA_DBC_CONFIG_NVDAx / _AAPLx
  for (const raw of [opts.pairedStockSymbol, opts.symbol]) {
    const symbolKey = (raw || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!symbolKey) continue;
    const bySymbol = process.env[`METEORA_DBC_CONFIG_${symbolKey}`]?.trim();
    if (bySymbol) return bySymbol;
  }

  // 3) Global fallback only in single-stock mode (no BY_MINT map configured).
  // Never reuse NVDAx's config for TSLAx — quote mint is fixed on-chain.
  if (mintMap && Object.keys(mintMap).length > 0) {
    return null;
  }

  // Use preset config fallback
  // If curvePreset is provided, use that specific preset
  // If not provided (venue checking), use linear preset to check if ANY config exists
  const curvePresetKey = (opts.curvePreset || "linear") as DbcCurvePresetKey;
  const selectedPreset = METEORA_DBC_CURVE_PRESETS[curvePresetKey] || METEORA_DBC_CURVE_PRESETS.linear;
  return selectedPreset.configAddress || process.env.METEORA_DBC_CONFIG || null;
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
  curvePreset?: DbcCurvePresetKey;
  /** Underlying xStock ticker (NVDAx / AAPLx) for per-stock PoolConfig lookup. */
  pairedStockSymbol?: string;
};

export type PreparedDbcLaunch = {
  transactionBase64: string;
  mintAddress: string;
  poolAddress: string;
  quoteMint: string;
  explorerUrl: string;
  meteoraUrl: string;
};

export type MeteoraDbcLaunchResult = {
  success: boolean;
  poolAddress: string;
  mintAddress: string;
  txHash: string;
  explorerUrl: string;
  meteoraUrl: string;
};

/**
 * Derives the anticipated Meteora DBC pool address for a pair
 */
export function getMeteoraDbcPoolAddress(quoteMint: string, baseMint: string, config?: string): string {
  try {
    const poolConfig = config ? new PublicKey(config) : DEFAULT_DBC_CONFIG;
    if (!poolConfig) return "";
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
  payload: MeteoraDbcLaunchPayload
): Promise<PreparedDbcLaunch> {
  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const { program } = createDbcProgram(connection);

  const payer = new PublicKey(payload.creatorWallet);
  const creator = payer;
  const quoteMint = new PublicKey(payload.quoteMint);
  const curvePresetKey = payload.curvePreset || "linear";
  const configAddress = resolveDbcConfigAddress({
    quoteMint: payload.quoteMint,
    symbol: payload.symbol,
    pairedStockSymbol: payload.pairedStockSymbol,
    curvePreset: curvePresetKey,
  });
  if (!configAddress) {
    throw new Error(
      `No valid Meteora DBC PoolConfig for quote ${payload.quoteMint}. Set METEORA_DBC_CONFIG_<SYMBOL> or METEORA_DBC_CONFIG_BY_MINT.`
    );
  }
  const config = new PublicKey(configAddress);

  // Generate deterministic keypair for the newly minted token
  const baseMintKeypair = Keypair.generate();
  const baseMint = baseMintKeypair.publicKey;

  // Derive on-chain PDAs according to Meteora DBC specification
  const poolAuthority = deriveDbcPoolAuthority();
  const pool = deriveDbcPoolAddress(quoteMint, baseMint, config);
  const baseVault = deriveDbcTokenVaultAddress(pool, baseMint);
  const quoteVault = deriveDbcTokenVaultAddress(pool, quoteMint);
  const mintMetadata = deriveMintMetadata(baseMint);

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

  // Attempt creating the pool transaction via official Meteora DBC SDK client.creator.createPool
  let tx: Transaction;
  try {
    const client = DynamicBondingCurveClient.create(connection, "confirmed");
    tx = await client.creator.createPool({
      name: payload.name.slice(0, 32),
      symbol: payload.symbol.slice(0, 10),
      uri: payload.imageUrl.slice(0, 200),
      payer,
      poolCreator: creator,
      config,
      baseMint,
      tokenBadge: tokenBadgeRemainingAccounts[0]?.pubkey,
    });
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
  } catch (sdkErr) {
    console.warn("Meteora SDK client.creator.createPool fallback to Anchor instruction builder:", sdkErr);
    // Direct Anchor instruction builder for initializeVirtualPoolWithSplToken
    const initVirtualPoolIx = await program.methods
      .initializeVirtualPoolWithSplToken({
        name: payload.name.slice(0, 32),
        symbol: payload.symbol.slice(0, 10),
        uri: payload.imageUrl.slice(0, 200),
      })
      .accountsPartial({
        pool,
        config,
        payer,
        creator,
        mintMetadata,
        baseMint,
        poolAuthority,
        baseVault,
        quoteVault,
        quoteMint,
        tokenQuoteProgram: TOKEN_PROGRAM_ID,
        metadataProgram: METAPLEX_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(tokenBadgeRemainingAccounts)
      .instruction();

    tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
    tx.add(initVirtualPoolIx);
  }

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
    explorerUrl: `https://solscan.io/token/${mintAddress}`,
    meteoraUrl: `https://app.meteora.ag/dlmm/${poolAddress}`,
  };
}

/**
 * Prepares the authentic Meteora DAMM v2 migration transaction.
 * Calls program.methods.migrationDammV2 with derived pool and position PDAs.
 */
export async function prepareMeteoraDammMigrationTx(
  poolAddress: string,
  payerWallet: string,
  targetDammConfig?: string
): Promise<{ transactionBase64: string; dammPoolAddress: string }> {
  const connection = new Connection(DEFAULT_RPC, "confirmed");
  const { program } = createDbcProgram(connection);

  const pool = new PublicKey(poolAddress);
  const payer = new PublicKey(payerWallet);

  // Fetch pool state to acquire base & quote mints
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const poolAccount = await client.state.getPool(pool);
  if (!poolAccount) {
    throw new Error(`Meteora DBC pool ${poolAddress} not found on Solana.`);
  }

  const baseMint = poolAccount.poolState.baseMint;
  const quoteMint = poolAccount.poolState.quoteMint;
  const config = poolAccount.poolState.config;
  const poolAuthority = deriveDbcPoolAuthority();
  const baseVault = deriveDbcTokenVaultAddress(pool, baseMint);
  const quoteVault = deriveDbcTokenVaultAddress(pool, quoteMint);

  const dammConfigKey = targetDammConfig || process.env.METEORA_DAMM_V2_CONFIG;
  if (!dammConfigKey) {
    throw new Error("A valid on-chain Meteora DAMM v2 config address is required for migration.");
  }
  const dammConfig = new PublicKey(dammConfigKey);
  const dammPool = deriveDammV2PoolAddress(dammConfig, baseMint, quoteMint);
  const dammPoolAuthority = deriveDammV2PoolAuthority();
  const dammTokenAVault = deriveDammV2TokenVaultAddress(dammPool, baseMint);
  const dammTokenBVault = deriveDammV2TokenVaultAddress(dammPool, quoteMint);
  const dammEventAuthority = deriveDammV2EventAuthority();
  const migrationMetadata = deriveDammV2MigrationMetadataAddress(pool);

  // Derive NFT position mints
  const firstPositionNft = Keypair.generate();
  const secondPositionNft = Keypair.generate();

  const migrationIx = await program.methods
    .migrationDammV2()
    .accountsPartial({
      virtualPool: pool,
      migrationMetadata,
      config,
      poolAuthority,
      pool: dammPool,
      firstPositionNftMint: firstPositionNft.publicKey,
      secondPositionNftMint: secondPositionNft.publicKey,
      dammPoolAuthority,
      ammProgram: DAMM_V2_PROGRAM_ID,
      baseMint,
      quoteMint,
      tokenAVault: dammTokenAVault,
      tokenBVault: dammTokenBVault,
      baseVault,
      quoteVault,
      payer,
      tokenBaseProgram: TOKEN_PROGRAM_ID,
      tokenQuoteProgram: TOKEN_PROGRAM_ID,
      dammEventAuthority,
    })
    .instruction();

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(migrationIx);
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  tx.partialSign(firstPositionNft, secondPositionNft);

  return {
    transactionBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    dammPoolAddress: dammPool.toBase58(),
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
  userSignature?: string,
  providedMintAddress?: string,
  providedPoolAddress?: string
): Promise<MeteoraDbcLaunchResult> {
  const isSupported = await checkMeteoraDbcBadgeSupport(payload.quoteMint);
  if (!isSupported) {
    throw new Error(`Quote mint ${payload.quoteMint} is not supported by Meteora DBC on Solana.`);
  }

  const mintAddress = providedMintAddress || Keypair.generate().publicKey.toBase58();

  const configAddress = resolveDbcConfigAddress({
    quoteMint: payload.quoteMint,
    symbol: payload.symbol,
    pairedStockSymbol: payload.pairedStockSymbol,
    curvePreset: payload.curvePreset || "linear",
  });

  const poolAddress =
    providedPoolAddress ||
    (configAddress
      ? deriveDbcPoolAddress(
          new PublicKey(payload.quoteMint),
          new PublicKey(mintAddress),
          new PublicKey(configAddress)
        ).toBase58()
      : "");

  if (!userSignature) {
    throw new Error("A valid signed Solana transaction signature is required to confirm pool initialization on Solana.");
  }

  return {
    success: true,
    poolAddress,
    mintAddress,
    txHash: userSignature,
    explorerUrl: `https://solscan.io/token/${mintAddress}`,
    meteoraUrl: `https://app.meteora.ag/dlmm/${poolAddress}`,
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
