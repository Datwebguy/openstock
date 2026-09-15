"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import styles from "@/app/app/automation/review/review.module.css";

type Kind = "limit" | "stop" | "oco" | "dca";
type Draft = { id: string; kind: Kind; symbol: string; side: "buy" | "sell"; shares: number; trigger?: number; takeProfit?: number; stopLoss?: number; cadence?: string; rounds?: number; createdAt: string };
type Quote = { referencePrice?: number | null; pool?: { priceUsd?: number | null } };

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SP500" };
const labels: Record<Kind, string> = { limit: "Limit", stop: "Stop-loss", oco: "OCO", dca: "DCA" };
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array) { let digits = [0]; for (const byte of bytes) { let carry = byte; for (let i = 0; i < digits.length; i += 1) { const value = digits[i] * 256 + carry; digits[i] = value % 58; carry = Math.floor(value / 58); } while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); } } for (const byte of bytes) { if (byte !== 0) break; digits.push(0); } return digits.reverse().map((digit) => alphabet[digit]).join(""); }
function usd(value: number | null) { return value === null || !Number.isFinite(value) ? "Awaiting quote" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function AutomationReview() {
  const params = useSearchParams();
  const router = useRouter();
  const { address, connect, signMessage } = useWallet();
  const [hydrated, setHydrated] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [reference, setReference] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("openstock:automation-drafts") ?? "[]") as Draft[];
      const list = Array.isArray(saved) ? saved : [];
      const requested = params.get("id");
      const selected = list.find((item) => item.id === requested) ?? null;
      setDrafts(list);
      setDraft(selected);
    } catch {
      setDrafts([]);
      setDraft(null);
    } finally {
      setHydrated(true);
    }
  }, [params]);

  useEffect(() => {
    if (hydrated && !draft) router.replace("/app/automation");
  }, [draft, hydrated, router]);

  useEffect(() => {
    if (!draft) return;
    fetch(`/api/analytics/${encodeURIComponent(draft.symbol)}?timeframe=1h`)
      .then((response) => response.ok ? response.json() as Promise<Quote> : Promise.reject(new Error("quote")))
      .then((data) => { setPrice(data.pool?.priceUsd ?? null); setReference(data.referencePrice ?? null); })
      .catch(() => { setPrice(null); setReference(null); });
  }, [draft]);

  useEffect(() => {
    if (!address) { setToken(null); return; }
    setToken(sessionStorage.getItem(`openstock:jupiter-token:${address}`));
  }, [address]);

  const rounds = draft?.kind === "dca" ? Math.max(2, draft.rounds ?? 4) : 1;
  const amount = draft ? (price ?? reference) !== null ? (price ?? reference)! * draft.shares * rounds : null : null;
  const sentence = useMemo(() => {
    if (!draft) return "";
    if (draft.kind === "oco") return `Exit ${draft.shares} ${draft.symbol} at ${draft.takeProfit ?? "take-profit"} or ${draft.stopLoss ?? "stop-loss"}.`;
    if (draft.kind === "dca") return `Buy ${draft.shares} ${draft.symbol} every ${draft.cadence ?? "week"} for ${rounds} rounds.`;
    return `${draft.side === "buy" ? "Buy" : "Sell"} ${draft.shares} ${draft.symbol} when price reaches ${draft.trigger ?? "your level"}.`;
  }, [draft, rounds]);

  async function authenticate() {
    setBusy(true); setMessage("");
    try {
      const walletAddress = address ?? await connect();
      if (!walletAddress) throw new Error("Connect a wallet first.");
      const challengeResponse = await fetch("/api/automation/auth/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletPubkey: walletAddress, type: "message" }) });
      const challenge = await challengeResponse.json() as { challenge?: string; error?: string };
      if (!challengeResponse.ok || !challenge.challenge) throw new Error(challenge.error ?? "The authentication challenge could not be created.");
      const signature = await signMessage(new TextEncoder().encode(challenge.challenge));
      const verifyResponse = await fetch("/api/automation/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletPubkey: walletAddress, type: "message", signature: base58(signature) }) });
      const verified = await verifyResponse.json() as { token?: string; error?: string };
      if (!verifyResponse.ok || !verified.token) throw new Error(verified.error ?? "Wallet authentication was not completed.");
      sessionStorage.setItem(`openstock:jupiter-token:${walletAddress}`, verified.token);
      setToken(verified.token);
      setMessage("Wallet authenticated. Funding is still a separate approval.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated || !draft) return <div className={styles.page}><p className={styles.loading}>Loading rule…</p></div>;

  return <div className={styles.page}>
    <div className={styles.reviewTop}><Link href="/app/automation" className={styles.back}>← Automation</Link></div>
    {drafts.length > 1 ? <div className={styles.ruleStrip} aria-label="Saved automation rules"><span>Saved rules</span>{drafts.map((item) => <Link href={`/app/automation/review?id=${encodeURIComponent(item.id)}`} className={item.id === draft.id ? styles.ruleChipActive : styles.ruleChip} key={item.id}>{item.symbol}<small>{labels[item.kind]}</small></Link>)}</div> : null}
    <header className={styles.hero}>
      <div className={styles.eyebrow}>{names[draft.symbol] ?? draft.symbol} · {labels[draft.kind]}</div>
      <h1>Review {draft.symbol}</h1>
    </header>
    <div className={styles.grid}><section className={`${styles.panel} ${styles.details}`}><div className={styles.identity}><StockLogo symbol={draft.symbol} size={50} /><div><strong>{draft.symbol}</strong><span>{draft.side === "buy" ? "Buy" : "Sell"} · {draft.shares} shares</span></div></div><div className={styles.rule}><span>RULE</span><strong>{sentence}</strong></div><div className={styles.facts}><div><span>Estimated value</span><strong>{usd(amount)}</strong></div><div><span>Pool quote</span><strong>{usd(price)}</strong></div><div><span>Issuer reference</span><strong>{usd(reference)}</strong></div><div><span>Wallet</span><strong>{shortWallet(address) ?? "Not connected"}</strong></div></div>{message && <p className={styles.message} role="status">{message}</p>}<div className={styles.actions}><button className={styles.primary} type="button" onClick={token ? () => { window.location.href = `/app/automation/funding?id=${encodeURIComponent(draft.id)}`; } : () => void authenticate()} disabled={busy}>{busy ? "Connecting…" : token ? "Continue to funding" : address ? "Authenticate wallet" : "Connect wallet"}</button><Link href="/app/automation" className={styles.secondary}>Edit rule</Link></div></section><aside className={`${styles.panel} ${styles.explain}`}><div className={styles.eyebrow}>Activation path</div><h2>One clear next step.</h2><div className={styles.steps}><div className={`${styles.step} ${styles.active}`}><b>01</b><span>Review this {draft.symbol} rule.</span></div><div className={styles.step}><b>02</b><span>Authenticate wallet with a message.</span></div><div className={styles.step}><b>03</b><span>Review funding before any transfer.</span></div><div className={styles.step}><b>04</b><span>Monitor the rule and receipt.</span></div></div><div className={styles.notice}>Nothing is funded from this screen.</div></aside></div>
  </div>;
}
