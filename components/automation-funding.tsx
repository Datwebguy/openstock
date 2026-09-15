"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { VersionedTransaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import styles from "@/app/app/automation/funding/funding.module.css";

type Kind = "limit" | "stop" | "oco" | "dca";
type Draft = { id: string; kind: Kind; symbol: string; side: "buy" | "sell"; shares: number; trigger?: number; takeProfit?: number; stopLoss?: number; cadence?: string; rounds?: number; createdAt: string };
type Quote = { pool?: { priceUsd?: number | null }; referencePrice?: number | null };
type Vault = { vaultPubkey?: string; userPubkey?: string };
type Balance = { fundingAsset: string; available: number; required: number; shortfall: number; sufficient: boolean; requiredRaw: string; decimals: number; multiplier?: number; source?: string };
type DepositPreview = { transaction?: string; requestId?: string; receiverAddress?: string; mint?: string; amount?: string; tokenDecimals?: number };
type ActiveOrder = { id?: string; txSignature?: string };

const labels: Record<Kind, string> = { limit: "Limit", stop: "Stop-loss", oco: "OCO", dca: "DCA" };

function money(value: number | null) { return value === null || !Number.isFinite(value) ? "Awaiting quote" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function decode(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function encode(value: Uint8Array) { let binary = ""; for (let index = 0; index < value.length; index += 0x8000) binary += String.fromCharCode(...value.subarray(index, index + 0x8000)); return btoa(binary); }

export function AutomationFunding() {
  const params = useSearchParams();
  const { address, connect, signTransaction } = useWallet();
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [deposit, setDeposit] = useState<DepositPreview | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("openstock:automation-drafts") ?? "[]") as Draft[];
      const requested = params.get("id");
      setDraft(saved.find((item) => item.id === requested) ?? null);
    } catch { setDraft(null); }
    setHydrated(true);
  }, [params]);

  useEffect(() => {
    if (!draft) return;
    fetch(`/api/analytics/${encodeURIComponent(draft.symbol)}?timeframe=1h`)
      .then((res) => res.ok ? res.json() as Promise<Quote> : Promise.reject(new Error("quote")))
      .then((data) => setPrice(data.pool?.priceUsd ?? data.referencePrice ?? null))
      .catch(() => setPrice(null));
  }, [draft]);

  useEffect(() => {
    if (!address) { setToken(null); return; }
    setToken(sessionStorage.getItem(`openstock:jupiter-token:${address}`));
  }, [address]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        let response = await fetch("/api/automation/vault", { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 404) response = await fetch("/api/automation/vault", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("vault");
        setVault(await response.json() as Vault);
      } catch { setVault(null); }
    })();
  }, [token]);

  const rounds = draft?.kind === "dca" ? Math.max(2, draft.rounds ?? 4) : 1;
  const estimate = draft && price !== null ? price * draft.shares * rounds : null;
  const requestedAmount = draft ? (draft.side === "buy" ? estimate : draft.shares * rounds) : null;

  useEffect(() => {
    if (!draft || !address || requestedAmount === null || !Number.isFinite(requestedAmount) || requestedAmount <= 0) { setBalance(null); return; }
    let cancelled = false;
    setBalanceLoading(true);
    setBalance(null);
    setDeposit(null);
    setActiveOrder(null);
    fetch(`/api/automation/balance?wallet=${encodeURIComponent(address)}&symbol=${encodeURIComponent(draft.symbol)}&side=${draft.side}&amount=${encodeURIComponent(String(requestedAmount))}`)
      .then((res) => res.ok ? res.json() as Promise<Balance> : res.json().then((data: { error?: string }) => Promise.reject(new Error(data.error ?? "Wallet balance could not be loaded."))))
      .then((data) => { if (!cancelled) setBalance(data); })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Wallet balance could not be loaded."); })
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [address, draft, requestedAmount]);

  const fundingAsset = draft?.side === "sell" ? draft.symbol : "USDC";
  const sentence = draft?.kind === "dca"
    ? `Fund ${draft.shares} ${draft.symbol} for ${rounds} ${draft.cadence ?? "weekly"} rounds.`
    : draft?.kind === "oco"
      ? `Exit ${draft.shares} ${draft.symbol} at ${draft.takeProfit ?? "take-profit"} or ${draft.stopLoss ?? "stop-loss"}.`
      : draft ? `${draft.side === "buy" ? "Buy" : "Sell"} ${draft.shares} ${draft.symbol} under this ${labels[draft.kind]} rule.` : "";

  async function onConnect() {
    try {
      const key = await connect();
      if (key) setMessage("Wallet connected. No funds moved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled."); }
  }

  async function prepareDeposit() {
    if (!draft || !address || !token || !balance?.sufficient || !vault?.vaultPubkey) return;
    setPreparing(true); setMessage("");
    try {
      const response = await fetch("/api/automation/deposit/craft", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ symbol: draft.symbol, side: draft.side, kind: draft.kind, userAddress: address, amount: balance.requiredRaw }) });
      const data = await response.json() as DepositPreview & { error?: string };
      if (!response.ok || !data.requestId || !data.transaction) throw new Error(data.error ?? "The deposit review could not be prepared.");
      setDeposit(data);
      setMessage("Deposit review ready. Nothing has been signed or sent.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The deposit review could not be prepared."); }
    finally { setPreparing(false); }
  }

  async function approveDeposit() {
    if (!draft || !address || !token || !deposit?.transaction || !deposit.requestId || !deposit.amount) return;
    setSigning(true); setMessage("");
    try {
      const unsigned = VersionedTransaction.deserialize(decode(deposit.transaction));
      const signed = await signTransaction(unsigned);
      const response = await fetch("/api/automation/order", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ symbol: draft.symbol, side: draft.side, kind: draft.kind, userAddress: address, depositRequestId: deposit.requestId, depositSignedTx: encode(signed.serialize()), inputAmount: deposit.amount, trigger: draft.trigger, takeProfit: draft.takeProfit, stopLoss: draft.stopLoss, cadence: draft.cadence, rounds }) });
      const result = await response.json() as ActiveOrder & { error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "The automation was not activated.");
      setActiveOrder(result);
      setMessage("Automation is active. The rule will wait for its trigger.");
      const saved = JSON.parse(localStorage.getItem("openstock:automation-orders") ?? "[]") as ActiveOrder[];
      localStorage.setItem("openstock:automation-orders", JSON.stringify([{ ...result, symbol: draft.symbol, kind: draft.kind, createdAt: new Date().toISOString() }, ...saved].slice(0, 50)));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Wallet approval was cancelled."); }
    finally { setSigning(false); }
  }

  if (!hydrated) return <div className={styles.page}><p>Loading funding…</p></div>;
  if (!draft) return <div className={styles.page}><div className={styles.empty}><div className={styles.eyebrow}>Funding review</div><h1>No rule selected.</h1><p>Choose a saved automation rule first. Nothing can be funded from this page.</p><Link className={styles.secondary} href="/app/automation">Back to automation</Link></div></div>;

  const authenticated = Boolean(token);
  const balanceLabel = !address ? "Connect wallet to check" : balanceLoading ? "Checking wallet…" : balance ? balance.available.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "Balance not loaded";
  const balanceTone = balance?.sufficient ? styles.balanceGood : balance && !balance.sufficient ? styles.balanceBad : "";
  const primary = activeOrder ? <button className={styles.primary} type="button" disabled>Rule active</button> : !address ? <button className={styles.primary} type="button" onClick={() => void onConnect()}>Connect wallet</button> : !authenticated ? <Link className={styles.primary} href={`/app/automation/review?id=${encodeURIComponent(draft.id)}`}>Authenticate wallet</Link> : !vault?.vaultPubkey ? <button className={styles.primary} type="button" disabled>Waiting for funding account</button> : balanceLoading || !balance ? <button className={styles.primary} type="button" disabled>Checking wallet balance…</button> : !balance.sufficient ? <button className={styles.primary} type="button" disabled>Need more {fundingAsset}</button> : !deposit ? <button className={styles.primary} type="button" onClick={prepareDeposit} disabled={preparing}>{preparing ? "Preparing review…" : "Prepare deposit review"}</button> : <button className={styles.primary} type="button" onClick={() => void approveDeposit()} disabled={signing}>{signing ? "Waiting for wallet approval…" : "Approve deposit in wallet"}</button>;

  return <div className={styles.page}>
    <div className={styles.top}><Link href={`/app/automation/review?id=${encodeURIComponent(draft.id)}`} className={styles.back}>← Rule review</Link><div className={styles.eyebrow}>Funding · {draft.symbol}</div></div>
    <header className={styles.hero}><div><div className={styles.eyebrow}>Before any transfer</div><h1>Fund<br />{draft.symbol}.</h1></div><p>Check the wallet amount first. Then review the exact deposit destination before anything can be signed.</p></header>
    <div className={styles.grid}>
      <section className={`${styles.panel} ${styles.details}`}>
        <div className={styles.identity}><StockLogo symbol={draft.symbol} size={50} /><div><strong>{draft.symbol}</strong><span>{labels[draft.kind]} · {draft.side === "buy" ? "Buy" : "Sell"}</span></div></div>
        <div className={styles.rule}><span>FUNDING RULE</span><strong>{sentence}</strong></div>
        <div className={styles.facts}><div className={styles.fact}><span>Funding asset</span><strong>{fundingAsset}</strong></div><div className={styles.fact}><span>Estimated value</span><strong>{money(estimate)}</strong></div><div className={styles.fact}><span>Shares covered</span><strong>{draft.shares}{draft.kind === "dca" ? ` × ${rounds}` : ""}</strong></div><div className={styles.fact}><span>Wallet</span><strong>{shortWallet(address) ?? "Not connected"}</strong></div></div>
        <div className={`${styles.balanceCard} ${balanceTone}`}><div><span>Wallet balance</span><strong>{balanceLabel} {balance && <small>{fundingAsset}</small>}</strong></div><div><span>Needed for this rule</span><strong>{balance ? `${balance.required.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${fundingAsset}` : "Waiting for wallet"}</strong></div>{balance && !balance.sufficient && <p>You need {balance.shortfall.toLocaleString(undefined, { maximumFractionDigits: 6 })} more {fundingAsset} before this rule can be funded.</p>}{balance?.multiplier && balance.multiplier !== 1 && <p>Your shares use the current {balance.multiplier.toFixed(4)}× share adjustment.</p>}</div>
        {vault?.vaultPubkey && <div className={`${styles.status} ${styles.ready}`}>Funding account ready · {vault.vaultPubkey.slice(0, 5)}…{vault.vaultPubkey.slice(-5)}</div>}
        {message && <p className={styles.status} role="status">{message}</p>}
        {deposit?.requestId && !activeOrder && <div className={styles.depositPreview}><div><span>Deposit review</span><strong>Ready for your wallet approval</strong></div><p>Destination {deposit.receiverAddress ? `${deposit.receiverAddress.slice(0, 5)}…${deposit.receiverAddress.slice(-5)}` : "resolved"} · Amount prepared</p><small>Reference {deposit.requestId}</small></div>}
        {activeOrder?.id && <div className={`${styles.depositPreview} ${styles.activePreview}`}><div><span>Automation active</span><strong>Waiting for the market trigger</strong></div><p>Rule ID {activeOrder.id}</p>{activeOrder.txSignature && <small>Deposit receipt {activeOrder.txSignature}</small>}</div>}
        <div className={styles.actions}>{primary}<Link href={`/app/automation/review?id=${encodeURIComponent(draft.id)}`} className={styles.secondary}>Back to rule</Link></div>
      </section>
      <aside className={`${styles.panel} ${styles.explain}`}><div className={styles.eyebrow}>Funding checks</div><h2>Nothing hidden.</h2><ul className={styles.checklist}><li className={address ? styles.ready : ""}>Wallet selected</li><li className={authenticated ? styles.ready : ""}>Wallet authentication</li><li className={vault?.vaultPubkey ? styles.ready : ""}>Funding account resolved</li><li className={balance?.sufficient ? styles.ready : ""}>Enough {fundingAsset}</li><li className={deposit ? styles.ready : ""}>Deposit review prepared</li><li className={activeOrder ? styles.ready : ""}>Rule activated</li></ul><div className={styles.notice}>{activeOrder ? "The rule is active and waiting for its trigger." : "Nothing is sent until you approve the deposit in your wallet."}</div></aside>
    </div>
  </div>;
}
