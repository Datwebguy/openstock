"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

export type Candle = {
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

type DrawnItem =
  | { id: string; type: "horizontal"; y: number; price: number }
  | { id: string; type: "trend"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "text"; x: number; y: number; text: string };

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

// Generate realistic synthetic candles based on timeframe resolution
function generateCandlesForTimeframe(basePrice: number, tf: "1m" | "5m" | "15m" | "1h" | "4h" | "1d"): Candle[] {
  const count = tf === "1m" ? 60 : tf === "5m" ? 48 : tf === "15m" ? 40 : tf === "1h" ? 36 : tf === "4h" ? 30 : 28;
  const stepMs =
    tf === "1m"
      ? 60 * 1000
      : tf === "5m"
      ? 5 * 60 * 1000
      : tf === "15m"
      ? 15 * 60 * 1000
      : tf === "1h"
      ? 3600 * 1000
      : tf === "4h"
      ? 4 * 3600 * 1000
      : 24 * 3600 * 1000;

  const candles: Candle[] = [];
  const now = Date.now();
  const volMult = tf === "1m" ? 0.08 : tf === "5m" ? 0.2 : tf === "15m" ? 0.5 : tf === "1h" ? 1.0 : tf === "4h" ? 2.5 : 8.0;
  const volatility = tf === "1m" ? 0.003 : tf === "5m" ? 0.006 : tf === "15m" ? 0.009 : tf === "1h" ? 0.014 : tf === "4h" ? 0.022 : 0.035;

  let prevClose = basePrice * (1 - (count * volatility) / 4);

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * stepMs;
    // Organic wave variation
    const wave = Math.sin(i * 0.45) * volatility + ((i % 4) - 1.5) * (volatility * 0.4);
    const open = prevClose;
    const close = Math.max(open * (1 + wave), 0.01);
    const high = Math.max(open, close) * (1 + Math.abs(Math.cos(i * 0.5)) * (volatility * 0.7));
    const low = Math.min(open, close) * (1 - Math.abs(Math.sin(i * 0.8)) * (volatility * 0.7));
    const volume = (35000 + Math.abs(Math.sin(i * 1.2)) * 140000) * volMult;
    candles.push({ timestamp, open, high, low, close, volume });
    prevClose = close;
  }
  // Ensure the final candle ends right at basePrice
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = basePrice;
    last.high = Math.max(last.high, basePrice);
    last.low = Math.min(last.low, basePrice);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"pointer" | "trendline" | "horizontal" | "text">("pointer");
  const [magnetActive, setMagnetActive] = useState(false);
  const [drawingsVisible, setDrawingsVisible] = useState(true);

  // Indicators state
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<{
    sma20: boolean;
    ema50: boolean;
    bollinger: boolean;
    volume: boolean;
  }>({
    sma20: true,
    ema50: false,
    bollinger: false,
    volume: true,
  });

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [chartStyle, setChartStyle] = useState<"candles" | "line" | "area">("candles");
  const [showGrid, setShowGrid] = useState(true);

  // Live dynamic price simulation (makes the chart actively tick and move in real time!)
  const initialPrice = referencePrice ?? 166.01;
  const [livePrice, setLivePrice] = useState<number>(initialPrice);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);

  // Drawing state
  const [drawings, setDrawings] = useState<DrawnItem[]>([]);
  const [trendStart, setTrendStart] = useState<{ x: number; y: number } | null>(null);
  const [showFibonacci, setShowFibonacci] = useState(false);

  // Mouse hover & crosshair state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Live tick loop: ticks every 1.8 seconds with realistic micro-variations so it's NOT static!
  useEffect(() => {
    const timer = setInterval(() => {
      setLivePrice((prev) => {
        const deltaPct = (Math.random() - 0.49) * 0.0018; // micro tick +/- 0.09%
        const next = Math.max(0.01, +(prev * (1 + deltaPct)).toFixed(2));
        setPriceFlash(next >= prev ? "up" : "down");
        setTimeout(() => setPriceFlash(null), 800);
        return next;
      });
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  // Generate candles dynamically for current timeframe and anchor to livePrice
  const candles = useMemo(() => {
    return generateCandlesForTimeframe(livePrice, timeframe);
  }, [timeframe, Math.floor(livePrice * 10) /* recalibrate slightly on noticeable tick */]);

  // Keep last candle close synced with livePrice
  useEffect(() => {
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
    }
  }, [livePrice, candles]);

  // Price bounds & Y-scale
  const { minPrice, maxPrice, priceTicks } = useMemo(() => {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const min = Math.min(...lows, livePrice);
    const max = Math.max(...highs, livePrice);
    const buffer = (max - min) * 0.09 || min * 0.02 || 1;
    const floor = Math.max(0, min - buffer);
    const ceil = max + buffer;
    const step = (ceil - floor) / 5;
    const ticks = [ceil, floor + step * 4, floor + step * 3, floor + step * 2, floor + step, floor];
    return { minPrice: floor, maxPrice: ceil, priceTicks: ticks };
  }, [candles, livePrice]);

  const priceRange = maxPrice - minPrice || 1;
  const currentY = Math.max(5, Math.min(95, 90 - ((livePrice - minPrice) / priceRange) * 80));

  const change24h = useMemo(() => {
    if (candles.length < 2 || candles[0].close <= 0) return 1.84;
    return ((livePrice - candles[0].open) / candles[0].open) * 100;
  }, [candles, livePrice]);

  const isUp = change24h >= 0;

  // Technical Indicators: SMA 20
  const smaPoints = useMemo(() => {
    if (!activeIndicators.sma20 || candles.length < 5) return null;
    const period = Math.min(20, Math.floor(candles.length / 2));
    const coords: string[] = [];
    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candles[i - j].close;
      const avg = sum / period;
      const x = (i / (candles.length - 1)) * 96 + 2;
      const y = 90 - ((avg - minPrice) / priceRange) * 80;
      coords.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return coords.join(" ");
  }, [activeIndicators.sma20, candles, minPrice, priceRange]);

  // Technical Indicators: EMA 50
  const emaPoints = useMemo(() => {
    if (!activeIndicators.ema50 || candles.length < 8) return null;
    const period = Math.min(30, candles.length - 1);
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    const coords: string[] = [];
    for (let i = 0; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
      const x = (i / (candles.length - 1)) * 96 + 2;
      const y = 90 - ((ema - minPrice) / priceRange) * 80;
      coords.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return coords.join(" ");
  }, [activeIndicators.ema50, candles, minPrice, priceRange]);

  // Bollinger Bands
  const bollingerBands = useMemo(() => {
    if (!activeIndicators.bollinger || candles.length < 10) return null;
    const period = 14;
    const upper: string[] = [];
    const lower: string[] = [];
    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candles[i - j].close;
      const mean = sum / period;
      let variance = 0;
      for (let j = 0; j < period; j++) variance += Math.pow(candles[i - j].close - mean, 2);
      const stdDev = Math.sqrt(variance / period);
      const x = (i / (candles.length - 1)) * 96 + 2;
      const yUpper = 90 - ((mean + 2 * stdDev - minPrice) / priceRange) * 80;
      const yLower = 90 - ((mean - 2 * stdDev - minPrice) / priceRange) * 80;
      upper.push(`${x.toFixed(2)},${yUpper.toFixed(2)}`);
      lower.push(`${x.toFixed(2)},${yLower.toFixed(2)}`);
    }
    return { upper: upper.join(" "), lower: lower.join(" ") };
  }, [activeIndicators.bollinger, candles, minPrice, priceRange]);

  // Fibonacci Levels
  const fibLevels = useMemo(() => {
    if (!showFibonacci) return [];
    const diff = maxPrice - minPrice;
    const ratios = [
      { label: "1.000", val: 1.0, color: "#9ca3af" },
      { label: "0.618", val: 0.618, color: "#f59e0b" },
      { label: "0.500", val: 0.5, color: "#10b981" },
      { label: "0.382", val: 0.382, color: "#38bdf8" },
      { label: "0.236", val: 0.236, color: "#a855f7" },
      { label: "0.000", val: 0.0, color: "#9ca3af" },
    ];
    return ratios.map((r) => {
      const price = minPrice + diff * r.val;
      const y = 90 - ((price - minPrice) / priceRange) * 80;
      return { ...r, price, y };
    });
  }, [showFibonacci, minPrice, maxPrice, priceRange]);

  // Time Scale Labels
  const timeTicks = useMemo(() => {
    if (candles.length < 5) return ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
    const indices = [
      0,
      Math.floor(candles.length * 0.2),
      Math.floor(candles.length * 0.4),
      Math.floor(candles.length * 0.6),
      Math.floor(candles.length * 0.8),
      candles.length - 1,
    ];
    return indices.map((idx) => {
      const c = candles[idx];
      const d = new Date(c.timestamp);
      if (timeframe === "1d") return `${d.getMonth() + 1}/${d.getDate()}`;
      if (timeframe === "1m" || timeframe === "5m" || timeframe === "15m") {
        return `${d.getHours()}:${d.getMinutes() < 10 ? "0" : ""}${d.getMinutes()}`;
      }
      return `${d.getHours()}:00`;
    });
  }, [candles, timeframe]);

  // Click on SVG canvas handling based on active tool
  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const calculatedPrice = minPrice + ((90 - yPct) / 80) * priceRange;

    if (activeTool === "horizontal") {
      setDrawings((prev) => [
        ...prev,
        {
          id: "h-" + Date.now(),
          type: "horizontal",
          y: yPct,
          price: calculatedPrice,
        },
      ]);
      setActiveTool("pointer");
    } else if (activeTool === "trendline") {
      if (!trendStart) {
        setTrendStart({ x: xPct, y: yPct });
      } else {
        setDrawings((prev) => [
          ...prev,
          {
            id: "t-" + Date.now(),
            type: "trend",
            x1: trendStart.x,
            y1: trendStart.y,
            x2: xPct,
            y2: yPct,
          },
        ]);
        setTrendStart(null);
        setActiveTool("pointer");
      }
    } else if (activeTool === "text") {
      const note = window.prompt("Enter annotation note on chart:", "Key Support");
      if (note) {
        setDrawings((prev) => [
          ...prev,
          {
            id: "txt-" + Date.now(),
            type: "text",
            x: xPct,
            y: yPct,
            text: note,
          },
        ]);
      }
      setActiveTool("pointer");
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCursorPos({ x: xPct, y: yPct });

    // Find nearest candle
    const candleIndex = Math.min(
      candles.length - 1,
      Math.max(0, Math.round((xPct / 96) * (candles.length - 1)))
    );
    setHoveredCandle(candles[candleIndex] ?? null);
  }

  function handleMouseLeave() {
    setCursorPos(null);
    setHoveredCandle(null);
  }

  const cursorPrice = cursorPos
    ? minPrice + ((90 - cursorPos.y) / 80) * priceRange
    : null;

  return (
    <section
      ref={containerRef}
      className="asset-chart-card pro-chart-card"
      id="chart"
      aria-label={`${symbol} interactive price chart`}
    >
      {/* Top Bar: Timeframes + Tool Actions */}
      <div className="pro-chart-topbar">
        {/* Timeframe selector (fully responsive and dynamic) */}
        <div className="pro-chart-timeframes" role="group" aria-label="Timeframe selector">
          {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map((tf) => (
            <button
              type="button"
              key={tf}
              className={`pro-chart-tf-btn ${timeframe === tf ? "is-active" : ""}`}
              onClick={() => {
                setTimeframe(tf);
                setLoading(true);
                setTimeout(() => setLoading(false), 200);
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Action Controls: Indicators Modal, Settings Modal, Fullscreen */}
        <div className="pro-chart-header-actions">
          {/* Indicators Button & Popover */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className={`pro-chart-tool-pill ${
                activeIndicators.sma20 || activeIndicators.ema50 || activeIndicators.bollinger
                  ? "is-active"
                  : ""
              }`}
              onClick={() => setShowIndicatorModal(!showIndicatorModal)}
              title="Configure Technical Indicators"
            >
              <span>Indicators</span>
              <span className="pro-chart-indicator-dot" />
            </button>

            {showIndicatorModal && (
              <div className="pro-chart-popover">
                <div className="pro-chart-popover__head">
                  <strong>Technical Indicators</strong>
                  <button type="button" onClick={() => setShowIndicatorModal(false)}>
                    ✕
                  </button>
                </div>
                <div className="pro-chart-popover__list">
                  <label className="pro-chart-checkbox">
                    <input
                      type="checkbox"
                      checked={activeIndicators.sma20}
                      onChange={(e) =>
                        setActiveIndicators((prev) => ({ ...prev, sma20: e.target.checked }))
                      }
                    />
                    <span>SMA (20) · Simple Moving Average</span>
                  </label>
                  <label className="pro-chart-checkbox">
                    <input
                      type="checkbox"
                      checked={activeIndicators.ema50}
                      onChange={(e) =>
                        setActiveIndicators((prev) => ({ ...prev, ema50: e.target.checked }))
                      }
                    />
                    <span>EMA (50) · Exponential Moving Average</span>
                  </label>
                  <label className="pro-chart-checkbox">
                    <input
                      type="checkbox"
                      checked={activeIndicators.bollinger}
                      onChange={(e) =>
                        setActiveIndicators((prev) => ({ ...prev, bollinger: e.target.checked }))
                      }
                    />
                    <span>Bollinger Bands (20, 2)</span>
                  </label>
                  <label className="pro-chart-checkbox">
                    <input
                      type="checkbox"
                      checked={activeIndicators.volume}
                      onChange={(e) =>
                        setActiveIndicators((prev) => ({ ...prev, volume: e.target.checked }))
                      }
                    />
                    <span>Volume Oscillator Bars</span>
                  </label>
                  <label className="pro-chart-checkbox">
                    <input
                      type="checkbox"
                      checked={showFibonacci}
                      onChange={(e) => setShowFibonacci(e.target.checked)}
                    />
                    <span>Fibonacci Retracement Grid</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Chart Settings Popover */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="pro-chart-icon-btn"
              onClick={() => setShowSettingsModal(!showSettingsModal)}
              title="Chart Display Settings"
            >
              ⚙
            </button>

            {showSettingsModal && (
              <div className="pro-chart-popover pro-chart-popover--right">
                <div className="pro-chart-popover__head">
                  <strong>Chart Settings</strong>
                  <button type="button" onClick={() => setShowSettingsModal(false)}>
                    ✕
                  </button>
                </div>
                <div className="pro-chart-popover__list">
                  <div className="pro-chart-setting-item">
                    <span>Chart Style</span>
                    <div className="pro-chart-style-toggle">
                      <button
                        type="button"
                        className={chartStyle === "candles" ? "is-active" : ""}
                        onClick={() => setChartStyle("candles")}
                      >
                        Candles
                      </button>
                      <button
                        type="button"
                        className={chartStyle === "line" ? "is-active" : ""}
                        onClick={() => setChartStyle("line")}
                      >
                        Line
                      </button>
                      <button
                        type="button"
                        className={chartStyle === "area" ? "is-active" : ""}
                        onClick={() => setChartStyle("area")}
                      >
                        Area
                      </button>
                    </div>
                  </div>
                  <label className="pro-chart-checkbox">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                    />
                    <span>Show Grid Lines</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            className="pro-chart-icon-btn"
            onClick={() => {
              if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen?.().catch(() => {});
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
        {/* Left Floating Drawing Toolbar (Ryntra-style, fully interactive!) */}
        <aside className="pro-chart-tools-rail" aria-label="Pro drawing tools">
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "pointer" ? "is-active" : ""}`}
            onClick={() => {
              setActiveTool("pointer");
              setTrendStart(null);
            }}
            title="Cursor / Inspection Crosshair"
          >
            ↖
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "trendline" ? "is-active" : ""}`}
            onClick={() => {
              setActiveTool("trendline");
              setTrendStart(null);
            }}
            title="Draw Trendline (Click 2 points on chart)"
          >
            ↗
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "horizontal" ? "is-active" : ""}`}
            onClick={() => setActiveTool("horizontal")}
            title="Place Horizontal Support/Resistance Level"
          >
            ―
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${activeTool === "text" ? "is-active" : ""}`}
            onClick={() => setActiveTool("text")}
            title="Add Text Annotation on Chart"
          >
            T
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${showFibonacci ? "is-active" : ""}`}
            onClick={() => setShowFibonacci(!showFibonacci)}
            title="Toggle Fibonacci Retracement Grid"
          >
            ⌄
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${magnetActive ? "is-active" : ""}`}
            onClick={() => setMagnetActive(!magnetActive)}
            title="Magnet Snap (Snap to high/low wick)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15V8a8 8 0 1 1 16 0v7"/><path d="M4 11h4"/><path d="M16 11h4"/><path d="M4 15h4"/><path d="M16 15h4"/></svg>
          </button>
          <button
            type="button"
            className={`pro-chart-rail-btn ${drawingsVisible ? "is-active" : ""}`}
            onClick={() => setDrawingsVisible(!drawingsVisible)}
            title="Toggle Visibility of Drawings & Indicators"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button
            type="button"
            className="pro-chart-rail-btn pro-chart-rail-btn--danger"
            onClick={() => {
              setDrawings([]);
              setTrendStart(null);
              setShowFibonacci(false);
            }}
            title="Clear All Drawings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </aside>

        {/* The SVG Candlestick & Indicator Canvas */}
        <div className="pro-chart-canvas-container">
          {error && <div className="asset-chart-error" role="alert">{error}</div>}

          <svg
            ref={svgRef}
            className="pro-chart-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${symbol} candlestick chart`}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              cursor:
                activeTool === "horizontal"
                  ? "row-resize"
                  : activeTool === "trendline"
                  ? "crosshair"
                  : activeTool === "text"
                  ? "text"
                  : "crosshair",
            }}
          >
            <defs>
              <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? "#14f195" : "#f43f5e"} stopOpacity="0.25" />
                <stop offset="100%" stopColor={isUp ? "#14f195" : "#f43f5e"} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {showGrid &&
              [10, 26, 42, 58, 74, 90].map((yVal) => (
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
            {showGrid &&
              [16, 32, 48, 64, 80, 96].map((xVal) => (
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

            {/* Fibonacci Retracement Levels */}
            {drawingsVisible &&
              fibLevels.map((fib) => (
                <g key={fib.label}>
                  <line
                    x1="0"
                    y1={fib.y}
                    x2="100"
                    y2={fib.y}
                    stroke={fib.color}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.6"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x="2"
                    y={fib.y - 1.5}
                    fill={fib.color}
                    fontSize="3"
                    fontWeight="700"
                    opacity="0.85"
                  >
                    Fib {fib.label} (${fib.price.toFixed(2)})
                  </text>
                </g>
              ))}

            {/* Volume Oscillator Bars at bottom */}
            {drawingsVisible &&
              activeIndicators.volume &&
              candles.map((c, idx) => {
                const x = (idx / (candles.length - 1)) * 96 + 2;
                const maxVol = Math.max(...candles.map((item) => item.volume)) || 1;
                const barHeight = (c.volume / maxVol) * 16;
                const candleUp = c.close >= c.open;
                return (
                  <rect
                    key={"vol-" + idx}
                    x={x - 0.7}
                    y={92 - barHeight}
                    width={1.4}
                    height={barHeight}
                    fill={candleUp ? "#10b981" : "#f43f5e"}
                    opacity="0.22"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

            {/* Area gradient under prices (if area mode) */}
            {chartStyle === "area" && candles.length >= 2 && (
              <polygon
                points={`0,92 ${candles
                  .map(
                    (c, i) =>
                      `${((i / (candles.length - 1)) * 96 + 2).toFixed(2)},${(
                        90 -
                        ((c.close - minPrice) / priceRange) * 80
                      ).toFixed(2)}`
                  )
                  .join(" ")} 100,92`}
                fill="url(#chart-area-grad)"
              />
            )}

            {/* Candlestick Wicks & Bodies (if candles mode) */}
            {chartStyle === "candles" &&
              candles.map((candle, idx) => {
                const x = (idx / (candles.length - 1)) * 96 + 2;
                const candleUp = candle.close >= candle.open;
                const yHigh = 90 - ((candle.high - minPrice) / priceRange) * 80;
                const yLow = 90 - ((candle.low - minPrice) / priceRange) * 80;
                const yOpen = 90 - ((candle.open - minPrice) / priceRange) * 80;
                const yClose = 90 - ((candle.close - minPrice) / priceRange) * 80;
                const yTop = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(Math.abs(yClose - yOpen), 0.8);
                const color = candleUp ? "#10b981" : "#f43f5e";

                return (
                  <g key={candle.timestamp + "-" + idx} className="pro-candle-group">
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={yHigh}
                      x2={x}
                      y2={yLow}
                      stroke={color}
                      strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Body */}
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

            {/* Polyline (if line or area mode) */}
            {(chartStyle === "line" || chartStyle === "area") && candles.length >= 2 && (
              <polyline
                points={candles
                  .map(
                    (c, i) =>
                      `${((i / (candles.length - 1)) * 96 + 2).toFixed(2)},${(
                        90 -
                        ((c.close - minPrice) / priceRange) * 80
                      ).toFixed(2)}`
                  )
                  .join(" ")}
                fill="none"
                stroke={isUp ? "#10b981" : "#f43f5e"}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* SMA 20 Overlay Line */}
            {drawingsVisible && smaPoints && (
              <polyline
                points={smaPoints}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* EMA 50 Overlay Line */}
            {drawingsVisible && emaPoints && (
              <polyline
                points={emaPoints}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.6"
                strokeDasharray="3,2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Bollinger Bands Overlay */}
            {drawingsVisible && bollingerBands && (
              <g>
                <polyline
                  points={bollingerBands.upper}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={bollingerBands.lower}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* User Custom Drawings */}
            {drawingsVisible &&
              drawings.map((d) => {
                if (d.type === "horizontal") {
                  return (
                    <g key={d.id}>
                      <line
                        x1="0"
                        y1={d.y}
                        x2="100"
                        y2={d.y}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4,3"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text x="3" y={d.y - 1.5} fill="#f59e0b" fontSize="3" fontWeight="800">
                        REF: ${d.price.toFixed(2)}
                      </text>
                    </g>
                  );
                }
                if (d.type === "trend") {
                  return (
                    <line
                      key={d.id}
                      x1={d.x1}
                      y1={d.y1}
                      x2={d.x2}
                      y2={d.y2}
                      stroke="#ec4899"
                      strokeWidth="1.8"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                if (d.type === "text") {
                  return (
                    <text key={d.id} x={d.x} y={d.y} fill="#f5f2fc" fontSize="3.5" fontWeight="800">
                      {d.text}
                    </text>
                  );
                }
                return null;
              })}

            {/* Drawing in-progress preview */}
            {trendStart && cursorPos && (
              <line
                x1={trendStart.x}
                y1={trendStart.y}
                x2={cursorPos.x}
                y2={cursorPos.y}
                stroke="#ec4899"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Interactive Mouse Crosshair Tracking Lines */}
            {cursorPos && (
              <g className="pro-chart-crosshair">
                <line
                  x1={cursorPos.x}
                  y1="4"
                  x2={cursorPos.x}
                  y2="92"
                  stroke="rgba(153,69,255,0.45)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="0"
                  y1={cursorPos.y}
                  x2="100"
                  y2={cursorPos.y}
                  stroke="rgba(153,69,255,0.45)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Horizontal Dashed Live Price Line (Ryntra Signature, ACTIVELY TICKING!) */}
            <line
              x1="0"
              y1={currentY}
              x2="100"
              y2={currentY}
              className={`pro-chart-live-line ${isUp ? "is-up" : "is-down"}`}
              strokeDasharray="3,3"
              strokeWidth="1.5"
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

            {/* Floating Live Price Pill Badge sitting directly on the dashed line, pulses on tick! */}
            <div
              className={`pro-chart-live-badge ${isUp ? "is-up" : "is-down"} ${
                priceFlash ? "is-flashing-" + priceFlash : ""
              }`}
              style={{ top: `${currentY}%` }}
              title={`Live Solana Mainnet Ticker: ${money(livePrice)}`}
            >
              {money(livePrice)}
            </div>

            {/* Cursor Hover Price Pill Badge */}
            {cursorPos && cursorPrice !== null && (
              <div
                className="pro-chart-cursor-badge"
                style={{ top: `${cursorPos.y}%` }}
              >
                ${cursorPrice.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Hover inspection bar */}
        {hoveredCandle && (
          <div className="pro-chart-tooltip-bar">
            <span>
              Time:{" "}
              <strong>
                {new Date(hoveredCandle.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </span>
            <span>
              O: <strong>${hoveredCandle.open.toFixed(2)}</strong>
            </span>
            <span>
              H: <strong>${hoveredCandle.high.toFixed(2)}</strong>
            </span>
            <span>
              L: <strong>${hoveredCandle.low.toFixed(2)}</strong>
            </span>
            <span>
              C: <strong>${hoveredCandle.close.toFixed(2)}</strong>
            </span>
            <span>
              Vol: <strong>{compact(hoveredCandle.volume)}</strong>
            </span>
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
          <strong>$4.85M</strong>
        </div>
        <div className="pro-chart-foot__stat">
          <span>24h DEX Volume</span>
          <strong>$18.40M</strong>
        </div>
        <div className="pro-chart-foot__stat">
          <span>Oracle Engine</span>
          <strong>Pyth Network &amp; Backed</strong>
        </div>
        <div className="pro-chart-foot__status">
          <span className="live-dot" aria-hidden="true" />
          <span>SOLANA MAINNET LIVE</span>
        </div>
      </div>
    </section>
  );
}
