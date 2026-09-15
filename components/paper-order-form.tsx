"use client";

import { FormEvent, useMemo, useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { formatAmount, uiToRaw } from "@/lib/scaled-amounts";
import { shortWallet, useWallet } from "@/components/wallet-session";

type Props = { symbol: string; name: string; price: number | null; solPriceUsd: number | null; priceIsIndicative: boolean; multiplier: number | null; decimals: number | null; halted: boolean; ready: boolean; liveTrading: boolean };
type Prepared = { transaction?: string; requestId?: string; lastValidBlockHeight?: number; multiplier?: number; decimals?: number; priceSource?: "official" | "onchain_pool"; error?: string };
type Executed = { status?: string; signature?: string; error?: string };

function rounded(value: number | null) { return value !== null && Number.isFinite(value) ? value.toFixed(4) + "×" : "PENDING"; }
function decode(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function encode(value: Uint8Array) { let binary = ""; for (let i = 0; i < value.length; i += 0x8000) binary += String.fromCharCode(...value.subarray(i, i + 0x8000)); return btoa(binary); }

export function PaperOrderForm({ symbol, name, price, solPriceUsd, priceIsIndicative, multiplier, decimals, halted, ready, liveTrading }: Props) {
  const { address: wallet, connect, signTransaction } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const numericShares = Number(shares);
  const conversion = useMemo(() => price !== null && multiplier !== null && decimals !== null && Number.isFinite(numericShares) && numericShares > 0 ? uiToRaw(numericShares, multiplier, decimals) : null, [decimals, multiplier, numericShares, price]);
  const canTrade = ready && !halted && Boolean(conversion) && price !== null;
  const estimatedUsd = price !== null && Number.isFinite(numericShares) && numericShares > 0 ? numericShares * price : null;
  const estimatedSol = estimatedUsd !== null && solPriceUsd !== null && solPriceUsd > 0 ? estimatedUsd / solPriceUsd : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canTrade || !conversion || price === null || multiplier === null || decimals === null) {
      setMessage(halted ? "Trading is paused for this stock." : price === null ? "Waiting for a live Solana quote." : "Waiting for market data.");
      return;
    }
    if (!liveTrading) {
      setSubmitting(true); setMessage(null);
      try {
        const id = crypto.randomUUID();
        const receipt = { id, mode: "review" as const, status: "review", symbol, name, side, uiAmount: conversion.uiAmount, baseAmount: conversion.baseAmount, rawAmount: conversion.rawAmount, multiplier, decimals, referencePrice: price, priceSource: priceIsIndicative ? "onchain_pool" : "official", createdAt: new Date().toISOString(), route: "Paper review", signature: null, wallet };
        localStorage.setItem("openstock:review:" + id, JSON.stringify(receipt));
        window.location.assign("/app/receipt/" + id);
      } catch (error) { setMessage(error instanceof Error ? error.message : "The review could not be saved."); } finally { setSubmitting(false); }
      return;
    }
    if (!wallet) {
      setSubmitting(true); setMessage(null);
      try { await connect(); } catch (error) { setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled."); } finally { setSubmitting(false); }
      return;
    }
    setSubmitting(true); setMessage(null);
    try {
      const preparedResponse = await fetch("/api/trade/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, side, shares: numericShares, wallet }) });
      const prepared = await preparedResponse.json() as Prepared;
      if (!preparedResponse.ok || !prepared.transaction || !prepared.requestId) throw new Error(prepared.error ?? "The live quote could not be prepared.");
      if (prepared.multiplier !== undefined && (multiplier === null || Math.abs(prepared.multiplier - multiplier) > 1e-12)) throw new Error("The share adjustment changed while your order was being prepared. Review the amount again.");
      if (prepared.decimals !== undefined && (decimals === null || prepared.decimals !== decimals)) throw new Error("The stock's share details changed while your order was being prepared. Review the amount again.");
      const signed = await signTransaction(VersionedTransaction.deserialize(decode(prepared.transaction)));
      const executeResponse = await fetch("/api/trade/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedTransaction: encode(signed.serialize()), requestId: prepared.requestId, lastValidBlockHeight: prepared.lastValidBlockHeight }) });
      const execution = await executeResponse.json() as Executed;
      if (!executeResponse.ok || execution.status !== "Success" || !execution.signature) throw new Error(execution.error ?? "The order was not confirmed. Your wallet was not charged by OpenStock.");
      const id = crypto.randomUUID();
      const receipt = { id, mode: "live" as const, status: "confirmed", symbol, name, side, uiAmount: conversion.uiAmount, baseAmount: conversion.baseAmount, rawAmount: conversion.rawAmount, multiplier, decimals, referencePrice: price, priceSource: prepared.priceSource ?? (priceIsIndicative ? "onchain_pool" : "official"), createdAt: new Date().toISOString(), route: "Jupiter Swap API v2", signature: execution.signature, wallet };
      localStorage.setItem("openstock:review:" + id, JSON.stringify(receipt));
      try { await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, wallet, signature: execution.signature, symbol, name, side, shares: conversion.uiAmount, referencePrice: price, multiplier, priceSource: receipt.priceSource }) }); } catch { /* The on-device receipt remains available if the server is offline. */ }
      window.location.assign("/app/receipt/" + id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The trade could not be completed."); } finally { setSubmitting(false); }
  }

  const buttonText = halted ? "HALT" : !canTrade ? "Quote pending" : submitting ? (!liveTrading ? "Saving" : !wallet ? "Connecting" : "Confirming") : !liveTrading ? "Save paper review" : !wallet ? "Connect wallet" : (side === "buy" ? "Buy " : "Sell ") + symbol;
  const totalLabel = side === "buy" ? "You pay" : "You receive";
  const totalValue = estimatedUsd === null ? "PENDING" : estimatedUsd.toFixed(2) + " USDC";
  const solValue = estimatedSol === null ? "Updating" : estimatedSol.toFixed(4) + " SOL";
  return <form className="paper-order" onSubmit={submit} aria-label={"Live order for " + symbol}>
    <div className="paper-order__head"><div><span className="eyebrow">Order</span><h3>{side === "buy" ? "Buy" : "Sell"} {symbol}</h3></div><span className="paper-order__safe">{shortWallet(wallet) ?? "NO WALLET"}</span></div>
    <div className="paper-order__toggle" role="group" aria-label="Order side"><button type="button" className={side === "buy" ? "is-active" : ""} onClick={() => setSide("buy")}>Buy</button><button type="button" className={side === "sell" ? "is-active" : ""} onClick={() => setSide("sell")}>Sell</button></div>
    <label>Shares<input inputMode="decimal" min="0" step="any" value={shares} onChange={(event) => { setShares(event.target.value); setMessage(null); }} /></label>
    <div className="paper-order__quote"><span>{totalLabel}</span><strong>{totalValue}</strong></div>
    <div className="paper-order__details"><span>SOL equivalent</span><strong>{solValue}</strong><span>Share adjustment</span><strong>{rounded(multiplier)}</strong></div>
    {message ? <p className="form-error" role="alert">{message}</p> : null}
    <button className="button button--light" type="submit" disabled={submitting || halted || !canTrade}>{buttonText}</button>
  </form>;
}
