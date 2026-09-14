import { getMarketWatchState, recordMarketAlerts, type MarketWatch } from "@/lib/alert-store";
import { getMeteoraPools } from "@/lib/market-evidence";
import { getHydratedAsset } from "@/lib/xstocks";

type MarketSnapshot = { price: number | null; liquidity: number | null };

function reached(watch: MarketWatch, currentValue: number) {
  return watch.direction === "above" ? currentValue >= watch.threshold : currentValue <= watch.threshold;
}

export async function evaluateMarketWatches(sessionId: string) {
  const { watches } = await getMarketWatchState(sessionId);
  const symbols = [...new Set(watches.map((watch) => watch.symbol))];
  const snapshots = new Map<string, MarketSnapshot>();
  const failures: string[] = [];

  await Promise.all(symbols.map(async (symbol) => {
    try {
      const asset = await getHydratedAsset(symbol);
      const pools = await getMeteoraPools(asset).catch(() => []);
      snapshots.set(symbol, { price: asset.price ?? pools[0]?.priceUsd ?? null, liquidity: pools[0]?.tvl ?? null });
    } catch { failures.push(symbol); }
  }));

  const hits = watches.flatMap((watch) => {
    const snapshot = snapshots.get(watch.symbol);
    const currentValue = watch.kind === "price" ? snapshot?.price : snapshot?.liquidity;
    return typeof currentValue === "number" && Number.isFinite(currentValue) && reached(watch, currentValue) ? [{ watch, currentValue }] : [];
  });
  const state = await recordMarketAlerts(sessionId, hits);
  return { ...state, checked: watches.length, hits: hits.length, failures };
}
