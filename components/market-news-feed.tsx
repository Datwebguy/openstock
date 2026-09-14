"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/app/app/news/news.module.css";

type SymbolOption = { symbol: string; name: string };
type Item = { id: string; symbol: string | null; channel: "news" | "social"; source: string; author: string | null; headline: string; url: string; publishedAt: string };
type Feed = { items?: Item[]; social?: { bluesky: boolean }; failures?: string[]; error?: string };

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.round(hours / 24) + "d ago";
}

export function MarketNewsFeed({ symbols, symbol, compact = false }: { symbols: SymbolOption[]; symbol?: string; compact?: boolean }) {
  const [selected, setSelected] = useState(symbol ?? "all");
  const [mode, setMode] = useState<"all" | "news" | "social">("all");
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("Loading market context…");
  const [social, setSocial] = useState<{ bluesky: boolean }>({ bluesky: false });
  const load = useCallback(async () => {
    setStatus("Loading market context…");
    try {
      const query = selected === "all" ? "" : "?symbol=" + encodeURIComponent(selected);
      const response = await fetch("/api/news" + query, { cache: "no-store" });
      const payload = await response.json() as Feed;
      if (!response.ok) throw new Error(payload.error ?? "Market news is not ready right now.");
      setItems(payload.items ?? []); setSocial(payload.social ?? { bluesky: false });
      setStatus((payload.items?.length ?? 0) ? "Current reporting and social posts." : "No current stories were returned for this view.");
    } catch (error) { setItems([]); setStatus(error instanceof Error ? error.message : "Market news is not ready right now."); }
  }, [selected]);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => items.filter((item) => mode === "all" || item.channel === mode).slice(0, compact ? 5 : 18), [compact, items, mode]);
  return <section className={compact ? styles.compact : styles.feed} aria-live="polite">
    <div className={styles.feedHead}><div><div className="eyebrow">Market news</div><h2>{compact ? "What is being reported." : "News around the market."}</h2><p>{compact ? "Reporting and social context for this stock. Official issuer actions remain separate." : "Third-party reporting and social posts. Official issuer actions remain in their own feed."}</p></div>{compact ? <Link href="/app/news" className={styles.allLink}>All market news</Link> : <button className="button button--light" type="button" onClick={() => void load()}>Refresh</button>}</div>
    {!compact ? <div className={styles.controls}><label><span className="sr-only">Choose stock</span><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="all">All supported stocks</option>{symbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</select></label><div className={styles.filters} role="group" aria-label="News type"><button type="button" className={mode === "all" ? styles.active : ""} onClick={() => setMode("all")}>All</button><button type="button" className={mode === "news" ? styles.active : ""} onClick={() => setMode("news")}>Reporting</button><button type="button" className={mode === "social" ? styles.active : ""} onClick={() => setMode("social")}>Social</button></div></div> : null}
    <div className={styles.list}>{status.startsWith("Loading") ? [1, 2, 3].map((item) => <div className={styles.skeleton} key={item} />) : visible.map((item) => <a className={styles.item} key={item.id} href={item.url} target="_blank" rel="noreferrer"><div className={styles.itemMeta}><span>{item.channel === "news" ? "Reporting" : "Social"}</span><span>{item.source}{item.author ? " " + item.author : ""}</span><time dateTime={item.publishedAt}>{timeAgo(item.publishedAt)}</time></div><strong>{item.headline}</strong><span className={styles.open}>Open source ↗</span></a>)}</div>
    {!status.startsWith("Loading") && visible.length === 0 ? <p className={styles.empty}>{status}</p> : null}
    {!compact ? <div className={styles.note}><span>Social source: {social.bluesky ? "Bluesky connected" : "Bluesky unavailable"}.</span><span>News and posts are context, not trading advice.</span></div> : null}
  </section>;
}
