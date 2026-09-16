import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS, getClawPumpPairs } from "@/lib/clawpump";
import { checkMeteoraDbcBadgeSupport } from "@/lib/meteora-dbc";

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
    const meteoraSupported = await checkMeteoraDbcBadgeSupport(mint);

    return NextResponse.json({
      symbol,
      quoteMint: mint,
      venues: {
        pumpfun: {
          id: "pumpfun",
          name: "Pump.fun (ClawPump)",
          badge: "ClawPump API v1",
          description: "Pairs against tokenized equity on Pump.fun bonding curve. Migrates with liquidity lock.",
          supported: pumpSupported,
          creatorFeeRange: clawPumpData.creatorFeeBps ?? { min: 100, max: 300, default: 100 },
        },
        meteora: {
          id: "meteora",
          name: "Meteora DBC",
          badge: "Dynamic Bonding Curve",
          description: "Dynamic Bonding Curve with concentrated liquidity migration directly into Meteora DLMM pool.",
          supported: meteoraSupported,
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
