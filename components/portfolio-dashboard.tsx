"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/stock-logo";
import styles from "@/app/app/you/portfolio/portfolio.module.css";

type WalletProvider = { publicKey?: { toString: () => string } | null; connect: () => Promise<{ publicKey?: { toString: () => string } | null }> };
type Holding = { symbol: string; name: string; logo: string | null; shares: number; priceUsd: number | null; valueUsd: number | null; multiplier: number | null };
type Portfolio = { wallet: string; generatedAt: string; balances: { sol: { amount: number; priceUsd: number | null; valueUsd: number | null }; usdc: { amount: number; valueUsd: number | null } }; holdings: Holding[]; totalValueUsd: number | null; valueComplete: boolean; performance: { available: boolean; pnlUsd: number | null; since: string | null; snapshots: number; note: string } };

function shortWallet(wallet: string) { return wallet.slice(0, 5) + "…" + wallet.slice(-4); }
function money(value: number | null) { return value === null ? "Waiting for price" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function number(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value); }
function signedMoney(value: number | null) { if (value === null) return "Tracking"; return (value >= 0 ? "+" : "-") + money(Math.abs(value)); }

export function PortfolioDashboard() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const detectWallet = useCallback(() => {
    const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider };
    const address = browserWindow.solana?.publicKey?.toString() ?? browserWindow.solflare?.publicKey?.toString() ?? null;
    if (address) setWallet(address);
  }, []);

  useEffect(() => { detectWallet(); }, [detectWallet]);

  const loadPortfolio = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setMessage("Loading");
    try {
      const response = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet }), cache: "no-store" });
      const payload = await response.json() as Portfolio & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The portfolio could not be loaded.");
      setPortfolio(payload);
      setMessage(payload.valueComplete ? "Updated." : "Prices pending.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The portfolio could not be loaded.");
    } finally { setLoading(false); }
  }, [wallet]);

  useEffect(() => { if (wallet) void loadPortfolio(); }, [wallet, loadPortfolio]);
  useEffect(() => {
    if (!wallet) return;
    const timer = window.setInterval(() => void loadPortfolio(), 30_000);
    return () => window.clearInterval(timer);
  }, [wallet, loadPortfolio]);

  async function connect() {
    const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider };
    const provider = browserWindow.solana ?? browserWindow.solflare;
    if (!provider) { setMessage("Install Phantom or Solflare to connect."); return; }
    try {
      const result = await provider.connect();
      const address = result.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;
      if (address) setWallet(address);
    } catch { setMessage("Wallet connection was cancelled."); }
  }

  const allocationTotal = useMemo(() => portfolio?.totalValueUsd ?? 0, [portfolio]);
  const performance = portfolio?.performance ?? null;

  return <section className={styles.shell} aria-live="polite">
    {!wallet ? <div className={styles.connectCard}>
      <div className={styles.signalMark}>◒</div>
      <div><button className="button button--gradient" type="button" onClick={connect}>Connect wallet</button>{message ? <p className={styles.status}>{message}</p> : null}</div>
    </div> : <>
      <div className={styles.summary}>
        <div className={styles.summaryMain}><div className="eyebrow">Portfolio value</div><h2>{portfolio ? money(portfolio.totalValueUsd) : "Loading portfolio"}</h2><p>{shortWallet(wallet)} · {message}</p></div>
        <div className={styles.summaryActions}><span className={styles.readOnly}>Read-only view</span><button className="button button--light" type="button" onClick={() => void loadPortfolio()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      </div>
      <div className={styles.balanceRail}>
        <div><span>SOL</span><strong>{portfolio ? number(portfolio.balances.sol.amount) : "—"}</strong><small>{money(portfolio?.balances.sol.valueUsd ?? null)}</small></div>
        <div><span>USDC</span><strong>{portfolio ? number(portfolio.balances.usdc.amount) : "—"}</strong><small>{money(portfolio?.balances.usdc.valueUsd ?? null)}</small></div>
        <div><span>Tracked change</span><strong className={performance?.pnlUsd !== null && (performance?.pnlUsd ?? 0) < 0 ? styles.negative : styles.positive}>{performance ? signedMoney(performance.pnlUsd) : "Tracking"}</strong><small>{performance?.note ?? "Tracking starts after you connect."}</small></div>
      </div>
      <div className={styles.contentGrid}>
        <section className={styles.holdingsCard}><div className={styles.cardHeading}><div><div className="eyebrow">Assets in this wallet</div><h3>Holdings</h3></div><span>{portfolio?.holdings.length ?? 0} positions</span></div>
          {!portfolio ? <div className={styles.loadingList}>{[1, 2, 3].map((item) => <div className={styles.skeleton} key={item} />)}</div> : portfolio.holdings.length === 0 ? <div className={styles.empty}><strong>No holdings.</strong><Link className="button button--light" href="/app">Browse market</Link></div> : <div className={styles.holdingList}>{portfolio.holdings.map((holding) => { const share = allocationTotal > 0 && holding.valueUsd !== null ? (holding.valueUsd / allocationTotal) * 100 : null; return <div className={styles.holding} key={holding.symbol}><StockLogo symbol={holding.symbol} logo={holding.logo ?? undefined} size={44} /><div className={styles.holdingName}><strong>{holding.name}</strong><span>{holding.symbol} · {number(holding.shares)} shares</span></div><div className={styles.holdingValue}><strong>{money(holding.valueUsd)}</strong><span>{holding.priceUsd === null ? "PENDING" : money(holding.priceUsd) + " per share"}</span></div><div className={styles.allocation}><span>{share === null ? "—" : share.toFixed(1) + "%"}</span><i><b style={{ width: Math.min(100, share ?? 0) + "%" }} /></i></div></div>; })}</div>}
        </section>
        <aside className={styles.contextCard}><div className={styles.contextRows}><div><span>Wallet</span><strong>{shortWallet(wallet)}</strong></div><div><span>Updated</span><strong>{portfolio ? new Date(portfolio.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "PENDING"}</strong></div><div><span>Snapshots</span><strong>{portfolio ? portfolio.performance.snapshots : 0}</strong></div><div><span>Mode</span><strong>Read-only</strong></div></div><Link href="/app/analytics" className={styles.textLink}>Analyze</Link></aside>
      </div>
    </>}
  </section>;
}
