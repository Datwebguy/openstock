import { NextResponse } from "next/server";
import { getMarketEvidence } from "@/lib/market-evidence";
import { getHydratedAsset, XStocksApiError } from "@/lib/xstocks";
import { getMarketVerdict } from "@/lib/market-verdict";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  try {
    const asset = await getHydratedAsset(symbol);
    const evidence = await getMarketEvidence(asset);
    return NextResponse.json({ symbol: asset.symbol, asset, evidence, verdict: getMarketVerdict(asset, evidence), generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" } });
  } catch (error) {
    const status = error instanceof XStocksApiError && error.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Stock not found" : "Market data is temporarily unavailable" }, { status });
  }
}
