import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS, getClawPumpPairs } from "@/lib/clawpump";
import { checkMeteoraDbcBadgeSupport, readDbcConfigSummary, resolveDbcConfigAddress } from "@/lib/meteora-dbc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requested = (searchParams.get("symbol") || "NVDAx").toLowerCase();
    const mintParam = searchParams.get("mint");
    const pair = VERIFIED_SOLANA_XSTOCKS_PAIRS.find(
      (p) => p.mint === mintParam || p.symbol.toLowerCase() === requested || p.underlyingStock?.toLowerCase() === requested
    );
    if (!pair) {
      return NextResponse.json({ error: `Stock ${requested} is not in the verified registry.` }, { status: 400 });
    }

    const pumpPairs = await getClawPumpPairs();
    const pumpSupported = pumpPairs.source === "clawpump" && pumpPairs.assets.some((a) => a.mint === pair.mint);

    const [meteoraBadged, config] = await Promise.all([
      checkMeteoraDbcBadgeSupport(pair.mint),
      (async () => {
        const address = resolveDbcConfigAddress({ quoteMint: pair.mint, pairedStockSymbol: pair.symbol });
        return address ? readDbcConfigSummary(address) : null;
      })(),
    ]);
    // Ready only when the config exists on-chain AND is quoted in this exact stock.
    const dbcConfig = config && config.quoteMint === pair.mint ? config : null;
    const meteoraLaunchReady = meteoraBadged && Boolean(dbcConfig);

    return NextResponse.json({
      symbol: pair.symbol,
      quoteMint: pair.mint,
      isBadged: meteoraBadged,
      dbcConfigReady: Boolean(dbcConfig),
      dbcConfig,
      workingLaunchPath: pumpSupported ? "pumpfun" : meteoraLaunchReady ? "meteora" : null,
      venues: {
        pumpfun: {
          id: "pumpfun",
          name: "Pump.fun (ClawPump)",
          description: pumpSupported
            ? `Pump.fun bonding curve quoted in ${pair.symbol}.`
            : pumpPairs.source === "clawpump"
            ? `ClawPump does not list ${pair.symbol} yet.`
            : "Pump.fun launches are not available right now.",
          supported: pumpSupported,
          creatorFeeRange: pumpPairs.creatorFeeBps,
        },
        meteora: {
          id: "meteora",
          name: "Meteora DBC",
          description: meteoraLaunchReady
            ? `Dynamic Bonding Curve quoted in ${pair.symbol}; migrates to ${dbcConfig!.migrationTarget} after ${dbcConfig!.migrationThresholdUi} ${pair.symbol} is raised.`
            : !meteoraBadged
            ? `${pair.symbol} has no Meteora DBC token badge yet.`
            : `No Meteora DBC config for ${pair.symbol} yet.`,
          supported: meteoraLaunchReady,
          isBadged: meteoraBadged,
          dbcConfigReady: Boolean(dbcConfig),
        },
      },
    });
  } catch (error) {
    console.error("Error evaluating venue support:", error);
    return NextResponse.json({ error: "Failed to evaluate venue support" }, { status: 500 });
  }
}
