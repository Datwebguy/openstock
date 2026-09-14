"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/app/alerts/alerts.module.css";

type SymbolOption = { symbol: string; name: string };
type Watch = { id: string; symbol: string; kind: "price" | "liquidity"; direction: "above" | "below"; threshold: number; enabled: boolean; updatedAt: string };
type Response = { watches?: Watch[]; message?: string; error?: string };

function label(symbols: SymbolOption[], symbol: string) {
  return symbols.find((item) => item.symbol === symbol)?.name ?? symbol;
}

export function MarketWatchWorkspace({ symbols, initialSymbol }: { symbols: SymbolOption[]; initialSymbol?: string }) {
  const fallback = symbols[0]?.symbol ?? "AAPLx";
  const [selected, setSelected] = useState(symbols.some((item) => item.symbol === initialSymbol) ? initialSymbol! : fallback);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [kind, setKind] = useState<"price" | "liquidity">("price");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [status, setStatus] = useState("Loading");
  const [saving, setSaving] = useState(false);

  async function load(symbol = selected) {
    try {
      const response = await fetch("/api/alerts/market?symbol=" + encodeURIComponent(symbol), { cache: "no-store" });
      const payload = await response.json() as Response;
      if (!response.ok) throw new Error(payload.error ?? "Watches unavailable. Retry.");
      setWatches(payload.watches ?? []);
      setStatus("");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Watches unavailable. Retry."); }
  }

  useEffect(() => { void load(); }, [selected]);

  const saved = useMemo(() => watches.find((watch) => watch.kind === kind) ?? null, [kind, watches]);
  useEffect(() => {
    if (saved) { setDirection(saved.direction); setThreshold(String(saved.threshold)); }
    else { setDirection(kind === "liquidity" ? "below" : "above"); setThreshold(""); }
  }, [kind, saved]);

  async function save(enabled: boolean) {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0) { setStatus("Enter a positive " + (kind === "price" ? "price in USDC" : "liquidity amount in USDC") + "."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/alerts/market", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: selected, kind, direction, threshold: value, enabled }) });
      const payload = await response.json() as Response;
      if (!response.ok) throw new Error(payload.error ?? "Watch failed. Retry.");
      setWatches(payload.watches ?? []);
      setStatus("Saved on this device.");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Watch failed. Retry."); }
    finally { setSaving(false); }
  }

  const unit = kind === "price" ? "USDC" : "USDC in liquidity";
  return <section className={styles.workspace} aria-live="polite">
    <div className={styles.selector}><label htmlFor="watch-symbol">Stock</label><select id="watch-symbol" value={selected} onChange={(event) => setSelected(event.target.value)}>{symbols.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select></div>
    <div className={styles.ruleTabs} role="group" aria-label="Watch type"><button type="button" className={kind === "price" ? styles.active : ""} onClick={() => setKind("price")}>Price</button><button type="button" className={kind === "liquidity" ? styles.active : ""} onClick={() => setKind("liquidity")}>Liquidity</button></div>
    <section className={styles.rule}>
      <div />
      <div className={styles.fields}><label>Condition<select value={direction} onChange={(event) => setDirection(event.target.value as "above" | "below")}><option value="above">Moves above</option><option value="below">Moves below</option></select></label><label>Value<span className={styles.inputUnit}><input value={threshold} onChange={(event) => setThreshold(event.target.value)} inputMode="decimal" placeholder={kind === "price" ? "e.g. 250" : "e.g. 10000"} /><span>{unit}</span></span></label></div>
      <div className={styles.actions}><button className="button button--gradient" type="button" onClick={() => void save(true)} disabled={saving}>{saving ? "Saving…" : saved ? "Update watch" : "Save watch"}</button>{saved ? <button className="button button--light" type="button" onClick={() => void save(false)} disabled={saving}>Remove</button> : null}</div>
    </section>
    <p className={styles.status}>{status}</p>
  </section>;
}
