"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StockLogo } from "@/components/stock-logo";
import { CURATED_SYMBOLS } from "@/lib/xstocks";
import styles from "@/app/app/automation/review/review.module.css";

type Kind = "limit" | "stop" | "oco" | "dca";
type Draft = { id: string; kind: Kind; symbol: string; side: "buy" | "sell"; shares: number; trigger?: number; takeProfit?: number; stopLoss?: number; cadence?: string; rounds?: number; createdAt: string };
type Wallet = { publicKey?: { toString: () => string } | null; connect: () => Promise<{ publicKey?: { toString: () => string } | null }>; signMessage?: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }> };
type Quote = { referencePrice?: number | null; pool?: { priceUsd?: number | null } };

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SP500" };
const labels: Record<Kind, string> = { limit: "Limit", stop: "Stop-loss", oco: "OCO", dca: "DCA" };
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array) { let digits = [0]; for (const byte of bytes) { let carry = byte; for (let i = 0; i < digits.length; i += 1) { const value = digits[i] * 256 + carry; digits[i] = value % 58; carry = Math.floor(value / 58); } while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); } } for (const byte of bytes) { if (byte !== 0) break; digits.push(0); } return digits.reverse().map((digit) => alphabet[digit]).join(""); }
function wallet() { const current = window as Window & { solana?: Wallet; solflare?: Wallet }; return current.solana ?? current.solflare ?? null; }
function usd(value: number | null) { return value === null || !Number.isFinite(value) ? "Awaiting quote" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function AutomationReview() {
  const params = useSearchParams();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [reference, setReference] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("openstock:automation-drafts") ?? "[]") as Draft[];
      const requested = params.get("id");
      const selected = saved.find((item) => item.id === requested) ?? saved[0];
      setDrafts(Array.isArray(saved) ? saved : []);
      setSelectedId(selected?.id ?? "");
    } catch { setDrafts([]); setSelectedId(""); }
  }, [params]);

  useEffect(() => { setDraft(drafts.find((item) => item.id === selectedId) ?? null); }, [drafts, selectedId]);
  useEffect(() => { if (!draft) return; fetch(`/api/analytics/${encodeURIComponent(draft.symbol)}?timeframe=1h`).then((response) => response.ok ? response.json() as Promise<Quote> : Promise.reject(new Error("quote"))).then((data) => { setPrice(data.pool?.priceUsd ?? null); setReference(data.referencePrice ?? null); }).catch(() => { setPrice(null); setReference(null); }); }, [draft]);
  useEffect(() => { if (!address) return; setToken(sessionStorage.getItem(`openstock:jupiter-token:${address}`)); }, [address]);

  const rounds = draft?.kind === "dca" ? Math.max(2, draft.rounds ?? 4) : 1;
  const amount = draft ? (price ?? reference) !== null ? (price ?? reference)! * draft.shares * rounds : null : null;
  const sentence = useMemo(() => { if (!draft) return ""; if (draft.kind === "oco") return `Exit ${draft.shares} ${draft.symbol} at ${draft.takeProfit ?? "take-profit"} or ${draft.stopLoss ?? "stop-loss"}.`; if (draft.kind === "dca") return `Buy ${draft.shares} ${draft.symbol} every ${draft.cadence ?? "week"} for ${rounds} rounds.`; return `${draft.side === "buy" ? "Buy" : "Sell"} ${draft.shares} ${draft.symbol} when price reaches ${draft.trigger ?? "your level"}.`; }, [draft, rounds]);

  async function connect() { const provider = wallet(); if (!provider) { setMessage("Install Phantom or Solflare to connect."); return null; } try { const result = await provider.connect(); const key = result.publicKey?.toString() ?? provider.publicKey?.toString(); if (!key) throw new Error("Choose an account in your wallet and try again."); setAddress(key); setMessage("Wallet connected. No funds moved."); return { provider, key }; } catch (error) { setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled."); return null; } }
  async function authenticate() { if (!address) { await connect(); return; } setBusy(true); setMessage(""); try { const provider = wallet(); if (!provider?.signMessage) throw new Error("This wallet does not support message signing."); const challengeResponse = await fetch("/api/automation/auth/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletPubkey: address, type: "message" }) }); const challenge = await challengeResponse.json() as { challenge?: string; error?: string }; if (!challengeResponse.ok || !challenge.challenge) throw new Error(challenge.error ?? "The authentication challenge could not be created."); const signed = await provider.signMessage(new TextEncoder().encode(challenge.challenge)); const signature = signed instanceof Uint8Array ? signed : signed.signature; const verifyResponse = await fetch("/api/automation/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletPubkey: address, type: "message", signature: base58(signature) }) }); const verified = await verifyResponse.json() as { token?: string; error?: string }; if (!verifyResponse.ok || !verified.token) throw new Error(verified.error ?? "Wallet authentication was not completed."); sessionStorage.setItem(`openstock:jupiter-token:${address}`, verified.token); setToken(verified.token); setMessage("Wallet authenticated. Funding is still a separate approval."); } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication was cancelled."); } finally { setBusy(false); } }

  if (!draft) return <div className={styles.page}><div className={styles.empty}><div className={styles.eyebrow}>Automation review</div><h1>Pick a saved rule.</h1><p>Build a rule for any supported stock, then return here to review that specific asset before authentication or funding.</p><div className={styles.stockGrid}>{CURATED_SYMBOLS.map((symbol) => <Link href={`/app/automation?asset=${encodeURIComponent(symbol)}`} className={styles.stockOption} key={symbol}><StockLogo symbol={symbol} size={34} /><span><strong>{symbol}</strong><small>{names[symbol] ?? symbol}</small></span><em>Build rule →</em></Link>)}</div><Link href="/app/automation" className={styles.secondary}>Open automation desk</Link></div></div>;

  return <div className={styles.page}>
    <div className={styles.reviewTop}><Link href="/app/automation" className={styles.back}>← Automation</Link><div className={styles.eyebrow}>Review · {draft.symbol}</div></div>
    <div className={styles.ruleStrip} aria-label="Saved automation rules"><span>Saved rules</span>{drafts.map((item) => <Link href={`/app/automation/review?id=${encodeURIComponent(item.id)}`} className={item.id === draft.id ? styles.ruleChipActive : styles.ruleChip} key={item.id}>{item.symbol}<small>{labels[item.kind]}</small></Link>)}</div>
    <header className={styles.hero}><div><div className={styles.eyebrow}>{names[draft.symbol] ?? draft.symbol} · {labels[draft.kind]}</div><h1>Review<br />{draft.symbol}.</h1></div><p>Check the rule, size, and live context before you authenticate or fund it.</p></header>
    <div className={styles.grid}><section className={`${styles.panel} ${styles.details}`}><div className={styles.identity}><StockLogo symbol={draft.symbol} size={50} /><div><strong>{draft.symbol}</strong><span>{draft.side === "buy" ? "Buy" : "Sell"} · {draft.shares} shares</span></div></div><div className={styles.rule}><span>RULE</span><strong>{sentence}</strong></div><div className={styles.facts}><div><span>Estimated value</span><strong>{usd(amount)}</strong></div><div><span>Pool quote</span><strong>{usd(price)}</strong></div><div><span>Issuer reference</span><strong>{usd(reference)}</strong></div><div><span>Wallet</span><strong>{address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "Not connected"}</strong></div></div>{message && <p className={styles.message} role="status">{message}</p>}<div className={styles.actions}><button className={styles.primary} type="button" onClick={token ? () => { window.location.href = `/app/automation/funding?id=${encodeURIComponent(draft.id)}`; } : authenticate} disabled={busy}>{busy ? "Connecting…" : token ? "Continue to funding" : address ? "Authenticate wallet" : "Connect wallet"}</button><Link href="/app/automation" className={styles.secondary}>Edit rule</Link></div></section><aside className={`${styles.panel} ${styles.explain}`}><div className={styles.eyebrow}>Activation path</div><h2>One clear next step.</h2><div className={styles.steps}><div className={`${styles.step} ${styles.active}`}><b>01</b><span>Review this {draft.symbol} rule.</span></div><div className={styles.step}><b>02</b><span>Authenticate wallet with a message.</span></div><div className={styles.step}><b>03</b><span>Review funding before any transfer.</span></div><div className={styles.step}><b>04</b><span>Monitor the rule and receipt.</span></div></div><div className={styles.notice}>Nothing is funded from this screen.</div></aside></div>
  </div>;
}
