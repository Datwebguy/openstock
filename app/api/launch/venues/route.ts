import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS, getClawPumpPairs } from "@/lib/clawpump";
import {
  checkMeteoraDbcBadgeSupport,
  METEORA_DBC_CURVE_PRESETS,
  resolveDbcConfigAddress,
} from "@/lib/meteora-dbc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || "NVDAx";
    let mint = searchParams.get("mint");

    // Discover mint from symbol if not provided
    if (!mint) {
      const match = VERIFIED_SOLANA_XSTOCKS_PAIRS.find(
        (p) => p.symbol.toLowerCase() === symbol.toLowerCase()
      );
      if (match) {
        mint = match.mint;
      }
    }

    if (!mint) {
      return NextResponse.json(
        { error: `Stock symbol ${symbol} not found in verified registry.` },
        { status: 400 }
      );
    }

    // 1. Check Pump.fun (ClawPump) support
    const clawPumpData = await getClawPumpPairs();
    const pumpSupported = clawPumpData.assets.some(
      (a) => a.mint === mint || a.symbol.toLowerCase() === symbol.toLowerCase()
    );

    // 2. Check Meteora DBC support via on-chain token badge check
    const meteoraBadged = await checkMeteoraDbcBadgeSupport(mint);
    // 3. Per-stock PoolConfig (quote mint is fixed on each config account)
    const dbcConfigAddress = resolveDbcConfigAddress({
      quoteMint: mint,
      pairedStockSymbol: symbol,
      symbol,
    });
    const dbcConfigReady = Boolean(dbcConfigAddress);
    const meteoraLaunchReady = meteoraBadged && dbcConfigReady;

    return NextResponse.json({
      symbol,
      quoteMint: mint,
      isBadged: meteoraBadged,
      dbcConfigReady,
      dbcConfigAddress,
      workingLaunchPath: pumpSupported ? "pumpfun" : meteoraLaunchReady ? "meteora" : null,
      curvePresets: METEORA_DBC_CURVE_PRESETS,
      venues: {
        pumpfun: {
          id: "pumpfun",
          name: "Pump.fun (ClawPump)",
          badge: "Working path",
          description: "Pairs against tokenized equity on Pump.fun bonding curve. Primary launch path until a DBC PoolConfig is set.",
          supported: pumpSupported,
          creatorFeeRange: clawPumpData.creatorFeeBps ?? { min: 100, max: 300, default: 100 },
        },
        meteora: {
          id: "meteora",
          name: "Meteora DBC",
          badge: dbcConfigReady ? "Dynamic Bonding Curve" : "Needs PoolConfig",
          description: dbcConfigReady
            ? `Dynamic Bonding Curve paired against ${symbol}, with migration into a Meteora pool.`
            : `No PoolConfig for ${symbol} yet. Use Pump.fun, or create an xStock-quoted METEORA_DBC_CONFIG_${symbol.toUpperCase()}.`,
          supported: meteoraLaunchReady,
          isBadged: meteoraBadged,
          dbcConfigReady,
          dbcConfigAddress,
          creatorFeeRange: { min: 100, max: 300, default: 150 },
        },
      },
    });
  } catch (error) {
    console.error("Error evaluating venue support:", error);
    return NextResponse.json(
      { error: "Failed to evaluate venue support" },
      { status: 500 }
    );
  }
}
