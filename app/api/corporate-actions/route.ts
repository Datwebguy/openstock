import { NextResponse } from "next/server";
import { CURATED_SYMBOLS } from "@/lib/xstocks";
import type { CorporateActionData } from "@/lib/market-evidence";

const API_BASE = process.env.XSTOCKS_API_BASE ?? "https://api.xstocks.fi/api/v2";
type ActionNode = CorporateActionData & { symbol?: string; xstockSymbol?: string | null; effectiveTimeUtc?: string | null; grossCashflowUsd?: string | null; fromUnits?: string | null; toUnits?: string | null };

function actionDate(action: ActionNode) {
  const value = action.effectiveDateUtc ?? action.effectiveTimeUtc ?? action.activationDateTime ?? null;
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function getActions(symbol: string) {
  const params = new URLSearchParams({ page: "1", pageSize: "20", symbol, sortBy: "createdTimeUtc", sortOrder: "desc" });
  const response = await fetch(API_BASE + "/public/corporate-actions/upcoming?" + params.toString(), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Corporate actions returned " + response.status);
  const payload = await response.json() as { nodes?: ActionNode[] };
  return (payload.nodes ?? []).map((action) => ({
    id: action.eventId ?? symbol + "-" + (action.caType ?? "event") + "-" + (actionDate(action) ?? "undated"),
    symbol: action.xstockSymbol ?? action.symbol ?? symbol,
    type: action.caType ?? "Issuer update",
    date: actionDate(action),
    status: action.status ?? "Upcoming",
    notes: action.notes ?? null,
    amountUsd: action.grossCashflowUsd ?? null,
    fromUnits: action.fromUnits ?? null,
    toUnits: action.toUnits ?? null,
  }));
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("symbol");
  const symbols = requested && CURATED_SYMBOLS.includes(requested) ? [requested] : CURATED_SYMBOLS;
  const results = await Promise.allSettled(symbols.map(getActions));
  const now = Date.now();
  const events = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((event) => !event.date || new Date(event.date).getTime() >= now);
  const failedSymbols = results.flatMap((result, index) => result.status === "rejected" ? [symbols[index]] : []);
  events.sort((left, right) => (left.date ?? "9999").localeCompare(right.date ?? "9999"));
  return NextResponse.json({ events, failedSymbols, generatedAt: new Date().toISOString(), source: "xStocks public corporate-actions feed" }, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } });
}
