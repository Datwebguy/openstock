import { NextResponse } from "next/server";
import { getMeteoraPools } from "@/lib/market-evidence";
import { CURATED_SYMBOLS, getHydratedAsset } from "@/lib/xstocks";

export async function GET() {
  try {
    const results = await Promise.allSettled(CURATED_SYMBOLS.map(async (symbol) => {
      const asset = await getHydratedAsset(symbol);
      const pools = await getMeteoraPools(asset);
      return { symbol, tvl: pools.reduce((sum, pool) => sum + pool.tvl, 0), volume24h: pools.reduce((sum, pool) => sum + pool.volume24h, 0), poolCount: pools.length, priceUsd: pools.find((pool) => pool.priceUsd !== null)?.priceUsd ?? null };
    }));
    const metrics = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    return NextResponse.json({ metrics, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ metrics: [], generatedAt: new Date().toISOString() }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
