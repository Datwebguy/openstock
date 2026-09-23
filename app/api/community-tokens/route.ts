import { NextRequest, NextResponse } from "next/server";
import { getCommunityMarketKPIs, getCommunityTokens } from "@/lib/community-tokens";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const search = searchParams.get("search")?.toLowerCase() || "";

    const [tokens, kpis] = await Promise.all([
      getCommunityTokens(),
      getCommunityMarketKPIs(),
    ]);

    let filtered = tokens;

    if (filter === "new") {
      filtered = filtered.filter((t) => {
        const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
        return ageHours <= 24;
      });
    } else if (filter === "graduating") {
      filtered = filtered.filter((t) => t.bondingCurveProgress >= 70 && t.bondingCurveProgress < 100);
    } else if (filter === "graduated") {
      filtered = filtered.filter((t) => t.status === "graduated" || t.bondingCurveProgress >= 100);
    }

    if (search) {
      const needle = search.slice(0, 80);
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          t.symbol.toLowerCase().includes(needle) ||
          t.pairedStockSymbol.toLowerCase().includes(needle) ||
          t.pairedStockName.toLowerCase().includes(needle)
      );
    }

    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 100) || 100));
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);

    return NextResponse.json({
      tokens: filtered.slice(offset, offset + limit),
      kpis,
      count: filtered.length,
    });
  } catch (err: unknown) {
    console.error("Community tokens API error:", err);
    return NextResponse.json({ error: "Failed to fetch community tokens" }, { status: 500 });
  }
}
