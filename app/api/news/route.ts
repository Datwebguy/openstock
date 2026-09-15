import { NextResponse } from "next/server";
import { getMarketNews } from "@/lib/market-news";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol") ?? undefined;
  try {
    const feed = await getMarketNews(symbol);
    return NextResponse.json({ ...feed, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "The market news sources are not responding right now." }, { status: 502 });
  }
}
