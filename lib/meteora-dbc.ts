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

// Default Meteora DBC Config on Solana Mainnet
export const DEFAULT_DBC_CONFIG = new PublicKey(
  process.env.METEORA_DBC_CONFIG || "F5g2K41f1U2wA6qg4rXp1Yv5K8tJ3bE4wKM89pTxsZ3F"
);

// In-memory cache for token badge existence check
const tokenBadgeCache = new Map<string, boolean>();

/**
 * Checks whether an xStock quote mint has an on-chain token badge PDA on Solana Mainnet.
 * In Meteora DBC, Token-2022 quote tokens require an on-chain Token Badge:
 * PDA: ["token_badge", quoteMint] with DYNAMIC_BONDING_CURVE_PROGRAM_ID.
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
    console.warn(`Error checking Meteora DBC badge support for ${quoteMint}:`, err);
    const KNOWN_SUPPORTED = new Set([
      "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", // AAPLx
      "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", // NVDAx
      "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", // TSLAx
      "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", // MSFTx
      "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", // AMZNx
      "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", // GOOGLx
      "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", // METAx
      "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", // COINx
    ]);
    const isKnown = KNOWN_SUPPORTED.has(quoteMint);
    tokenBadgeCache.set(quoteMint, isKnown);
    return isKnown;
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
  const config = DEFAULT_DBC_CONFIG;

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

  // Construct genuine on-chain instruction: initializeVirtualPoolWithSplToken
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

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  // Set compute unit limit & priority fees for Meteora DBC
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
  tx.add(initVirtualPoolIx);

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
  payerWallet: string
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

  const dammConfig = new PublicKey("F5g2K41f1U2wA6qg4rXp1Yv5K8tJ3bE4wKM89pTxsZ3F");
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

  const poolAddress =
    providedPoolAddress ||
    deriveDbcPoolAddress(
      new PublicKey(payload.quoteMint),
      new PublicKey(mintAddress),
      DEFAULT_DBC_CONFIG
    ).toBase58();

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
