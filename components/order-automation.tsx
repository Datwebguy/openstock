"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StockLogo } from "@/components/stock-logo";
import { useWallet } from "@/components/wallet-session";
import styles from "@/app/app/automation/automation.module.css";

type Kind = "limit" | "stop" | "oco" | "dca";
type Asset = { symbol: string; name: string };
type Draft = { id: string; kind: Kind; symbol: string; side: "buy" | "sell"; shares: number; trigger?: number; takeProfit?: number; stopLoss?: number; cadence?: string; rounds?: number; createdAt: string };
type Quote = { referencePrice?: number | null; pool?: { priceUsd?: number | null } };

const rules: Record<Kind, { label: string }> = {
  limit: { label: "Limit" },
  stop: { label: "Stop-loss" },
  oco: { label: "OCO" },
  dca: { label: "DCA" },
};

function usd(value: number | null) { return value === null || !Number.isFinite(value) ? "—" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function OrderAutomation({ assets }: { assets: Asset[] }) { const params = useSearchParams(); const router = useRouter(); const { address: wallet, connect } = useWallet(); const requestedAsset = params.get("asset"); const initialSymbol = assets.find((item) => item.symbol === requestedAsset)?.symbol ?? assets[0]?.symbol ?? "AAPLx";
  const requestedKind = params.get("kind"); const initialKind: Kind = requestedKind === "limit" || requestedKind === "stop" || requestedKind === "oco" || requestedKind === "dca" ? requestedKind : "limit";
  const requestedSide = params.get("side"); const initialSide: "buy" | "sell" = requestedSide === "sell" ? "sell" : "buy";
  const [kind, setKind] = useState<Kind>(initialKind); const [symbol, setSymbol] = useState(initialSymbol); const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [shares, setShares] = useState(params.get("shares") || "1"); const [trigger, setTrigger] = useState(params.get("trigger") || ""); const [takeProfit, setTakeProfit] = useState(""); const [stopLoss, setStopLoss] = useState(""); const [cadence, setCadence] = useState(params.get("cadence") || "weekly"); const [rounds, setRounds] = useState(params.get("rounds") || "4");
  const [price, setPrice] = useState<number | null>(null); const [reference, setReference] = useState<number | null>(null); const [drafts, setDrafts] = useState<Draft[]>([]); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const asset = assets.find((item) => item.symbol === symbol) ?? { symbol, name: symbol }; const amount = Number(shares); const roundCount = kind === "dca" ? Math.max(2, Number(rounds) || 0) : 1; const selectedSide = kind === "oco" ? "sell" : kind === "dca" ? "buy" : side; const current = price ?? reference; const estimated = current !== null && Number.isFinite(amount) && amount > 0 ? current * amount * roundCount : null;

  useEffect(() => { let cancelled = false; setLoading(true); setPrice(null); setReference(null); fetch(`/api/analytics/${encodeURIComponent(symbol)}?timeframe=1h`).then((response) => response.ok ? response.json() as Promise<Quote> : Promise.reject(new Error("quote"))).then((data) => { if (!cancelled) { setPrice(data.pool?.priceUsd ?? null); setReference(data.referencePrice ?? null); } }).catch(() => { if (!cancelled) { setPrice(null); setReference(null); } }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [symbol]);
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem("openstock:automation-drafts") ?? "[]") as Draft[]; setDrafts(Array.isArray(stored) ? stored : []); } catch { setDrafts([]); } }, []);

  const error = useMemo(() => { if (!Number.isFinite(amount) || amount <= 0) return "Add the amount this rule should control."; if (kind === "dca" && (!Number.isFinite(Number(rounds)) || Number(rounds) < 2)) return "Choose at least two DCA rounds."; if ((kind === "limit" || kind === "stop") && (!Number.isFinite(Number(trigger)) || Number(trigger) <= 0)) return "Set the price that should wake this rule."; if (kind === "oco") { const tp = Number(takeProfit); const sl = Number(stopLoss); if (!Number.isFinite(tp) || !Number.isFinite(sl) || tp <= 0 || sl <= 0) return "Set both exit levels."; if (tp <= sl) return "Take-profit must sit above stop-loss."; } return ""; }, [amount, kind, rounds, stopLoss, takeProfit, trigger]);
  async function reviewRule(event: FormEvent) {
    event.preventDefault();
    if (!wallet) {
      try { await connect(); setMessage("Wallet connected."); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Connection cancelled."); }
      return;
    }
    if (error) { setMessage(error); return; }
    const draft: Draft = { id: crypto.randomUUID(), kind, symbol, side: selectedSide, shares: amount, trigger: Number(trigger) || undefined, takeProfit: Number(takeProfit) || undefined, stopLoss: Number(stopLoss) || undefined, cadence, rounds: kind === "dca" ? roundCount : undefined, createdAt: new Date().toISOString() };
    const next = [draft, ...drafts].slice(0, 20);
    localStorage.setItem("openstock:automation-drafts", JSON.stringify(next));
    setDrafts(next);
    router.push("/app/automation/review?id=" + encodeURIComponent(draft.id));
  }
  const sentence = kind === "oco" ? `Exit ${amount || "—"} ${symbol} at ${takeProfit || "take-profit"} or ${stopLoss || "stop-loss"}.` : kind === "dca" ? `Buy ${amount || "—"} ${symbol} every ${cadence} for ${roundCount || "—"} rounds.` : `${selectedSide === "buy" ? "Buy" : "Sell"} ${amount || "—"} ${symbol} when price is ${kind === "stop" ? "below" : "at or below"} ${trigger || "your level"}.`;

  return <div className={styles.shell}>
    <header className={styles.hero}><Link href="/app" className={styles.back}>← Back to market</Link><div className={styles.heroGrid}><div><h1>Automate</h1><p className="workspace-description">Turn a condition into a rule. Review every detail before you activate it.</p></div></div></header>
    <section className={styles.stats} aria-label="Automation status"><div><span>Saved drafts</span><strong>{drafts.length}</strong></div><div><span>Funding</span><strong>On review</strong></div><div><span>Next step</span><strong>Review rule</strong></div><div><span>Wallet</span><strong>{wallet ? "Connected" : "NO WALLET"}</strong></div></section>
    <div className={styles.ruleTabs} role="tablist" aria-label="Automation rule type">{(Object.keys(rules) as Kind[]).map((item) => <button key={item} type="button" role="tab" aria-selected={kind === item} className={kind === item ? styles.active : ""} onClick={() => { setKind(item); if (item === "oco") setSide("sell"); if (item === "dca") setSide("buy"); setMessage(""); }}>{rules[item].label}</button>)}</div>
    <div className={styles.layout}>
      <form className={styles.builder} onSubmit={reviewRule}><div className={styles.panelTop}><div><h2>{rules[kind].label} rule</h2><p>{kind === "limit" ? "Set the price at which to place your order." : kind === "stop" ? "Define the level that triggers your stop-loss." : kind === "oco" ? "Pair a take-profit with a stop-loss exit." : "Spread a purchase across a recurring schedule."}</p></div><span className={wallet ? styles.connected : styles.pending}>{wallet ? "Connected" : "DRAFT"}</span></div><div className={styles.fields}><label>Asset<select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{assets.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select></label><label>Action<div className={styles.segmented}><button type="button" className={side === "buy" ? styles.active : ""} onClick={() => setSide("buy")}>Buy</button><button type="button" className={side === "sell" ? styles.active : ""} onClick={() => setSide("sell")}>Sell</button></div></label><label>Amount<input inputMode="decimal" value={shares} onChange={(event) => setShares(event.target.value)} min="0" step="any" /></label>{(kind === "limit" || kind === "stop") && <label>Wake at<input inputMode="decimal" value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder={current ? current.toFixed(2) : "Price"} min="0" step="any" /></label>}{kind === "oco" && <><label>Take-profit<input inputMode="decimal" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} placeholder="Price" min="0" step="any" /></label><label>Stop-loss<input inputMode="decimal" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} placeholder="Price" min="0" step="any" /></label></>}{kind === "dca" && <><label>Repeat<select value={cadence} onChange={(event) => setCadence(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Rounds<input inputMode="numeric" value={rounds} onChange={(event) => setRounds(event.target.value)} min="2" step="1" /></label></>}</div><div className={styles.quote}><div><span>Estimate</span><strong>{loading ? "PENDING" : usd(estimated)}</strong></div><div><span>On-chain</span><strong>{usd(price)}</strong></div><div><span>Issuer</span><strong>{usd(reference)}</strong></div></div>{message && <p className={styles.message} role="status">{message}</p>}<button className={styles.primary} type="submit">{wallet ? "Review rule" : "Connect wallet"}</button></form>
      <aside className={styles.monitor}><div className={styles.monitorHead}><div><h2>{symbol}</h2></div><StockLogo symbol={symbol} size={54} /></div><div className={styles.preview}><strong>{sentence}</strong></div><div className={styles.monitorFoot}><span>{asset.name}</span><strong>{loading ? "PENDING" : usd(current)}</strong></div></aside>
    </div>
    <section className={styles.queue}><div className={styles.queueHead}><div><h2>Rules</h2></div><span>{drafts.length}</span></div>{drafts.length === 0 ? <p>No saved rules yet. Configure a condition above, then review it before funding.</p> : <div className={styles.queueList}>{drafts.map((draft) => <Link href={`/app/automation/review?id=${encodeURIComponent(draft.id)}`} className={styles.queueRow} key={draft.id}><StockLogo symbol={draft.symbol} size={38} /><div><strong>{rules[draft.kind].label} · {draft.symbol}</strong><span>{draft.side === "buy" ? "Buy" : "Sell"} {draft.shares} shares · Review</span></div><em>Review →</em></Link>)}</div>}</section>
  </div>;
}
