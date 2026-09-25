import { NextResponse } from "next/server";
import { getMarketEvidence, reserveCoverage } from "@/lib/market-evidence";
import { getHydratedAsset, XStocksApiError } from "@/lib/xstocks";

/** Evidence summary for the Analytics workspace: issuer price, oracle cross-check, Meteora pools, reserves, multiplier. */
export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  try {
    const asset = await getHydratedAsset(symbol);
    const evidence = await getMarketEvidence(asset);
    const reserves = evidence.reserves.data;
    const held = Number(reserves?.sharesHeld);
    const circulating = Number(reserves?.circulatingSupply);
    return NextResponse.json(
      {
        symbol: asset.symbol,
        name: asset.name,
        mint: asset.solanaDeployment?.address ?? null,
        decimals: evidence.tokenDecimals.data,
        issuerPrice: asset.price,
        multiplier: asset.multiplier?.currentMultiplier ?? null,
        oracle: evidence.pyth.data,
        executablePrice: evidence.jupiter.data?.executablePrice ?? null,
        priceImpactPct: evidence.jupiter.data?.priceImpactPct ?? null,
        pools: (evidence.meteora.data ?? []).filter((pool) => !pool.isBlacklisted).slice(0, 8),
        reserves: {
          sharesHeld: Number.isFinite(held) ? held : null,
          circulatingSupply: Number.isFinite(circulating) ? circulating : null,
          coverage: reserveCoverage(reserves),
          asOf: reserves?.timestamp ?? null,
        },
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } }
    );
  } catch (error) {
    const status = error instanceof XStocksApiError && error.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Stock not found." : "Evidence is unavailable right now." }, { status });
  }
}
