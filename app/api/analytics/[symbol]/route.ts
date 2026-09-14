import { NextResponse } from "next/server";
import { getMeteoraOhlcv, getMeteoraPools, getSolPriceUsd } from "@/lib/market-evidence";
import { getHydratedAsset, XStocksApiError } from "@/lib/xstocks";

const timeframes = new Set(["1h", "4h", "24h"]);

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const timeframeValue = new URL(request.url).searchParams.get("timeframe") ?? "1h";
  const timeframe = (timeframes.has(timeframeValue) ? timeframeValue : "1h") as "1h" | "4h" | "24h";
  try {
    const asset = await getHydratedAsset(symbol);
    const pools = await getMeteoraPools(asset);
    const pool = pools[0] ?? null;
    const rawCandles = pool ? await getMeteoraOhlcv(pool.address, timeframe) : [];
    const solPriceUsd = pool && (pool.tokenXSymbol === "SOL" || pool.tokenYSymbol === "SOL") ? await getSolPriceUsd().catch(() => null) : null;
    const rawLast = rawCandles.at(-1)?.close ?? null;
    const usdReference = pool?.priceUsd ?? asset.price ?? null;
    const multiplyError = rawLast && solPriceUsd && usdReference ? Math.abs((rawLast * solPriceUsd - usdReference) / usdReference) : Number.POSITIVE_INFINITY;
    const divideError = rawLast && solPriceUsd && usdReference ? Math.abs((solPriceUsd / rawLast - usdReference) / usdReference) : Number.POSITIVE_INFINITY;
    const conversion = solPriceUsd && Math.min(multiplyError, divideError) < 0.2 ? (multiplyError <= divideError ? (value: number) => value * solPriceUsd : (value: number) => solPriceUsd / value) : null;
    const candles = conversion ? rawCandles.map((candle) => ({ ...candle, open: conversion(candle.open), high: conversion(candle.high), low: conversion(candle.low), close: conversion(candle.close) })) : rawCandles;
    return NextResponse.json({ symbol: asset.symbol, name: asset.name.replace(/ xStock$/, ""), referencePrice: asset.price, trading: asset.trading, pool: pool ? { name: pool.name, address: pool.address, tvl: pool.tvl, volume24h: pool.volume24h, priceUsd: pool.priceUsd, poolCount: pools.length, tokenXSymbol: pool.tokenXSymbol, tokenYSymbol: pool.tokenYSymbol } : null, candles, chartCurrency: conversion ? "USD" : pool?.tokenYSymbol ?? "pool units", conversionLabel: conversion ? "Converted from SOL pair using a read-only SOL/USD quote" : "Pool-denominated candles", timeframe, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" } });
  } catch (error) {
    const status = error instanceof XStocksApiError && error.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Stock not found" : "Analytics are temporarily unavailable" }, { status });
  }
}
