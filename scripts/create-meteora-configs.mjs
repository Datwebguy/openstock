#!/usr/bin/env node
/**
 * OpenStock × Meteora DBC — per-stock PoolConfig builder (three curve styles).
 *
 * For each xStock quote mint it builds three PoolConfig accounts:
 *   standard — uniform liquidity (linear-feeling price path)
 *   momentum — thin early liquidity, deeper late (steep early price, exponential-feeling)
 *   deep     — deep early liquidity, thinner late (low early slippage, "long" curve)
 *
 * Market caps are given in USD and converted to the quote xStock at the live Jupiter price,
 * because DBC expresses market cap in quote-token units. xStocks have 8 decimals on Solana.
 *
 * Usage:
 *   Dry run (default, spends nothing):
 *     node scripts/create-meteora-configs.mjs --symbols NVDAx,AAPLx --fee-claimer <PUBKEY>
 *   Broadcast:
 *     node scripts/create-meteora-configs.mjs --broadcast --symbols NVDAx,AAPLx --fee-claimer <PUBKEY> --keypair <PATH>
 *
 * Output: config addresses + the METEORA_DBC_CONFIGS value to paste into Vercel.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  buildCurveWithLiquidityWeights,
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

const require = createRequire(import.meta.url);
const curated = require("../lib/solana-curated-25.json");

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const CONFIG_ACCOUNT_BYTES = 1048; // size of an on-chain DBC PoolConfig account

/** Curve presets. Market caps in USD; fees in bps; creator share = % of trading fees paid to the pool creator. */
const CURVES = {
  standard: {
    label: "Equity Standard",
    initialMarketCapUsd: 5_000,
    migrationMarketCapUsd: 69_000,
    baseFeeBps: 150,
    weights: Array.from({ length: 16 }, () => 1),
  },
  momentum: {
    label: "Equity Momentum",
    initialMarketCapUsd: 5_000,
    migrationMarketCapUsd: 85_000,
    baseFeeBps: 200,
    weights: Array.from({ length: 16 }, (_, i) => 1.2 ** i),
  },
  deep: {
    label: "Equity Deep Book",
    initialMarketCapUsd: 10_000,
    migrationMarketCapUsd: 100_000,
    baseFeeBps: 100,
    weights: Array.from({ length: 16 }, (_, i) => 1.2 ** (15 - i)),
  },
};
const CREATOR_TRADING_FEE_PERCENT = 50;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { broadcast: false, symbols: ["NVDAx", "AAPLx"], curves: Object.keys(CURVES), feeClaimer: "", keypair: "", rpc: RPC };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--broadcast") opts.broadcast = true;
    else if (a === "--dry-run") opts.broadcast = false;
    else if (a === "--symbols") opts.symbols = args[++i].split(",").map((s) => s.trim());
    else if (a === "--curves") opts.curves = args[++i].split(",").map((s) => s.trim());
    else if (a === "--fee-claimer") opts.feeClaimer = args[++i];
    else if (a === "--keypair") opts.keypair = args[++i];
    else if (a === "--rpc") opts.rpc = args[++i];
  }
  return opts;
}

async function usdPrice(mint) {
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
  if (!res.ok) throw new Error(`Jupiter price ${res.status}`);
  const body = await res.json();
  const price = Number(body[mint]?.usdPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`No USD price for ${mint}`);
  return price;
}

function buildParams(curve, priceUsd) {
  return buildCurveWithLiquidityWeights({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.EIGHT, // xStocks are 8 decimals on Solana
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 100, // smallest buffer the SDK accepts for weighted curves; goes to the leftover receiver
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: { startingFeeBps: curve.baseFeeBps, endingFeeBps: curve.baseFeeBps, numberOfPeriod: 0, totalDuration: 0 },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: CREATOR_TRADING_FEE_PERCENT,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
    activationType: ActivationType.Slot,
    // DBC market caps are denominated in the quote token (the xStock), not USD.
    initialMarketCap: curve.initialMarketCapUsd / priceUsd,
    migrationMarketCap: curve.migrationMarketCapUsd / priceUsd,
    liquidityWeights: curve.weights,
  });
}

async function main() {
  const opts = parseArgs();
  if (!opts.feeClaimer) throw new Error("Pass --fee-claimer <PUBKEY> (the wallet that claims the platform share of fees).");
  const feeClaimer = new PublicKey(opts.feeClaimer);
  const connection = new Connection(opts.rpc, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const rentLamports = await connection.getMinimumBalanceForRentExemption(CONFIG_ACCOUNT_BYTES);

  let payer = null;
  if (opts.broadcast) {
    if (!opts.keypair || !fs.existsSync(opts.keypair)) throw new Error("Broadcast needs --keypair <PATH> to a funded payer keypair JSON.");
    payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(opts.keypair, "utf8"))));
    const balance = await connection.getBalance(payer.publicKey);
    const needed = rentLamports * opts.symbols.length * opts.curves.length + 50_000 * opts.symbols.length * opts.curves.length;
    console.log(`Payer ${payer.publicKey.toBase58()} balance ${(balance / 1e9).toFixed(6)} SOL, needs ~${(needed / 1e9).toFixed(6)} SOL`);
    if (balance < needed) throw new Error("Payer balance too low.");
  }

  console.log(`\n${opts.broadcast ? "BROADCAST" : "DRY RUN (nothing is sent)"} · RPC ${opts.rpc.replace(/api-key=[^&]+/, "api-key=***")}`);
  console.log(`Fee claimer / leftover receiver: ${feeClaimer.toBase58()}`);
  console.log(`Rent per config: ${(rentLamports / 1e9).toFixed(8)} SOL · total rent: ${((rentLamports * opts.symbols.length * opts.curves.length) / 1e9).toFixed(8)} SOL\n`);

  const result = {};
  for (const symbol of opts.symbols) {
    const meta = curated[symbol];
    if (!meta) throw new Error(`${symbol} is not in lib/solana-curated-25.json`);
    const quoteMint = new PublicKey(meta.mint);
    const badge = deriveTokenBadgeAddress(quoteMint);
    if (!(await connection.getAccountInfo(badge))) {
      console.log(`✗ ${symbol}: no Meteora DBC token badge (${badge.toBase58()}) — skipped.`);
      continue;
    }
    const priceUsd = await usdPrice(meta.mint);
    result[symbol] = {};
    console.log(`${symbol} @ $${priceUsd.toFixed(2)} · badge ${badge.toBase58()}`);

    for (const key of opts.curves) {
      const curve = CURVES[key];
      if (!curve) throw new Error(`Unknown curve ${key}`);
      const params = buildParams(curve, priceUsd);
      const thresholdUi = Number(params.migrationQuoteThreshold.toString()) / 1e8;
      const configKeypair = Keypair.generate();
      console.log(
        `  ${key.padEnd(9)} ${curve.label.padEnd(18)} fee ${(curve.baseFeeBps / 100).toFixed(2)}% · creator ${CREATOR_TRADING_FEE_PERCENT}% · ` +
          `$${curve.initialMarketCapUsd.toLocaleString()} → $${curve.migrationMarketCapUsd.toLocaleString()} · migrates after ${thresholdUi.toFixed(4)} ${symbol} (~$${(thresholdUi * priceUsd).toFixed(0)}) raised`
      );

      const tx = await client.partner.createConfig({
        config: configKeypair.publicKey,
        feeClaimer,
        leftoverReceiver: feeClaimer,
        quoteMint,
        payer: payer ? payer.publicKey : feeClaimer,
        tokenBadge: badge,
        ...params,
      });

      if (!opts.broadcast) {
        result[symbol][key] = `(dry-run) ${configKeypair.publicKey.toBase58()}`;
        continue;
      }
      tx.feePayer = payer.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
      const sig = await sendAndConfirmTransaction(connection, tx, [payer, configKeypair], { commitment: "confirmed" });
      const created = await connection.getAccountInfo(configKeypair.publicKey);
      if (!created?.owner.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID)) throw new Error(`Config ${configKeypair.publicKey.toBase58()} not owned by DBC program`);
      result[symbol][key] = configKeypair.publicKey.toBase58();
      console.log(`    ✓ ${configKeypair.publicKey.toBase58()} · https://solscan.io/tx/${sig}`);
    }
  }

  console.log(`\nMETEORA_DBC_CONFIGS=${JSON.stringify(result)}`);
  if (opts.broadcast) {
    fs.writeFileSync("meteora-dbc-configs.json", JSON.stringify(result, null, 2));
    console.log("Saved to meteora-dbc-configs.json — paste the METEORA_DBC_CONFIGS line above into Vercel (Production).");
  }
}

main().catch((err) => {
  console.error("\n✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
