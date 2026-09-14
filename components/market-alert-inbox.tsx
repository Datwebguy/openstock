"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "@/app/app/alerts/alerts.module.css";

type Alert = { id: string; symbol: string; kind: "price" | "liquidity"; direction: "above" | "below"; threshold: number; currentValue: number; createdAt: string };
type InboxResponse = { alerts?: Alert[]; checked?: number; hits?: number; failures?: string[]; message?: string };

function amount(value: number) {
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MarketAlertInbox() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState("Checking your saved rules…");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/alerts/market/inbox", { cache: "no-store" });
      const payload = await response.json() as InboxResponse;
      if (!response.ok) throw new Error("Alerts could not be checked.");
      setAlerts(payload.alerts ?? []);
      setStatus(payload.message ?? "Watch rules checked.");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Alerts could not be checked."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <section className={styles.inbox} aria-live="polite">
    <div className={styles.inboxHead}><div><div className="eyebrow">Triggered alerts</div><h2>{alerts.length ? "A level needs your attention." : "Nothing has crossed a saved level."}</h2></div><button className="button button--light" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Checking…" : "Check now"}</button></div>
    {alerts.length ? <div className={styles.alertList}>{alerts.map((alert) => <article className={styles.alert} key={alert.id}><div><strong>{alert.symbol}</strong><p>{alert.kind === "price" ? "Price" : "Liquidity"} moved {alert.direction} {amount(alert.threshold)}. Current: {amount(alert.currentValue)}.</p></div><time dateTime={alert.createdAt}>{new Date(alert.createdAt).toLocaleString()}</time></article>)}</div> : <div className={styles.empty}>Saved watch rules are checked here while the app is open.</div>}
    <p className={styles.status}>{status}</p>
  </section>;
}
