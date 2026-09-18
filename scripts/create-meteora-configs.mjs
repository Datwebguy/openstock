#!/usr/bin/env node

/**
 * OpenStock Meteora DBC Config Initializer
 *
 * Strictly initializes ONE Meteora DBC Config on Solana Mainnet:
 * - Quote Mint: NVDAx (Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh)
 * - Curve Type: Standard / Linear
 * - Quote Token Badge PDA: mfacWnGh1Kn5ttHMMaNZhRZbCjvGrDQyDyZgqaR9vBM
 * - Migration Target: DAMM v2 (cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG)
 *
 * Usage:
 *   node scripts/create-meteora-configs.mjs --dry-run --fee-claimer <ADDRESS>
 *   node scripts/create-meteora-configs.mjs --broadcast --fee-claimer <ADDRESS> --keypair <PATH_TO_KEYPAIR>
 */

import fs from "node:fs";
import path from "node:path";
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  buildCurveWithMarketCap,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  MigrationOption,
  MigrationFeeOption,
  BaseFeeMode,
  CollectFeeMode,
  ActivationType,
  deriveTokenBadgeAddress,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

const DEFAULT_RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const NVDAX_MINT = new PublicKey("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: true,
    broadcast: false,
    feeClaimer: process.env.OPENSTOCK_FEE_CLAIMER || "",
    leftoverReceiver: process.env.OPENSTOCK_LEFTOVER_RECEIVER || "",
    keypairPath: process.env.KEYPAIR_PATH || "",
    rpcUrl: DEFAULT_RPC,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      options.dryRun = true;
      options.broadcast = false;
    } else if (args[i] === "--broadcast") {
      options.broadcast = true;
      options.dryRun = false;
    } else if (args[i] === "--fee-claimer" && args[i + 1]) {
      options.feeClaimer = args[++i];
    } else if (args[i] === "--leftover-receiver" && args[i + 1]) {
      options.leftoverReceiver = args[++i];
    } else if (args[i] === "--keypair" && args[i + 1]) {
      options.keypairPath = args[++i];
    } else if (args[i] === "--rpc" && args[i + 1]) {
      options.rpcUrl = args[++i];
    }
  }

  if (!options.leftoverReceiver && options.feeClaimer) {
    options.leftoverReceiver = options.feeClaimer;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("\n=======================================================");
  console.log("   OpenStock × Meteora DBC: Single NVDAx Config Builder");
  console.log("=======================================================\n");

  const connection = new Connection(options.rpcUrl, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  // Verify on-chain Token Badge for NVDAx
  const tokenBadgePda = deriveTokenBadgeAddress(NVDAX_MINT);
  const badgeInfo = await connection.getAccountInfo(tokenBadgePda);
  if (!badgeInfo) {
    throw new Error(`Token Badge PDA (${tokenBadgePda.toBase58()}) for NVDAx not found on mainnet.`);
  }

  console.log("1. Quote Token & Token Badge:");
  console.log(`   - Quote Token: NVDAx (${NVDAX_MINT.toBase58()})`);
  console.log(`   - On-Chain Badge PDA: ${tokenBadgePda.toBase58()} (Verified: ${badgeInfo.data.length} bytes, Owner: ${badgeInfo.owner.toBase58()})\n`);

  // Rent Exemption Estimation
  const poolConfigSize = 2680;
  const rentLamports = await connection.getMinimumBalanceForRentExemption(poolConfigSize);
  const rentSol = rentLamports / 1e9;

  console.log("2. Rent & Cost Calculation:");
  console.log(`   - Account Space: ${poolConfigSize} bytes`);
  console.log(`   - Exact Rent: ${rentSol.toFixed(6)} SOL (${rentLamports} lamports)`);
  console.log(`   - Estimated Network Fee: ~0.000010 SOL\n`);

  if (!options.feeClaimer) {
    console.log("⚠️  [NOTICE] No fee-claimer address provided yet.");
    console.log("   Run with --fee-claimer <SOLANA_PUBKEY> to simulate or execute.\n");
    return;
  }

  const feeClaimerPubkey = new PublicKey(options.feeClaimer);
  const leftoverReceiverPubkey = new PublicKey(options.leftoverReceiver);

  console.log("3. Royalty & Payer Configuration:");
  console.log(`   - feeClaimer: ${feeClaimerPubkey.toBase58()}`);
  console.log(`   - leftoverReceiver: ${leftoverReceiverPubkey.toBase58()}\n`);

  // Generate new keypair for the config account
  const configKeypair = Keypair.generate();
  console.log("4. Generated Config Account Address:");
  console.log(`   - Proposed Config Pubkey: ${configKeypair.publicKey.toBase58()}`);
  console.log(`   - Signer required: Config Keypair + Payer\n`);

  // Curve Parameters: Standard / Linear ($5k initial -> $69k migration market cap)
  const curveParams = buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.SIX,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 150,
          endingFeeBps: 150,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 100,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee: {
        feePercentage: 0,
        creatorFeePercentage: 0,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Slot,
    initialMarketCap: 5000,
    migrationMarketCap: 69000,
  });

  // Build Transaction
  let payerPubkey = feeClaimerPubkey;
  let payerKeypair = null;

  if (options.keypairPath && fs.existsSync(options.keypairPath)) {
    const raw = JSON.parse(fs.readFileSync(options.keypairPath, "utf-8"));
    payerKeypair = Keypair.fromSecretKey(new Uint8Array(raw));
    payerPubkey = payerKeypair.publicKey;
  }

  const tx = await client.partner.createConfig({
    config: configKeypair.publicKey,
    feeClaimer: feeClaimerPubkey,
    leftoverReceiver: leftoverReceiverPubkey,
    quoteMint: NVDAX_MINT,
    payer: payerPubkey,
    tokenBadge: tokenBadgePda,
    ...curveParams,
  });

  console.log("5. Transaction Preflight Inspection:");
  console.log(`   - Target Program: ${DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58()}`);
  console.log(`   - Instructions: ${tx.instructions.length}`);
  console.log(`   - Accounts: ${tx.instructions[0].keys.length}`);
  tx.instructions[0].keys.forEach((k, i) => {
    console.log(`     [${i}] ${k.pubkey.toBase58()} (signer: ${k.isSigner}, writable: ${k.isWritable})`);
  });

  if (options.dryRun || !options.broadcast) {
    console.log("\n=======================================================");
    console.log("   DRY RUN COMPLETE — ZERO SOL SPENT — NO TX BROADCAST");
    console.log("=======================================================\n");
    return;
  }

  // Broadcast mode: requires payer keypair
  if (!payerKeypair) {
    throw new Error("Cannot broadcast: No valid payer keypair provided (--keypair <PATH>).");
  }

  console.log("\n⚠️  BROADCASTING TRANSACTION TO SOLANA MAINNET...");
  tx.feePayer = payerPubkey;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  tx.partialSign(configKeypair);
  tx.partialSign(payerKeypair);

  const txSignature = await sendAndConfirmTransaction(connection, tx, [payerKeypair, configKeypair], {
    commitment: "confirmed",
  });

  console.log("\n🎉 CONFIG CREATION SUCCESSFUL!");
  console.log(`   - Config Address: ${configKeypair.publicKey.toBase58()}`);
  console.log(`   - Tx Signature: ${txSignature}`);
  console.log(`   - Solscan: https://solscan.io/account/${configKeypair.publicKey.toBase58()}`);
  console.log(`   - Tx Explorer: https://solscan.io/tx/${txSignature}`);

  // Confirm ownership
  const createdInfo = await connection.getAccountInfo(configKeypair.publicKey);
  console.log(`   - Account Owner: ${createdInfo?.owner.toBase58()} (Expected: ${DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58()})\n`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
