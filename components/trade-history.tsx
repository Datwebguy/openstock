"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AutomationMonitor } from "@/components/automation-monitor";
import { AppFooterNav, AppNav } from "@/components/app-nav";

type TradeRecord = {
  id: string;
  mode: "review" | "live";
  status?: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  uiAmount: number;
  referencePrice: number;
  multiplier: number;
  createdAt: string;
  signature?: string | null;
};

export function TradeHistory({ title, filter }: { title: string; description?: string; filter?: "live" | "review" | "activity" }) {
  const [records, setRecords] = useState<TradeRecord[]>([]);
  useEffect(() => {
    try {
      const items: TradeRecord[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith("openstock:review:")) continue;
        const value = localStorage.getItem(key);
        if (!value) continue;
        const record = JSON.parse(value) as TradeRecord;
        if (!filter || filter === "activity" || (filter === "live" ? record.mode === "live" : record.mode === "review")) items.push(record);
      }
      items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      setRecords(items);
    } catch {
      setRecords([]);
    }
  }, [filter]);

  return <main className="page">
    <AppNav ctaHref="/app" ctaLabel="Market" />
    <div className="app-page container">
      <header className="app-market-header history-header"><div><h1>{title}</h1><p className="workspace-description">Follow your rules and revisit the details behind each order.</p></div></header>
      {filter === "live" || filter === "activity" ? <AutomationMonitor /> : null}
      {records.length === 0 ? <section className="panel empty-history"><h2>Your next move starts here.</h2><p>No saved order reviews in this browser yet. Explore a stock and review an order to start your activity trail.</p><Link className="button button--gradient" href="/app">Browse market</Link></section> : <section className="history-list" aria-label={title}>{records.map((record) => <Link href={"/app/receipt/" + record.id} className="history-row" key={record.id}><div><span className="history-row__ticker">{record.symbol}</span><h2>{record.side === "buy" ? "Buy" : "Sell"} {record.name}</h2><span className="history-row__meta">{new Date(record.createdAt).toLocaleString()} · {record.mode === "live" ? "Live trade" : "Review only"}</span></div><div className="history-row__right"><strong>{record.uiAmount} shares</strong><span>{record.status === "confirmed" ? "Confirmed" : record.mode === "live" ? "Submitted" : "Ready to confirm"}</span></div></Link>)}</section>}
    </div>
    <AppFooterNav />
  </main>;
}
