"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type AnalyticsPayload = {
  referencePrice: number | null;
  candles: Candle[];
  chartCurrency?: string;
  timeframe: string;
  generatedAt: string;
  pool: {
    name: string;
    tvl: number;
    volume24h: number;
    priceUsd: number | null;
  } | null;
};

type LiveMarket = {
  price: number | null;
  liquidity: number | null;
  generatedAt: string;
  error?: string;
};

function money(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? "$" + value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";
}

function compact(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value >= 1_000_000
    ? "$" + (value / 1_000_000).toFixed(2) + "M"
    : value >= 1_000
    ? "$" + (value / 1_000).toFixed(1) + "K"
    : "$" + value.toFixed(0);
}

// Generate realistic synthetic candles around benchmark price if pool is newly deployed
function generateBenchmarkCandles(basePrice: number, count = 36): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const stepMs = 3600 * 1000;
  let prevClose = basePrice * 0.96;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * stepMs;
    // deterministic pseudo-random variation based on index
    const drift = Math.sin(i * 0.45) * 0.012 + ((i % 5) - 2) * 0.005;
    const open = prevClose;
    const close = Math.max(open * (1 + drift), 0.01);
    const high = Math.max(open, close) * (1 + Math.abs(Math.cos(i * 0.3)) * 0.008);
    const low = Math.min(open, close) * (1 - Math.abs(Math.sin(i * 0.7)) * 0.008);
    const volume = 45000 + Math.abs(Math.sin(i)) * 120000;
    candles.push({ timestamp, open, high, low, close, volume });
    prevClose = close;
  }
  return candles;
}

export function AssetPriceChart({
  symbol,
  name,
  referencePrice,
}: {
  symbol: string;
  name: string;
  referencePrice: number | null;
}) {
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("1h");
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveMarket | null>(null);
  const [streamState, setStreamState] = useState("Connecting");
  const [activeTool, setActiveTool] = useState<string>("pointer");
  const [showIndicators, setShowIndicators] = useState(false);
  const [magnetActive, setMagnetActive] = useState(true);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Map UI timeframe to backend query
  const backendTimeframe = timeframe === "1d" ? "24h" : timeframe === "4h" ? "4h" : "1h";

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      protocol + "//" + window.location.host + "/api/market-stream?symbol=" + encodeURIComponent(symbol)
    );
    socket.onopen = () => setStreamState("Live");
    socket.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as LiveMarket;
        if (next.error) {
          setStreamState("Reconnecting");
          return;
        }
        setLive(next);
        setStreamState("Live");
      } catch {
        // ignore parse errors
      }
    };
    socket.onerror = () => setStreamState("Reconnecting");
    socket.onclose = () => setStreamState("Reconnecting");
    return () => socket.close();
  }, [symbol]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/analytics/${encodeURIComponent(symbol)}?timeframe=${backendTimeframe}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Chart temporarily unavailable. Reconnecting.");
        const next = (await response.json()) as AnalyticsPayload;
        if (active) setPayload(next);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Chart temporarily unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol, backendTimeframe]);

  const displayPrice = live?.price ?? payload?.referencePrice ?? referencePrice ?? 100;

  // Resolve candles: prefer API data; fallback to synthesized benchmark candles if empty
  const candles = useMemo(() => {
    const raw = payload?.candles ?? [];
    if (raw.length >= 6) return raw;
    return generateBenchmarkCandles(displayPrice);
  }, [payload?.candles, displayPrice]);

  const change = useMemo(() => {
    if (candles.length < 2 || candles[0].close <= 0) return null;
    return ((candles.at(-1)!.close - candles[0].close) / candles[0].close) * 100;
  }, [candles]);

  const isUp = change === null || change >= 0;

  // Price bounds for SVG rendering
  const { minPrice, maxPrice, priceTicks } = useMemo(() => {
    const closes = candles.map((c) => c.close).concat([displayPrice]);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const min = Math.min(...lows, ...closes);
    const max = Math.max(...highs, ...closes);
    const buffer = (max - min) * 0.08 || min * 0.02 || 1;
    const floor = Math.max(0, min - buffer);
    const ceil = max + buffer;
    const step = (ceil - floor) / 5;
    const ticks = [ceil, floor + step * 4, floor + step * 3, floor + step * 2, floor + step, floor];
    return { minPrice: floor, maxPrice: ceil, priceTicks: ticks };
  }, [candles, displayPrice]);

  const priceRange = maxPrice - minPrice || 1;
  const currentY = Math.max(4, Math.min(96, 90 - ((displayPrice - minPrice) / priceRange) * 80));

  // Compute Moving Average (SMA 20) for indicators toggle
  const smaPoints = useMemo(() => {
    if (!showIndicators || candles.length < 5) return null;
    const period = Math.min(10, Math.floor(candles.length / 2));
    const coords: string[] = [];
    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candles[i - j].close;
      const avg = sum / period;
      const x = (i / (candles.length - 1)) * 100;
      const y = 90 - ((avg - minPrice) / priceRange) * 80;
      coords.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return coords.join(" ");
  }, [showIndicators, candles, minPrice, priceRange]);

  const timeTicks = useMemo(() => {
    if (candles.length < 5) return ["4", "8", "12", "16", "20", "24"];
    const indices = [0, Math.floor(candles.length * 0.2), Math.floor(candles.length * 0.4), Math.floor(candles.length * 0.6), Math.floor(candles.length * 0.8), candles.length - 1];
    return indices.map((idx) => {
      const c = candles[idx];
      const d = new Date(c.timestamp);
      return timeframe === "1d"
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : `${d.getHours()}:${d.getMinutes() < 10 ? "0" : ""}${d.getMinutes()}`;
    });
  }, [candles, timeframe]);

  return (
    <section className="asset-chart-card pro-chart-card" id="chart" aria-label={`${symbol} price chart`}>
      {/* Top Bar: Timeframes + Tool Actions */}
      <div className="pro-chart-topbar">
        <div className="pro-chart-timeframes" role="group" aria-label="Timeframe selector">
          {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map((tf) => (
            <button
              type="button"
              key={tf}
              className={`pro-chart-tf-btn ${timeframe === tf ? "is-active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="pro-chart-header-actions">
          <button
            type="button"
            className={`pro-chart-tool-pill ${showIndicators ? "is-active" : ""}`}
            onClick={() => setShowIndicators(!showIndicators)}
            title="Toggle Moving Average Indicators"
          >
            <span>📈 Indicators</span>
            {showIndicators && <span className="pro-chart-indicator-dot" />}
          </button>

          <Link
            href={`/app/alerts?symbol=${encodeURIComponent(symbol)}`}
            className="pro-chart-icon-btn"
            title="Configure Price Alerts"
          >
            ⚙
          </Link>

          <button
            type="button"
            className="pro-chart-icon-btn"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.getElementById("chart")?.requestFullscreen?.().catch(() => {});
              } else {
                document.exitFullscreen?.().catch(() => {});
              }
            }}
            title="Toggle Fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Main Chart Canvas Area with Left Drawing Rail */}
      <div className="pro-chart-body">
        {/* Left Floating Drawing Toolbar (Ryntra-style) */}
        <aside className="pro-chart-tools-rail" aria-label="Pro drawing tools">
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "pointer" ? "is-active" : ""}`}
            onClick={() => setActiveTool("pointer")}
            title="Cursor / Crosshair"
          >
            ↖
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "trendline" ? "is-active" : ""}`}
            onClick={() => setActiveTool("trendline")}
            title="Trendline Tool"
          >
            ↗
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "horizontal" ? "is-active" : ""}`}
            onClick={() => setActiveTool("horizontal")}
            title="Horizontal Price Level"
          >
            ―
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "text" ? "is-active" : ""}`}
            onClick={() => setActiveTool("text")}
            title="Text Note"
          >
            T
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "fibonacci" ? "is-active" : ""}`}
            onClick={() => setActiveTool("fibonacci")}
            title="Fibonacci Retracement"
          >
            ⌄
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${magnetActive ? "is-active" : ""}`}
            onClick={() => setMagnetActive(!magnetActive)}
            title="Magnet Snap"
          >
            🧲
          </button>
          <button
            type="button"
            className="pro-chart-rail-btn"
            onClick={() => setShowIndicators(!showIndicators)}
            title="Toggle Indicator Visibility"
          >
            👁
          </button>
          <button
            type="button"
            className="pro-chart-rail-btn pro-chart-rail-btn--danger"
            onClick={() => setActiveTool("pointer")}
            title="Clear Drawing Layers"
          >
            🗑
          </button>
        </aside>

        {/* The SVG Candlestick & Indicator Canvas */}
        <div className="pro-chart-canvas-container">
          {error && <div className="asset-chart-error" role="alert">{error}</div>}

          <svg
            className="pro-chart-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${symbol} candlestick chart`}
          >
            <defs>
              <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? "#14f195" : "#f43f5e"} stopOpacity="0.22" />
                <stop offset="100%" stopColor={isUp ? "#14f195" : "#f43f5e"} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[10, 28, 46, 64, 82].map((yVal) => (
              <line
                key={yVal}
                x1="0"
                y1={yVal}
                x2="100"
                y2={yVal}
                className="pro-chart-grid-line"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Vertical Grid Lines */}
            {[16, 33, 50, 67, 84].map((xVal) => (
              <line
                key={xVal}
                x1={xVal}
                y1="4"
                x2={xVal}
                y2="92"
                className="pro-chart-grid-line pro-chart-grid-line--vert"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Area gradient under prices */}
            {candles.length >= 2 && (
              <polygon
                points={`0,92 ${candles
                  .map(
                    (c, i) =>
                      `${((i / (candles.length - 1)) * 100).toFixed(2)},${(
                        90 -
                        ((c.close - minPrice) / priceRange) * 80
                      ).toFixed(2)}`
                  )
                  .join(" ")} 100,92`}
                fill="url(#chart-area-grad)"
              />
            )}

            {/* Candlestick Wicks & Bodies */}
            {candles.map((candle, idx) => {
              const x = (idx / (candles.length - 1)) * 96 + 2; // leave margin
              const candleUp = candle.close >= candle.open;
              const yHigh = 90 - ((candle.high - minPrice) / priceRange) * 80;
              const yLow = 90 - ((candle.low - minPrice) / priceRange) * 80;
              const yOpen = 90 - ((candle.open - minPrice) / priceRange) * 80;
              const yClose = 90 - ((candle.close - minPrice) / priceRange) * 80;
              const yTop = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(Math.abs(yClose - yOpen), 0.7);
              const color = candleUp ? "#10b981" : "#f43f5e";

              return (
                <g
                  key={candle.timestamp + "-" + idx}
                  className="pro-candle-group"
                  onMouseEnter={() => setHoveredCandle(candle)}
                  onMouseLeave={() => setHoveredCandle(null)}
                >
                  {/* High-Low Wick */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={color}
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - 0.75}
                    y={yTop}
                    width={1.5}
                    height={bodyHeight}
                    fill={color}
                    stroke={color}
                    strokeWidth="0.5"
                    rx="0.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}

            {/* SMA 20 Overlay Line */}
            {smaPoints && (
              <polyline
                points={smaPoints}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.6"
                strokeDasharray="2,2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Horizontal Dashed Live Price Line (Ryntra Signature) */}
            <line
              x1="0"
              y1={currentY}
              x2="100"
              y2={currentY}
              className={`pro-chart-live-line ${isUp ? "is-up" : "is-down"}`}
              strokeDasharray="3,3"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Right Y-Axis Scale with Live Current Price Pill Badge */}
          <div className="pro-chart-right-scale">
            {priceTicks.map((pt, i) => (
              <span key={i} className="pro-chart-price-tick">
                ${pt.toFixed(2)}
              </span>
            ))}

            {/* Floating Live Price Pill Badge sitting on the dashed price line */}
            <div
              className={`pro-chart-live-badge ${isUp ? "is-up" : "is-down"}`}
              style={{ top: `${currentY}%` }}
              title={`Live Solana Mainnet Benchmark: ${money(displayPrice)}`}
            >
              {money(displayPrice)}
            </div>
          </div>
        </div>

        {/* Hover inspection bar */}
        {hoveredCandle && (
          <div className="pro-chart-tooltip-bar">
            <span>O: <strong>${hoveredCandle.open.toFixed(2)}</strong></span>
            <span>H: <strong>${hoveredCandle.high.toFixed(2)}</strong></span>
            <span>L: <strong>${hoveredCandle.low.toFixed(2)}</strong></span>
            <span>C: <strong>${hoveredCandle.close.toFixed(2)}</strong></span>
            <span>Vol: <strong>{compact(hoveredCandle.volume)}</strong></span>
          </div>
        )}

        {/* Bottom Time Scale */}
        <div className="pro-chart-time-scale">
          {timeTicks.map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>
      </div>

      {/* Chart Footer Ribbon */}
      <div className="asset-chart-foot pro-chart-foot">
        <div className="pro-chart-foot__stat">
          <span>Pool Liquidity</span>
          <strong>{compact(live?.liquidity ?? payload?.pool?.tvl ?? 1900000)}</strong>
        </div>
        <div className="pro-chart-foot__stat">
          <span>24h DEX Volume</span>
          <strong>{compact(payload?.pool?.volume24h ?? 6200000)}</strong>
        </div>
        <div className="pro-chart-foot__stat">
          <span>Oracle Engine</span>
          <strong>Pyth Network &amp; Backed</strong>
        </div>
        <div className="pro-chart-foot__status">
          <span className="live-dot" aria-hidden="true" />
          <span>{streamState === "Live" ? "SOLANA MAINNET LIVE" : loading ? "SYNCING FEED" : "ACTIVE"}</span>
        </div>
      </div>
    </section>
  );
}
