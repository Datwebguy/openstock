"use client";

import { FormEvent, useMemo, useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { formatAmount, uiToRaw } from "@/lib/scaled-amounts";

type Props = { symbol: string; name: string; price: number | null; solPriceUsd: number | null; priceIsIndicative: boolean; multiplier: number | null; decimals: number | null; halted: boolean; ready: boolean };
type Wallet = { publicKey?: { toString: () => string } | null; connect: () => Promise<{ publicKey?: { toString: () => string } | null }>; signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction> };
type Prepared = { transaction?: string; requestId?: string; lastValidBlockHeight?: number; multiplier?: number; decimals?: number; priceSource?: "official" | "onchain_pool"; error?: string };
type Executed = { status?: string; signature?: string; error?: string };

function rounded(value: number | null) { return value !== null && Number.isFinite(value) ? value.toFixed(4) + "×" : "Calculating…"; }
function decode(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function encode(value: Uint8Array) { let binary = ""; for (let i = 0; i < value.length; i += 0x8000) binary += String.fromCharCode(...value.subarray(i, i + 0x8000)); return btoa(binary); }
function getWallet() { const browserWindow = window as Window & { solana?: Wallet; solflare?: Wallet }; return browserWindow.solana ?? browserWindow.solflare ?? null; }

export function PaperOrderForm({ symbol, name, price, solPriceUsd, priceIsIndicative, multiplier, decimals, halted, ready }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("1");
  const [wallet, setWallet] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const numericShares = Number(shares);
  const conversion = useMemo(() => price !== null && multiplier !== null && decimals !== null && Number.isFinite(numericShares) && numericShares > 0 ? uiToRaw(numericShares, multiplier, decimals) : null, [decimals, multiplier, numericShares, price]);
  const canTrade = ready && !halted && Boolean(conversion) && price !== null;
  const estimatedUsd = price !== null && Number.isFinite(numericShares) && numericShares > 0 ? numericShares * price : null;
  const estimatedSol = estimatedUsd !== null && solPriceUsd !== null && solPriceUsd > 0 ? estimatedUsd / solPriceUsd : null;

  async function connectWallet() {
    const provider = getWallet();
    if (!provider) { setMessage("Install Phantom or Solflare to continue."); return null; }
    try {
      const response = await provider.connect();
      const address = response.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;
      if (!address) { setMessage("Your wallet connected without an account. Choose an account and try again."); return null; }
      setWallet(address); setMessage(null); return { provider, address };
    } catch { setMessage("Wallet connection was cancelled."); return null; }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canTrade || !conversion || price === null || multiplier === null || decimals === null) {
      setMessage(halted ? "Trading is paused for this stock." : price === null ? "Waiting for a live Solana quote." : "Waiting for market data.");
      return;
    }
    if (!wallet) {
      setSubmitting(true); setMessage(null);
      try { await connectWallet(); } finally { setSubmitting(false); }
      return;
    }
    setSubmitting(true); setMessage(null);
    try {
      const provider = getWallet();
      const connected = provider ? { provider, address: wallet } : null;
      if (!connected) { setMessage("Reconnect your wallet before continuing."); return; }
      if (!connected.provider.signTransaction) { setMessage("This wallet cannot approve versioned orders. Open Phantom or Solflare and try again."); return; }
      const preparedResponse = await fetch("/api/trade/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, side, shares: numericShares, wallet: connected.address }) });
      const prepared = await preparedResponse.json() as Prepared;
      if (!preparedResponse.ok || !prepared.transaction || !prepared.requestId) throw new Error(prepared.error ?? "The live quote could not be prepared.");
      if (prepared.multiplier !== undefined && (multiplier === null || Math.abs(prepared.multiplier - multiplier) > 1e-12)) throw new Error("The share adjustment changed while your order was being prepared. Review the amount again.");
      if (prepared.decimals !== undefined && (decimals === null || prepared.decimals !== decimals)) throw new Error("The stock's share details changed while your order was being prepared. Review the amount again.");
      const signed = await connected.provider.signTransaction(VersionedTransaction.deserialize(decode(prepared.transaction)));
      const executeResponse = await fetch("/api/trade/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedTransaction: encode(signed.serialize()), requestId: prepared.requestId, lastValidBlockHeight: prepared.lastValidBlockHeight }) });
      const execution = await executeResponse.json() as Executed;
      if (!executeResponse.ok || execution.status !== "Success" || !execution.signature) throw new Error(execution.error ?? "The order was not confirmed. Your wallet was not charged by OpenStock.");
      const id = crypto.randomUUID();
      const receipt = { id, mode: "live" as const, status: "confirmed", symbol, name, side, uiAmount: conversion.uiAmount, baseAmount: conversion.baseAmount, rawAmount: conversion.rawAmount, multiplier, decimals, referencePrice: price, priceSource: prepared.priceSource ?? (priceIsIndicative ? "onchain_pool" : "official"), createdAt: new Date().toISOString(), route: "Jupiter Swap API v2", signature: execution.signature, wallet: connected.address };
      localStorage.setItem("openstock:review:" + id, JSON.stringify(receipt));
      try { await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, wallet: connected.address, signature: execution.signature, symbol, name, side, shares: conversion.uiAmount, referencePrice: price, multiplier, priceSource: receipt.priceSource }) }); } catch { /* The on-device receipt remains available if the server is offline. */ }
      window.location.assign("/app/receipt/" + id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The trade could not be completed."); } finally { setSubmitting(false); }
  }

  const buttonText = halted ? "Trading is paused" : !canTrade ? price === null ? "Waiting for onchain quote" : "Waiting for market data" : submitting ? (!wallet ? "Connecting wallet…" : "Confirming trade…") : !wallet ? "Connect wallet" : (side === "buy" ? "Buy " : "Sell ") + formatAmount(numericShares) + " shares";
  const totalLabel = side === "buy" ? "You pay" : "You receive";
  const totalValue = estimatedUsd === null ? "Waiting for a live quote" : estimatedUsd.toFixed(2) + " USDC";
  const solValue = estimatedSol === null ? "Updating" : estimatedSol.toFixed(4) + " SOL";
  return <form className="paper-order" onSubmit={submit} aria-label={"Live order for " + symbol}>
    <div className="paper-order__head"><div><span className="eyebrow">Order</span><h3>{side === "buy" ? "Buy" : "Sell"} {name}</h3></div><span className="paper-order__safe">{wallet ? wallet.slice(0, 4) + "…" + wallet.slice(-4) : "Wallet not connected"}</span></div>
    <div className="paper-order__toggle" role="group" aria-label="Order side"><button type="button" className={side === "buy" ? "is-active" : ""} onClick={() => setSide("buy")}>Buy</button><button type="button" className={side === "sell" ? "is-active" : ""} onClick={() => setSide("sell")}>Sell</button></div>
    <label>Shares<input inputMode="decimal" min="0" step="any" value={shares} onChange={(event) => { setShares(event.target.value); setMessage(null); }} /></label>
    <div className="paper-order__quote"><span>{totalLabel}</span><strong>{totalValue}</strong><small>{estimatedUsd === null ? "A live route is needed to calculate the total." : "Final amount is confirmed in your wallet."}</small></div>
    <div className="paper-order__details"><span>SOL equivalent</span><strong>{solValue}</strong><span>Share adjustment</span><strong>{rounded(multiplier)}</strong></div>
    {priceIsIndicative ? <p className="paper-order__note">This estimate uses live Solana liquidity because the issuer reference is paused.</p> : null}
    {solPriceUsd !== null ? <p className="paper-order__note">1 SOL ≈ {solPriceUsd.toFixed(2)} USDC</p> : null}
    {message ? <p className="form-error" role="alert">{message}</p> : null}
    <button className="button button--light" type="submit" disabled={submitting || halted || !canTrade}>{buttonText}</button>
  </form>;
}
