"use client";

import { useEffect, useMemo, useState } from "react";
import { displayPrice } from "@/lib/xstocks";

type SymbolOption = { symbol: string; name: string };
type Candle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
type AnalyticsPayload = { symbol: string; name: string; referencePrice: number | null; pool: { name: string; address: string; tvl: number; volume24h: number; priceUsd: number | null; poolCount: number; tokenXSymbol: string; tokenYSymbol: string } | null; candles: Candle[]; chartCurrency?: string; conversionLabel?: string; timeframe: string; generatedAt: string };

function money(value: number | null | undefined, digits = 2) { return typeof value === "number" && Number.isFinite(value) ? "$" + value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—"; }
function compact(value: number | null | undefined) { if (typeof value !== "number" || !Number.isFinite(value)) return "—"; return value >= 1000000 ? "$" + (value / 1000000).toFixed(2) + "M" : value >= 1000 ? "$" + (value / 1000).toFixed(1) + "K" : "$" + value.toFixed(0); }

function PriceChart({ candles, currency }: { candles: Candle[]; currency: string }) {
  const values = candles.map((candle) => candle.close).filter((value) => Number.isFinite(value));
  if (values.length < 2) return <div className="analytics-empty"><strong>Loading</strong></div>;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${92 - ((value - min) / range) * 78}`).join(" ");
  const area = `0,100 ${points} 100,100`;
  const format = (value: number) => currency === "USD" ? money(value) : value.toFixed(3) + " " + currency;
  return <div className="analytics-chart-wrap"><svg className="analytics-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Price movement chart"><defs><linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14f195" stopOpacity=".34" /><stop offset="1" stopColor="#14f195" stopOpacity="0" /></linearGradient></defs><line x1="0" y1="15" x2="100" y2="15" /><line x1="0" y1="53" x2="100" y2="53" /><line x1="0" y1="92" x2="100" y2="92" /><polygon points={area} fill="url(#analytics-area)" /><polyline points={points} fill="none" stroke="#14f195" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="analytics-chart-labels"><span>{format(max)}</span><span>{format(min)}</span></div></div>;
}

export function AnalyticsWorkspace({ symbols }: { symbols: SymbolOption[] }) {
  const [selected, setSelected] = useState(symbols[0]?.symbol ?? "AAPLx");
  const [timeframe, setTimeframe] = useState<"1h" | "4h" | "24h">("1h");
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { let active = true; setLoading(true); setError(null); fetch(`/api/analytics/${encodeURIComponent(selected)}?timeframe=${timeframe}`).then((response) => response.ok ? response.json() as Promise<AnalyticsPayload> : Promise.reject(new Error("Chart unavailable. Retry."))).then((next) => { if (active) setPayload(next); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Chart unavailable. Retry."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [selected, timeframe]);

  const change = useMemo(() => { const candles = payload?.candles ?? []; if (candles.length < 2) return null; const first = candles[0].close, last = candles[candles.length - 1].close; return first > 0 ? ((last - first) / first) * 100 : null; }, [payload]);
  const high = payload?.candles.length ? Math.max(...payload.candles.map((candle) => candle.high)) : null;
  const low = payload?.candles.length ? Math.min(...payload.candles.map((candle) => candle.low)) : null;
  const poolPremium = payload?.referencePrice && payload.pool?.priceUsd ? ((payload.pool.priceUsd - payload.referencePrice) / payload.referencePrice) * 100 : null;

  return <section className="analytics-workspace" aria-label="Stock analytics workspace">
    <div className="analytics-controls"><label>Asset<select value={selected} onChange={(event) => setSelected(event.target.value)}>{symbols.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select></label><div className="analytics-timeframes" role="group" aria-label="Chart timeframe">{(["1h", "4h", "24h"] as const).map((item) => <button type="button" className={timeframe === item ? "is-active" : ""} onClick={() => setTimeframe(item)} key={item}>{item}</button>)}</div><span className="analytics-refresh">{loading ? "Loading" : payload ? "Updated " + new Date(payload.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "PENDING"}</span></div>
    {error ? <div className="analytics-error" role="alert">{error}</div> : null}
    <div className="analytics-grid">
      <section className="analytics-chart-panel"><div className="analytics-panel-head"><div><h2>{payload?.name ?? selected}</h2></div><strong className="analytics-current-price">{payload?.referencePrice !== null && payload?.referencePrice !== undefined ? displayPrice(payload.referencePrice) : "PENDING"}</strong></div><PriceChart candles={payload?.candles ?? []} currency={payload?.chartCurrency ?? "pool units"} /><div className="analytics-chart-legend"><span><i className="legend-dot legend-dot--green" />Pool</span><span><i className="legend-dot legend-dot--purple" />Issuer</span></div></section>
      <aside className="analytics-side-panel"><h2>{change === null ? "PENDING" : (change >= 0 ? "+" : "") + change.toFixed(2) + "%"}</h2><div className="analytics-stat-list"><div><span>Window</span><strong>{change === null ? "—" : (change >= 0 ? "+" : "") + change.toFixed(2) + "%"}</strong></div><div><span>On-chain</span><strong>{money(payload?.pool?.priceUsd)}</strong></div><div><span>Gap</span><strong>{poolPremium === null ? "—" : (poolPremium >= 0 ? "+" : "") + poolPremium.toFixed(2) + "%"}</strong></div><div><span>Liquidity</span><strong>{compact(payload?.pool?.tvl)}</strong></div></div></aside>
    </div>
    <div className="analytics-metrics"><article><span>High</span><strong>{money(high)}</strong><small>Selected window</small></article><article><span>Low</span><strong>{money(low)}</strong><small>Selected window</small></article><article><span>24h pool volume</span><strong>{compact(payload?.pool?.volume24h)}</strong><small>{payload?.pool?.poolCount ?? 0} pools indexed</small></article><article><span>Route context</span><strong>{payload?.pool ? payload.pool.tokenXSymbol + " / " + payload.pool.tokenYSymbol : "Loading"}</strong><small>Primary liquidity pool</small></article></div>
    <p className="analytics-source-note">Pool candles, not the issuer print.</p>
  </section>;
}
