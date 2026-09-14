"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OrderActions } from "@/components/order-actions";
import styles from "@/app/app/orders/automation-monitor.module.css";

type RemoteOrder = { id?: string; orderType?: string; orderState?: string; userPubkey?: string; triggerCondition?: string; triggerPriceUsd?: number; tpPriceUsd?: number; slPriceUsd?: number; createdAt?: number | string; updatedAt?: number | string; events?: Array<{ type?: string; txSignature?: string; state?: string }> };
type LocalOrder = { id?: string; txSignature?: string; symbol?: string; kind?: string; createdAt?: string | number };
type DisplayOrder = RemoteOrder & LocalOrder;
type WalletProvider = { publicKey?: { toString: () => string } | null };

function currentWallet() { const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider }; return browserWindow.solana?.publicKey?.toString() ?? browserWindow.solflare?.publicKey?.toString() ?? null; }
function stateLabel(order: DisplayOrder) { const value = order.orderState ?? "pending"; return value.replaceAll("_", " "); }
function dateLabel(value?: number | string) { if (!value) return "Just now"; const parsed = new Date(typeof value === "number" ? value : value); return Number.isNaN(parsed.getTime()) ? "Just now" : parsed.toLocaleString(); }

export function AutomationMonitor() {
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const local = JSON.parse(localStorage.getItem("openstock:automation-orders") ?? "[]") as LocalOrder[];
      const address = currentWallet();
      const token = address ? sessionStorage.getItem(`openstock:jupiter-token:${address}`) : null;
      setToken(token);
      let remote: RemoteOrder[] = [];
      if (token) {
        const response = await fetch("/api/automation/history", { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Live history is not available yet.");
        const data = await response.json() as { orders?: RemoteOrder[] };
        remote = data.orders ?? [];
      }
      const localById = new Map(local.filter((item) => item.id).map((item) => [item.id as string, item]));
      const merged: DisplayOrder[] = [...remote.map((item) => ({ ...localById.get(item.id ?? ""), ...item })), ...local.filter((item) => item.id && !remote.some((remoteItem) => remoteItem.id === item.id))];
      merged.sort((left, right) => String(right.updatedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.createdAt ?? "")));
      setOrders(merged);
      setMessage(token ? "Live status synced." : merged.length ? "Showing this device’s activation records." : "");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Automation history could not be loaded."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 15000); return () => window.clearInterval(timer); }, [load]);

  const activeCount = useMemo(() => orders.filter((order) => ["pending", "open", "executing", "depositing", "active"].includes(order.orderState ?? "pending")).length, [orders]);
  return <section className={styles.monitor} aria-label="Automation monitor">
    <div className={styles.head}><div><div className={styles.eyebrow}>Automation monitor</div><h2>{activeCount ? `${activeCount} rule${activeCount === 1 ? "" : "s"} watching.` : "Rules stay visible."}</h2><p>Activation status refreshes from Jupiter when your wallet session is available.</p></div><button type="button" className={styles.refresh} onClick={() => void load(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>
    {message && <p className={styles.message} role="status">{message}</p>}
    {loading ? <div className={styles.empty}>Loading automation status…</div> : orders.length === 0 ? <div className={styles.empty}><strong>No automation rules yet.</strong><span>Build a limit, stop-loss, OCO, or DCA rule to see its lifecycle here.</span></div> : <div className={styles.list}>{orders.map((order) => <article className={styles.row} key={order.id ?? `${order.symbol}-${order.createdAt}`}><div className={styles.asset}><span className={styles.logo}>{order.symbol?.replace("x", "")?.slice(0, 2) ?? "OS"}</span><div><strong>{order.symbol ?? "Tokenized stock"}</strong><span>{order.kind ? order.kind.toUpperCase() : order.orderType === "dca" ? "DCA" : "PRICE RULE"} · {dateLabel(order.updatedAt ?? order.createdAt)}</span></div></div><div className={styles.condition}>{order.triggerPriceUsd ? `Trigger $${order.triggerPriceUsd.toFixed(2)}` : order.orderType === "dca" ? "Recurring schedule" : "Protected rule"}</div><span className={`${styles.status} ${styles[`status_${(order.orderState ?? "pending").replaceAll("_", "-")}`] ?? ""}`}>{stateLabel(order)}</span><div className={styles.receipt}>{order.txSignature ? `Receipt ${order.txSignature.slice(0, 6)}…${order.txSignature.slice(-4)}` : order.events?.find((event) => event.txSignature)?.txSignature ? `Receipt ${order.events.find((event) => event.txSignature)?.txSignature?.slice(0, 6)}…` : "Receipt pending"}</div><OrderActions order={order} token={token} onChanged={() => void load(true)} /></article>)}</div>}
  </section>;
}
