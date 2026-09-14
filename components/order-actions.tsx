"use client";

import { useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import styles from "@/app/app/orders/automation-monitor.module.css";

type Order = { id?: string; orderType?: string; orderState?: string; triggerPriceUsd?: number; tpPriceUsd?: number; slPriceUsd?: number };
type WalletProvider = { publicKey?: { toString: () => string } | null; signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction> };

function provider() { const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider }; return browserWindow.solana ?? browserWindow.solflare ?? null; }
function decode(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function encode(value: Uint8Array) { let binary = ""; for (let index = 0; index < value.length; index += 0x8000) binary += String.fromCharCode(...value.subarray(index, index + 0x8000)); return btoa(binary); }

export function OrderActions({ order, token, onChanged }: { order: Order; token: string | null; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [trigger, setTrigger] = useState(order.triggerPriceUsd?.toString() ?? "");
  const [takeProfit, setTakeProfit] = useState(order.tpPriceUsd?.toString() ?? "");
  const [stopLoss, setStopLoss] = useState(order.slPriceUsd?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!order.id || !token) return null;
  const orderId = order.id;
  const authToken = token;
  const priceRule = order.orderType === "single" || order.orderType === "oco";
  const editable = priceRule && ["open", "active"].includes(order.orderState ?? "");
  const cancellable = ["open", "active"].includes(order.orderState ?? "");

  async function update() {
    if (!editable) return;
    const orderType = order.orderType === "oco" ? "oco" : "single";
    const payload = orderType === "oco" ? { orderType, tpPriceUsd: Number(takeProfit), slPriceUsd: Number(stopLoss) } : { orderType, triggerPriceUsd: Number(trigger), slippageBps: 100 };
    if (Object.values(payload).some((value) => typeof value === "number" && !Number.isFinite(value))) { setMessage("Enter a valid price first."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/automation/order/${encodeURIComponent(orderId)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The rule could not be updated.");
      setEditing(false); setMessage("Rule updated."); onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The rule could not be updated."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!cancellable) return;
    const current = provider();
    if (!current?.signTransaction) { setMessage("Connect a wallet that can approve versioned transactions."); return; }
    setBusy(true); setMessage("");
    try {
      const orderType = order.orderType === "dca" ? "dca" : "price";
      const start = await fetch(`/api/automation/order/${encodeURIComponent(orderId)}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ orderType: order.orderType === "dca" ? "dca" : "single" }) });
      const cancelData = await start.json() as { transaction?: string; requestId?: string; error?: string };
      if (!start.ok || !cancelData.transaction || !cancelData.requestId) throw new Error(cancelData.error ?? "The withdrawal review could not be prepared.");
      const signed = await current.signTransaction(VersionedTransaction.deserialize(decode(cancelData.transaction)));
      const finish = await fetch(`/api/automation/order/${encodeURIComponent(orderId)}/confirm-cancel`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ orderType, signedTransaction: encode(signed.serialize()), cancelRequestId: cancelData.requestId }) });
      const result = await finish.json() as { txSignature?: string; error?: string };
      if (!finish.ok || !result.txSignature) throw new Error(result.error ?? "The cancellation was not confirmed.");
      setMessage("Rule cancelled and remaining funds returned."); onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cancellation was cancelled."); }
    finally { setBusy(false); }
  }

  return <div className={styles.orderActions}>
    <div className={styles.actionButtons}>{editable && <button type="button" className={styles.actionButton} onClick={() => setEditing((value) => !value)} disabled={busy}>{editing ? "Close" : "Edit"}</button>}{cancellable && <button type="button" className={`${styles.actionButton} ${styles.cancelButton}`} onClick={cancel} disabled={busy}>{busy ? "Waiting…" : "Cancel"}</button>}</div>
    {editing && <div className={styles.editPanel}>{order.orderType === "oco" ? <><label>Take-profit<input inputMode="decimal" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} /></label><label>Stop-loss<input inputMode="decimal" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} /></label></> : <label>Trigger price<input inputMode="decimal" value={trigger} onChange={(event) => setTrigger(event.target.value)} /></label>}<button type="button" className={styles.saveButton} onClick={update} disabled={busy}>{busy ? "Saving…" : "Save change"}</button></div>}
    {message && <span className={styles.actionMessage} role="status">{message}</span>}
  </div>;
}
