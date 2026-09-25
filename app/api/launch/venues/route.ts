import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS, getClawPumpPairs } from "@/lib/clawpump";
import { checkMeteoraDbcBadgeSupport, DBC_CURVE_KEYS, DBC_CURVE_LABELS, listDbcConfigs, readDbcConfigSummary, type DbcConfigSummary, type DbcCurveKey } from "@/lib/meteora-dbc";

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

    const configured = listDbcConfigs({ quoteMint: pair.mint, pairedStockSymbol: pair.symbol });
    const [meteoraBadged, summaries] = await Promise.all([
      checkMeteoraDbcBadgeSupport(pair.mint),
      Promise.all(
        DBC_CURVE_KEYS.map(async (key) => {
          const address = configured[key];
          const summary = address ? await readDbcConfigSummary(address) : null;
          // Only curves whose config exists on-chain AND is quoted in this exact stock.
          return summary && summary.quoteMint === pair.mint ? ([key, summary] as const) : null;
        })
      ),
    ]);
    const dbcConfigs = Object.fromEntries(summaries.filter(Boolean).map((entry) => [entry![0], { ...entry![1], ...DBC_CURVE_LABELS[entry![0]] }])) as Partial<
      Record<DbcCurveKey, DbcConfigSummary & { name: string; blurb: string }>
    >;
    const dbcConfig = dbcConfigs.standard ?? Object.values(dbcConfigs)[0] ?? null;
    const meteoraLaunchReady = meteoraBadged && Boolean(dbcConfig);

    return NextResponse.json({
      symbol: pair.symbol,
      quoteMint: pair.mint,
      isBadged: meteoraBadged,
      dbcConfigReady: Boolean(dbcConfig),
      dbcConfig,
      dbcConfigs,
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
