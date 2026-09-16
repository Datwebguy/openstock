"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/stock-logo";
import styles from "@/app/app/actions/actions.module.css";

type ActionEvent = { id: string; symbol: string; type: string; date: string | null; status: string; notes: string | null; amountUsd?: string | null; fromUnits?: string | null; toUnits?: string | null };
type ActionResponse = { events: ActionEvent[]; failedSymbols: string[]; generatedAt: string };
type AlertResponse = { watches?: Array<{ eventId: string }>; message?: string; error?: string };
type ActionSymbol = { symbol: string; name: string };

function typeLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("dividend")) return "Dividend";
  if (normalized.includes("split")) return value.toLowerCase().includes("reverse") ? "Reverse split" : "Split";
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
function dateLabel(value: string | null) {
  if (!value) return "Scheduled";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
function relativeDate(value: string | null) {
  if (!value) return "Upcoming";
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Effective";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "In " + days + " days";
}
function eventDetail(event: ActionEvent) {
  if (event.amountUsd) return "$" + Number(event.amountUsd).toFixed(2) + " gross dividend per share";
  if (event.fromUnits && event.toUnits) return event.fromUnits + " → " + event.toUnits + " share ratio";
  return "Event";
}

export function CorporateActionsWorkspace({ symbols }: { symbols: ActionSymbol[] }) {
  const [selected, setSelected] = useState("all");
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [failedSymbols, setFailedSymbols] = useState<string[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = selected === "all" ? "" : "?symbol=" + encodeURIComponent(selected);
      const response = await fetch("/api/corporate-actions" + query, { cache: "no-store" });
      const payload = await response.json() as ActionResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Events unavailable. Retry.");
      setEvents(payload.events);
      setFailedSymbols(payload.failedSymbols);
      setUpdatedAt(payload.generatedAt);
      setStatus(payload.events.length ? "" : "No events.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Events unavailable. Retry.");
      setStatus("Events unavailable. Retry.");
    } finally { setLoading(false); }
  }, [selected]);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const response = await fetch("/api/alerts", { cache: "no-store" });
        const payload = await response.json() as AlertResponse;
        if (!response.ok) throw new Error(payload.error ?? "Alerts unavailable.");
        setFollowed((payload.watches ?? []).map((watch) => watch.eventId));
      } catch { setStatus(""); }
    }
    void loadAlerts();
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function toggleFollow(event: ActionEvent) {
    const enabled = !followed.includes(event.id);
    const previous = followed;
    const next = enabled ? [event.id, ...followed] : followed.filter((item) => item !== event.id);
    setFollowed(next);
    setSavingId(event.id);
    try {
      const response = await fetch("/api/alerts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, symbol: event.symbol, enabled }) });
      const payload = await response.json() as AlertResponse;
      if (!response.ok) throw new Error(payload.error ?? "Follow failed. Retry.");
      setFollowed((payload.watches ?? []).map((watch) => watch.eventId));
      setStatus("Saved.");
    } catch (reason) {
      setFollowed(previous);
      setStatus(reason instanceof Error ? reason.message : "Follow failed. Retry.");
    } finally { setSavingId(null); }
  }

  const followedEvents = useMemo(() => events.filter((event) => followed.includes(event.id)), [events, followed]);

  return <section className={styles.workspace} aria-live="polite">
    <div className={styles.toolbar}><div><label htmlFor="action-symbol">Show events for</label><select id="action-symbol" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="all">All supported xStocks</option>{symbols.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select></div><button className="button button--light" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh feed"}</button></div>
    <div className={styles.stats}><div><span>Upcoming in view</span><strong>{loading ? "…" : events.length}</strong></div><div><span>Following</span><strong>{followedEvents.length}</strong></div><div><span>Feed status</span><strong className={error ? styles.warn : styles.good}>{error ? "Needs retry" : "Public data"}</strong></div></div>
    {error ? <div className={styles.error} role="alert"><strong>Events unavailable.</strong><button className="button button--light" type="button" onClick={() => void load()}>Retry</button></div> : null}
    {!error && !loading && events.length === 0 ? <div className={styles.empty}><div><h2>No events.</h2></div></div> : null}
    {!error && (loading || events.length > 0) ? <div className={styles.timeline}>{loading ? [1, 2, 3].map((item) => <div className={styles.skeleton} key={item} />) : events.map((event) => <article className={styles.event} key={event.id}><div className={styles.eventRail}><StockLogo symbol={event.symbol} size={46} /><span /></div><div className={styles.eventBody}><div className={styles.eventTop}><div><span className={styles.eventType}>{typeLabel(event.type)}</span><h2>{event.symbol}</h2></div><button type="button" className={followed.includes(event.id) ? styles.following : styles.follow} onClick={() => void toggleFollow(event)} disabled={savingId === event.id} aria-pressed={followed.includes(event.id)}>{savingId === event.id ? "Saving" : followed.includes(event.id) ? "Following" : "Follow"}</button></div><div className={styles.eventFacts}><strong>{relativeDate(event.date)}</strong><span>{dateLabel(event.date)}</span><span>{event.status}</span><span>{eventDetail(event)}</span></div></div></article>)}</div> : null}
    {status || updatedAt ? <div className={styles.footerNote}><div><p>{status}</p></div>{updatedAt ? <small>Updated {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> : null}</div> : null}
    {failedSymbols.length > 0 ? <p className={styles.partial}>Some feeds are unavailable.</p> : null}
  </section>;
}
