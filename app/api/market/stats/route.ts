import { NextResponse } from "next/server";
import { getAllAssetMarketStats } from "@/lib/market-stats";

export async function GET() {
  try {
    const stats = await getAllAssetMarketStats();
    return NextResponse.json(
      { stats, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    console.error("API /api/market/stats error:", error);
    return NextResponse.json({ stats: {}, error: "Failed to fetch market stats" }, { status: 500 });
  }
}
