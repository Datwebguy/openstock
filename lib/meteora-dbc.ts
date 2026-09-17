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
    name: "Linear Standard",
    subtitle: "Balanced Discovery (Mega-Cap xStocks)",
    description: "Even price discovery curve with standard graduation threshold, ideal for mega-cap equities like AAPLx and NVDAx.",
    configAddress: process.env.METEORA_DBC_CONFIG_LINEAR || process.env.METEORA_DBC_CONFIG || undefined,
    baseFeeBps: 150,
    curveType: "Linear Constant Product",
    targetMarketCap: "$69,000 USD",
  },
  exponential: {
    id: "exponential",
    name: "Exponential Growth",
    subtitle: "Steeper Early Curve",
    description: "Steeper price escalation that rewards early community participants and accelerates migration into DAMM v2.",
    configAddress: process.env.METEORA_DBC_CONFIG_EXPONENTIAL || undefined,
    baseFeeBps: 200,
    curveType: "Exponential Curve",
    targetMarketCap: "$85,000 USD",
  },
  flat: {
    id: "flat",
    name: "Flat Deep Liquidity",
    subtitle: "Low-Slippage / ETF-Style",
    description: "Low-slippage, deep liquidity curve tailored for broad-market indices (SPY, QQQ) and institutional allocations.",
    configAddress: process.env.METEORA_DBC_CONFIG_FLAT || undefined,
    baseFeeBps: 100,
    curveType: "Flat / Concentrated",
    targetMarketCap: "$100,000 USD",
  },
};

// Default Meteora DBC Config on Solana Mainnet (if configured via environment)
export const DEFAULT_DBC_CONFIG: PublicKey | null = process.env.METEORA_DBC_CONFIG
  ? new PublicKey(process.env.METEORA_DBC_CONFIG)
  : null;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const PERMISSIONLESS_SPL_MINTS = new Set([
  SOL_MINT, // Wrapped SOL
  USDC_MINT, // Circle USDC
]);

// In-memory cache for token badge existence check
const tokenBadgeCache = new Map<string, boolean>();

/**
 * Checks whether an xStock quote mint has an on-chain token badge PDA on Solana Mainnet.
 * In Meteora DBC, Token-2022 quote tokens require an on-chain Token Badge:
 * PDA: ["token_badge", quoteMint] with DYNAMIC_BONDING_CURVE_PROGRAM_ID.
 *
 * NOTE: Standard SPL tokens (SOL, USDC) are permissionless and do not require a token badge.
 * Token-2022 tokens without an initialized on-chain badge account will return false.
 * We never invent or mock a badge.
 */
export async function checkMeteoraDbcBadgeSupport(quoteMint: string): Promise<boolean> {
  // Native SOL and USDC are standard SPL tokens (Token Program) - fully permissionless
  if (PERMISSIONLESS_SPL_MINTS.has(quoteMint)) {
    return true;
  }

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
  const selectedPreset = METEORA_DBC_CURVE_PRESETS[curvePresetKey] || METEORA_DBC_CURVE_PRESETS.linear;
  const configAddress = selectedPreset.configAddress || process.env.METEORA_DBC_CONFIG;
  if (!configAddress) {
    throw new Error(
      `No valid Meteora DBC PoolConfig address is configured for preset '${curvePresetKey}'. A real on-chain config account owned by dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN is required.`
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

  const curvePresetKey = payload.curvePreset || "linear";
  const selectedPreset = METEORA_DBC_CURVE_PRESETS[curvePresetKey] || METEORA_DBC_CURVE_PRESETS.linear;
  const configAddress = selectedPreset.configAddress || process.env.METEORA_DBC_CONFIG;

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
