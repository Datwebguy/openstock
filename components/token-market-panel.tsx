"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shortWallet } from "@/components/wallet-session";

type Trade = { signature: string; time: number; side: "buy" | "sell"; trader: string; tokenAmount: number; quoteAmount: number; priceQuote: number; priceUsd: number | null; valueUsd: number | null };
type Window = { buys: number; sells: number; volumeUsd: number; change: number | null };
type Activity = {
  pool: { address: string; dexId: string | null; url: string | null; quoteSymbol: string };
  supply: number | null;
  lastPriceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  windows: Record<"m5" | "h1" | "h6" | "h24", Window> | null;
  trades: Trade[];
  scanned: number;
};
type Holder = { owner: string; uiAmount: number; pct: number };

const BUCKETS = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000 } as const;
type BucketKey = keyof typeof BUCKETS;
const WINDOW_LABELS = { m5: "5M", h1: "1H", h6: "6H", h24: "24H" } as const;

function usd(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value !== 0 && Math.abs(value) < 0.01) return `$${value.toPrecision(3)}`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(digits)}`;
}
function amount(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 });
}
function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Candles built from the on-chain trades (USD when the quote stock price is known, else in the stock). */
function buildCandles(trades: Trade[], bucket: number) {
  const ordered = [...trades].sort((a, b) => a.time - b.time);
  const candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
  for (const trade of ordered) {
    const price = trade.priceUsd ?? trade.priceQuote;
    const t = Math.floor(trade.time / bucket) * bucket;
    const last = candles.at(-1);
    if (last && last.t === t) {
      last.h = Math.max(last.h, price); last.l = Math.min(last.l, price); last.c = price; last.v += trade.valueUsd ?? 0;
    } else {
      candles.push({ t, o: last ? last.c : price, h: Math.max(price, last?.c ?? price), l: Math.min(price, last?.c ?? price), c: price, v: trade.valueUsd ?? 0 });
    }
  }
  return candles;
}

function CandleChart({ trades, bucket }: { trades: Trade[]; bucket: number }) {
  const candles = useMemo(() => buildCandles(trades, bucket).slice(-80), [trades, bucket]);
  if (candles.length === 0) {
    return <div className="token-chart-empty">No trades yet. The chart starts with the first buy.</div>;
  }
  const W = 720, H = 260, PAD_R = 64, VOL_H = 44;
  const hi = Math.max(...candles.map((c) => c.h)), lo = Math.min(...candles.map((c) => c.l));
  const span = hi - lo || hi * 0.1 || 1;
  const maxV = Math.max(...candles.map((c) => c.v), 1e-9);
  const step = (W - PAD_R) / Math.max(candles.length, 20);
  const y = (p: number) => 10 + (1 - (p - lo) / span) * (H - VOL_H - 24);
  const fmt = (p: number) => (p < 0.01 ? p.toPrecision(3) : p.toFixed(4));
  return (
    <svg className="token-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Price chart from on-chain trades">
      {[hi, lo + span / 2, lo].map((p) => (
        <g key={p}>
          <line x1={0} x2={W - PAD_R} y1={y(p)} y2={y(p)} className="token-chart-grid" />
          <text x={W - PAD_R + 6} y={y(p) + 4} className="token-chart-axis">{fmt(p)}</text>
        </g>
      ))}
      {candles.map((c, i) => {
        const x = i * step + step / 2;
        const up = c.c >= c.o;
        const bodyTop = y(Math.max(c.o, c.c)), bodyH = Math.max(1.5, Math.abs(y(c.o) - y(c.c)));
        const vH = (c.v / maxV) * (VOL_H - 6);
        return (
          <g key={c.t} className={up ? "is-up" : "is-down"}>
            <rect x={x - step * 0.35} y={H - vH} width={step * 0.7} height={vH} className="token-chart-vol" />
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} className="token-chart-wick" />
            <rect x={x - step * 0.32} y={bodyTop} width={step * 0.64} height={bodyH} className="token-chart-body" />
          </g>
        );
      })}
    </svg>
  );
}

export function TokenMarketPanel({ mint, symbol }: { mint: string; symbol: string }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [holders, setHolders] = useState<{ list: Holder[]; top10Pct: number } | null>(null);
  const [holdersError, setHoldersError] = useState("");
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const [bucket, setBucket] = useState<BucketKey>("5m");
  const [windowKey, setWindowKey] = useState<keyof typeof WINDOW_LABELS>("h24");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/token-activity?mint=${mint}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Trade data is unavailable right now.");
      setActivity(data); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Trade data is unavailable right now."); }
  }, [mint]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (tab !== "holders" || holders) return;
    fetch(`/api/token-holders?mint=${mint}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => { if (!ok) throw new Error(data.error); setHolders({ list: data.holders ?? [], top10Pct: data.top10Pct ?? 0 }); })
      .catch((err) => setHoldersError(err instanceof Error && err.message ? err.message : "Holder data is unavailable right now."));
  }, [tab, holders, mint]);

  const trades = activity?.trades ?? [];
  const win = activity?.windows?.[windowKey];
  const recentBuys = trades.filter((t) => t.side === "buy").length;
  const recentSells = trades.length - recentBuys;
  const buys = win ? win.buys : recentBuys, sells = win ? win.sells : recentSells;
  const buyPct = buys + sells > 0 ? (buys / (buys + sells)) * 100 : 50;

  return (
    <section className="token-market-panel">
      <div className="token-market-head">
        <div>
          <div className="token-market-kicker">Market</div>
          <div className="token-market-price">{usd(activity?.lastPriceUsd, 6)}</div>
          <div className="token-market-sub">
            Mcap {usd(activity?.marketCapUsd)} · Liquidity {usd(activity?.liquidityUsd)}
          </div>
        </div>
        <div className="token-market-buckets" role="group" aria-label="Candle size">
          {(Object.keys(BUCKETS) as BucketKey[]).map((key) => (
            <button key={key} type="button" className={bucket === key ? "is-active" : ""} onClick={() => setBucket(key)}>{key}</button>
          ))}
        </div>
      </div>

      {error && !activity ? <div className="token-chart-empty">{error}</div> : !activity ? <div className="token-chart-empty">Reading trades from Solana…</div> : <CandleChart trades={trades} bucket={BUCKETS[bucket]} />}

      <div className="token-market-windows">
        {(Object.keys(WINDOW_LABELS) as Array<keyof typeof WINDOW_LABELS>).map((key) => {
          const w = activity?.windows?.[key];
          return (
            <button key={key} type="button" className={windowKey === key ? "is-active" : ""} onClick={() => setWindowKey(key)}>
              <span>{WINDOW_LABELS[key]}</span>
              <strong className={w?.change && w.change < 0 ? "is-negative" : w?.change ? "is-positive" : ""}>{w?.change !== null && w?.change !== undefined ? `${w.change > 0 ? "+" : ""}${w.change.toFixed(2)}%` : "—"}</strong>
            </button>
          );
        })}
      </div>
      <div className="token-market-flow">
        <div className="token-market-flow__stat"><span>Txns</span><strong>{buys + sells}</strong></div>
        <div className="token-market-flow__stat"><span>Buys</span><strong className="is-positive">{buys}</strong></div>
        <div className="token-market-flow__stat"><span>Sells</span><strong className="is-negative">{sells}</strong></div>
        <div className="token-market-flow__stat"><span>Volume</span><strong>{usd(win?.volumeUsd ?? trades.reduce((s, t) => s + (t.valueUsd ?? 0), 0))}</strong></div>
        <div className="token-market-flow__bar" aria-hidden="true"><i style={{ width: `${buyPct}%` }} /></div>
      </div>

      <div className="token-market-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "trades"} className={tab === "trades" ? "is-active" : ""} onClick={() => setTab("trades")}>Trades</button>
        <button type="button" role="tab" aria-selected={tab === "holders"} className={tab === "holders" ? "is-active" : ""} onClick={() => setTab("holders")}>Holders</button>
      </div>

      {tab === "trades" ? (
        trades.length === 0 ? (
          <div className="token-market-empty">{activity ? "No trades yet." : error || "Loading trades…"}</div>
        ) : (
          <div className="token-market-table" role="table">
            <div className="token-market-row token-market-row--head" role="row"><span>Age</span><span>Type</span><span>USD</span><span>{symbol}</span><span>{activity?.pool.quoteSymbol}</span><span>Trader</span></div>
            {trades.slice(0, 60).map((t) => (
              <a key={t.signature} className={`token-market-row is-${t.side}`} role="row" href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer">
                <span>{ago(t.time)}</span>
                <span className="token-market-side">{t.side === "buy" ? "Buy" : "Sell"}</span>
                <span>{usd(t.valueUsd)}</span>
                <span>{amount(t.tokenAmount)}</span>
                <span>{amount(t.quoteAmount)}</span>
                <span className="token-market-trader">{shortWallet(t.trader)}</span>
              </a>
            ))}
          </div>
        )
      ) : holdersError ? (
        <div className="token-market-empty">{holdersError}</div>
      ) : !holders ? (
        <div className="token-market-empty">Loading holders…</div>
      ) : (
        <div className="token-market-table" role="table">
          <div className="token-market-holders-note">Top 10 hold {holders.top10Pct.toFixed(1)}% of supply{activity?.pool.address ? " · pool account included" : ""}</div>
          {holders.list.map((h, i) => (
            <a key={h.owner + i} className="token-market-row token-market-row--holder" role="row" href={`https://solscan.io/account/${h.owner}`} target="_blank" rel="noreferrer">
              <span>#{i + 1}</span>
              <span className="token-market-trader">{shortWallet(h.owner)}{h.owner === activity?.pool.address ? " · Pool" : ""}</span>
              <span>{amount(h.uiAmount)}</span>
              <span className="token-market-pct"><i style={{ width: `${Math.min(100, h.pct)}%` }} />{h.pct.toFixed(2)}%</span>
            </a>
          ))}
        </div>
      )}
      <div className="token-market-source">Trades read directly from Solana ({activity?.scanned ?? 0} latest pool transactions) · windows from DexScreener · refreshes every 20s</div>
    </section>
  );
}
