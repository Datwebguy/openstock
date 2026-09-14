"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Candle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
type AnalyticsPayload = { referencePrice: number | null; candles: Candle[]; chartCurrency?: string; timeframe: string; generatedAt: string; pool: { name: string; tvl: number; volume24h: number; priceUsd: number | null } | null };
type LiveMarket = { price: number | null; liquidity: number | null; generatedAt: string; error?: string };

function money(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? "$" + value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}

function compact(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value >= 1_000_000 ? "$" + (value / 1_000_000).toFixed(2) + "M" : value >= 1_000 ? "$" + (value / 1_000).toFixed(1) + "K" : "$" + value.toFixed(0);
}

function PricePlot({ candles, currency }: { candles: Candle[]; currency: string }) {
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  if (closes.length < 2) return <div className="asset-chart-state"><strong>Price history is refreshing.</strong><span>A chart appears when live pool history is available.</span></div>;
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const range = high - low || 1;
  const points = closes.map((value, index) => `${(index / (closes.length - 1)) * 100},${90 - ((value - low) / range) * 72}`).join(" ");
  const area = `0,100 ${points} 100,100`;
  const label = (value: number) => currency === "USD" ? money(value) : value.toFixed(3) + " " + currency;

  return <div className="asset-chart-plot"><svg className="asset-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Selected stock price movement"><defs><linearGradient id="asset-chart-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14f195" stopOpacity=".32" /><stop offset="1" stopColor="#14f195" stopOpacity="0" /></linearGradient></defs><line x1="0" y1="18" x2="100" y2="18" /><line x1="0" y1="54" x2="100" y2="54" /><line x1="0" y1="90" x2="100" y2="90" /><polygon points={area} fill="url(#asset-chart-area)" /><polyline points={points} fill="none" stroke="#14f195" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="asset-chart-scale"><span>{label(high)}</span><span>{label(low)}</span></div></div>;
}

export function AssetPriceChart({ symbol, name, referencePrice }: { symbol: string; name: string; referencePrice: number | null }) {
  const [timeframe, setTimeframe] = useState<"1h" | "4h" | "24h">("24h");
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveMarket | null>(null);
  const [streamState, setStreamState] = useState("Connecting");

  useEffect(() => { const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"; const socket = new WebSocket(protocol + "//" + window.location.host + "/api/market-stream?symbol=" + encodeURIComponent(symbol)); socket.onopen = () => setStreamState("Live"); socket.onmessage = (event) => { const next = JSON.parse(event.data) as LiveMarket; if (next.error) { setStreamState("Reconnecting"); return; } setLive(next); setStreamState("Live"); }; socket.onerror = () => setStreamState("Reconnecting"); socket.onclose = () => setStreamState("Reconnecting"); return () => socket.close(); }, [symbol]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true); setError(null);
      try { const response = await fetch(`/api/analytics/${encodeURIComponent(symbol)}?timeframe=${timeframe}`, { cache: "no-store" }); if (!response.ok) throw new Error("Price history is temporarily unavailable."); const next = await response.json() as AnalyticsPayload; if (active) setPayload(next); }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Price history is temporarily unavailable."); }
      finally { if (active) setLoading(false); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [symbol, timeframe]);

  const change = useMemo(() => {
    const candles = payload?.candles ?? [];
    if (candles.length < 2 || candles[0].close <= 0) return null;
    return ((candles.at(-1)!.close - candles[0].close) / candles[0].close) * 100;
  }, [payload]);
  const displayPrice = live?.price ?? payload?.referencePrice ?? referencePrice;

  return <section className="asset-chart-card" id="chart" aria-label={`${symbol} price chart`}>
    <div className="asset-chart-head"><div><span className="eyebrow">Price chart</span><h2>{name}</h2><p>{payload?.pool?.name ?? "Live Solana pool history"}</p></div><div className="asset-chart-actions"><div className="asset-chart-price"><strong>{money(displayPrice)}</strong><span className={change === null ? "" : change >= 0 ? "is-up" : "is-down"}>{change === null ? "Updating" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% · ${timeframe}`}</span></div><Link className="asset-chart-alert" href={"/app/alerts?symbol=" + encodeURIComponent(symbol)}>Set watch</Link></div></div>
    <div className="asset-chart-controls" role="group" aria-label="Chart timeframe">{(["1h", "4h", "24h"] as const).map((item) => <button type="button" key={item} className={timeframe === item ? "is-active" : ""} onClick={() => setTimeframe(item)}>{item}</button>)}<span>{streamState === "Live" ? "Live stream" : loading ? "Refreshing" : streamState}</span></div>
    {error ? <div className="asset-chart-error" role="alert">{error}</div> : <PricePlot candles={payload?.candles ?? []} currency={payload?.chartCurrency ?? "USD"} />}
    <div className="asset-chart-foot"><span>Pool liquidity <strong>{compact(live?.liquidity ?? payload?.pool?.tvl)}</strong></span><span>24h volume <strong>{compact(payload?.pool?.volume24h)}</strong></span></div>
  </section>;
}
