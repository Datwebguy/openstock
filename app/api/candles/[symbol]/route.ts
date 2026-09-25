import { NextResponse } from "next/server";
import curated from "@/lib/solana-curated-25.json";

const GECKO = "https://api.geckoterminal.com/api/v2/networks/solana";
const FRAMES: Record<string, { unit: "minute" | "hour" | "day"; aggregate: number; limit: number }> = {
  "1m": { unit: "minute", aggregate: 1, limit: 120 },
  "5m": { unit: "minute", aggregate: 5, limit: 120 },
  "15m": { unit: "minute", aggregate: 15, limit: 96 },
  "1h": { unit: "hour", aggregate: 1, limit: 72 },
  "4h": { unit: "hour", aggregate: 4, limit: 60 },
  "1d": { unit: "day", aggregate: 1, limit: 60 },
};

type GeckoPool = { attributes?: { address?: string; name?: string; reserve_in_usd?: string } };
const poolCache = new Map<string, { at: number; pool: { address: string; name: string } | null }>();
/** Last successful response per symbol+timeframe, served when GeckoTerminal rate-limits (free API). */
const lastGood = new Map<string, { at: number; body: Record<string, unknown> }>();

/** Most liquid Solana pool for the mint, per GeckoTerminal (cached 10 minutes). */
async function topPool(mint: string) {
  const cached = poolCache.get(mint);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.pool;
  const res = await fetch(`${GECKO}/tokens/${mint}/pools?page=1`, { headers: { Accept: "application/json" }, next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GeckoTerminal pools ${res.status}`);
  const body = (await res.json()) as { data?: GeckoPool[] };
  const best = (body.data ?? [])
    .map((pool) => ({ address: pool.attributes?.address ?? "", name: pool.attributes?.name ?? "", reserve: Number(pool.attributes?.reserve_in_usd ?? 0) }))
    .filter((pool) => pool.address)
    .sort((a, b) => b.reserve - a.reserve)[0];
  const pool = best ? { address: best.address, name: best.name } : null;
  poolCache.set(mint, { at: Date.now(), pool });
  return pool;
}

/** Real USD OHLCV for an xStock from its most liquid Solana pool. No synthetic fallback: empty when unavailable. */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const meta = (curated as Record<string, { mint: string }>)[symbol];
  if (!meta) return NextResponse.json({ error: "Stock not found." }, { status: 404 });
  const tf = new URL(request.url).searchParams.get("tf") ?? "1h";
  const frame = FRAMES[tf] ?? FRAMES["1h"];
  try {
    const pool = await topPool(meta.mint);
    if (!pool) return NextResponse.json({ symbol, candles: [], source: null });
    const url = `${GECKO}/pools/${pool.address}/ohlcv/${frame.unit}?aggregate=${frame.aggregate}&limit=${frame.limit}&currency=usd&token=${meta.mint}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: frame.unit === "minute" ? 30 : 120 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`GeckoTerminal ohlcv ${res.status}`);
    const body = (await res.json()) as { data?: { attributes?: { ohlcv_list?: number[][] } } };
    const candles = (body.data?.attributes?.ohlcv_list ?? [])
      .map(([t, o, h, l, c, v]) => ({ timestamp: t * 1000, open: o, high: h, low: l, close: c, volume: v }))
      .filter((c) => [c.open, c.high, c.low, c.close].every((n) => Number.isFinite(n) && n > 0))
      .sort((a, b) => a.timestamp - b.timestamp);
    const body = { symbol, timeframe: tf, candles, source: { provider: "GeckoTerminal", pool: pool.name, poolAddress: pool.address } };
    if (candles.length > 0) lastGood.set(`${symbol}:${tf}`, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
  } catch (error) {
    console.warn("candles failed", symbol, error instanceof Error ? error.message : error);
    const cached = lastGood.get(`${symbol}:${tf}`);
    if (cached && Date.now() - cached.at < 30 * 60_000) {
      return NextResponse.json({ ...cached.body, stale: true, fetchedAt: new Date(cached.at).toISOString() }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ symbol, candles: [], error: "Chart data is unavailable right now." }, { status: 502 });
  }
}
