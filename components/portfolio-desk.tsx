"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Connection, Transaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { useWallet, shortWallet } from "@/components/wallet-session";
import type { CreatorVaultItem, RoyaltyClaimReceipt } from "@/lib/creator-royalties";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

interface HoldingItem {
  symbol: string;
  name: string;
  logo: string | null;
  shares: number;
  rawTokens?: number;
  multiplier?: number | null;
  priceUsd: number | null;
  valueUsd: number | null;
  change24h?: number;
}

interface PortfolioData {
  totalValueUsd: number;
  balances: {
    sol: { amount: number; valueUsd: number | null };
    usdc: { amount: number | null; valueUsd: number | null };
  };
  holdings: HoldingItem[];
  performance?: {
    available: boolean;
    pnlUsd: number | null;
    since: string | null;
    snapshots: number;
    note: string;
  };
}

interface RoyaltiesData {
  vaults: (CreatorVaultItem & { stockPriceUsd: number; stockChange24h: number | null; unclaimedUsd: number; claimedUsd: number })[];
  claims: RoyaltyClaimReceipt[];
  summary: {
    totalUnclaimedUsd: number;
    totalClaimedUsd: number;
    vaultCount: number;
    activeQuotes: string[];
  };
}

const EMPTY_PORTFOLIO: PortfolioData = {
  totalValueUsd: 0,
  balances: {
    sol: { amount: 0, valueUsd: 0 },
    usdc: { amount: 0, valueUsd: 0 },
  },
  holdings: [],
};

const EMPTY_ROYALTIES: RoyaltiesData = {
  vaults: [],
  claims: [],
  summary: {
    totalUnclaimedUsd: 0,
    totalClaimedUsd: 0,
    vaultCount: 0,
    activeQuotes: [],
  },
};

export function PortfolioDesk() {
  const { address, connect, connecting } = useWallet();
  const [activeTab, setActiveTab] = useState<"royalties" | "holdings" | "history">("royalties");
  const [portfolio, setPortfolio] = useState<PortfolioData>(EMPTY_PORTFOLIO);
  const [royalties, setRoyalties] = useState<RoyaltiesData>(EMPTY_ROYALTIES);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Load real on-chain portfolio and real creator royalties for the connected wallet
  useEffect(() => {
    let cancelled = false;

    if (!address) {
      setPortfolio(EMPTY_PORTFOLIO);
      setRoyalties(EMPTY_ROYALTIES);
      setLoading(false);
      return;
    }

    setLoading(true);

    async function loadData() {
      try {
        const [portRes, royRes] = await Promise.all([
          fetch(`/api/portfolio?wallet=${encodeURIComponent(address!)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/portfolio/royalties?wallet=${encodeURIComponent(address!)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);

        if (cancelled) return;

        if (portRes && portRes.balances) {
          setPortfolio({
            totalValueUsd: portRes.totalValueUsd ?? 0,
            balances: {
              sol: portRes.balances.sol ?? { amount: 0, valueUsd: 0 },
              usdc: portRes.balances.usdc ?? { amount: 0, valueUsd: 0 },
            },
            holdings: portRes.holdings ?? [],
            performance: portRes.performance,
          });
        }

        if (royRes && royRes.vaults) {
          setRoyalties(royRes);
        }
      } catch (err) {
        console.warn("Could not load on-chain wallet data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [address]);

  // Prepare + sign Meteora claimCreatorTradingFee (fees in paired xStock quote)
  async function handleClaim(vaultId?: string) {
    if (!address) return;
    setClaimingId(vaultId || "all");
    setClaimSuccessMsg(null);

    try {
      const res = await fetch("/api/portfolio/royalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          vaultId,
          claimAll: !vaultId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      if (!data.transactionBase64) throw new Error("Claim transaction was not prepared.");

      const win = window as unknown as {
        solana?: { signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>; signTransaction?: (tx: Transaction) => Promise<Transaction> };
        phantom?: { solana?: { signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>; signTransaction?: (tx: Transaction) => Promise<Transaction> } };
      };
      const provider = win.solana ?? win.phantom?.solana;
      if (!provider?.signTransaction && !provider?.signAndSendTransaction) {
        throw new Error("Connect Phantom or Solflare to sign the claim.");
      }

      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const tx = Transaction.from(base64ToUint8Array(data.transactionBase64));

      let signature = "";
      if (provider.signAndSendTransaction) {
        signature = (await provider.signAndSendTransaction(tx)).signature;
      } else if (provider.signTransaction) {
        const signed = await provider.signTransaction(tx);
        signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      }
      await connection.confirmTransaction(signature, "confirmed");

      const refreshRes = await fetch(`/api/portfolio/royalties?wallet=${encodeURIComponent(address)}`);
      if (refreshRes.ok) setRoyalties(await refreshRes.json());

      setClaimSuccessMsg(
        `Claimed ${data.unclaimedStockShares ?? ""} ${data.pairedStockSymbol || "xStock"} fees · ${signature.slice(0, 8)}…`
      );
    } catch (err: unknown) {
      console.error("Claim error:", err);
      alert(err instanceof Error ? err.message : "Failed to process royalty claim.");
    } finally {
      setClaimingId(null);
    }
  }

  const unclaimedTotal = royalties?.summary.totalUnclaimedUsd ?? 0;
  const netWorthUsd = address ? (portfolio.totalValueUsd + unclaimedTotal) : 0;
  const pnlUsd = portfolio.performance?.pnlUsd ?? 0;
  const hasPnl = portfolio.performance?.available && pnlUsd !== 0;

  return (
    <div className="portfolio-container">
      {/* Executive Portfolio Header */}
      <section className="portfolio-hero-card" aria-labelledby="portfolio-title">
        <div className="portfolio-hero-top">
          <div className="portfolio-kicker">
            <span className="launch-pulse-dot" />
            <span>SOLANA EQUITY PORTFOLIO &amp; CREATOR VAULT</span>
          </div>
          <div className="portfolio-hero-chips">
            {address ? (
              <span className="portfolio-wallet-pill">
                <span className="launch-pulse-dot" /> {shortWallet(address)}
              </span>
            ) : (
              <button
                type="button"
                className="button button--gradient"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => void connect()}
                disabled={connecting}
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
            <Link href="/launch" className="button button--light" style={{ padding: "6px 14px", fontSize: 12 }}>
              + Launch Pair
            </Link>
          </div>
        </div>

        <div className="portfolio-balance-row">
          <div className="portfolio-main-val-box">
            <span>Total Portfolio Net Worth (USD)</span>
            <h1 id="portfolio-title" className="portfolio-main-val">
              ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(netWorthUsd)}
            </h1>
            {hasPnl ? (
              <span className={`portfolio-delta-badge ${pnlUsd >= 0 ? "is-up" : "is-down"}`}>
                {pnlUsd >= 0 ? "▲ +" : "▼ -"}${Math.abs(pnlUsd).toFixed(2)} 24h PnL
              </span>
            ) : (
              <span className="portfolio-delta-badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--os-muted)" }}>
                ● Live Solana On-Chain Balances
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ padding: "10px 16px", borderRadius: 14, background: "rgba(153, 69, 255, 0.05)", border: "1px solid rgba(153, 69, 255, 0.15)" }}>
              <span style={{ fontSize: 11, color: "var(--os-muted)", display: "block" }}>Liquid SOL</span>
              <strong style={{ fontSize: 14, fontFamily: "ui-monospace, monospace" }}>
                {address ? `${portfolio.balances.sol.amount.toFixed(4)} SOL` : "— SOL"}
              </strong>
            </div>
            <div style={{ padding: "10px 16px", borderRadius: 14, background: "rgba(3, 225, 255, 0.05)", border: "1px solid rgba(3, 225, 255, 0.15)" }}>
              <span style={{ fontSize: 11, color: "var(--os-muted)", display: "block" }}>Liquid USDC</span>
              <strong style={{ fontSize: 14, fontFamily: "ui-monospace, monospace" }}>
                {address ? `$${(portfolio.balances.usdc.amount ?? 0).toFixed(2)}` : "—"}
              </strong>
            </div>
          </div>
        </div>

        {/* Creator Royalty Claim Highlight Banner */}
        <div className="portfolio-royalty-banner">
          <div className="portfolio-royalty-left">
            <div className="portfolio-royalty-icon" aria-hidden="true">💎</div>
            <div className="portfolio-royalty-text">
              <strong>
                ${unclaimedTotal.toFixed(2)} in Unclaimed Creator Royalties
              </strong>
              <span>
                {address
                  ? "Earned in real stock assets (1.0%–3.0% fee) from trading volume on your launched pairs"
                  : "Connect your Solana wallet to read on-chain balances and creator royalty vaults"}
              </span>
            </div>
          </div>
          {address ? (
            <button
              type="button"
              className="portfolio-claim-all-btn"
              disabled={unclaimedTotal <= 0 || claimingId !== null}
              onClick={() => handleClaim()}
            >
              {claimingId === "all" ? "Claiming on Solana..." : `Claim All Royalties ($${unclaimedTotal.toFixed(2)})`}
            </button>
          ) : (
            <button
              type="button"
              className="portfolio-claim-all-btn"
              onClick={() => void connect()}
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Connect Wallet to Claim"}
            </button>
          )}
        </div>

        {claimSuccessMsg && (
          <div style={{ marginTop: 14, padding: "10px 16px", borderRadius: 12, background: "rgba(20, 241, 149, 0.12)", border: "1px solid rgba(20, 241, 149, 0.3)", color: "#0c8a58", fontSize: 13, fontWeight: 600 }}>
            {claimSuccessMsg}
          </div>
        )}
      </section>

      {/* Tabs Toolbar */}
      <div className="portfolio-tabs-bar">
        <div className="portfolio-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "royalties"}
            className={`portfolio-tab ${activeTab === "royalties" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setActiveTab("royalties"))}
          >
            Creator Royalty Vaults ({royalties.vaults.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "holdings"}
            className={`portfolio-tab ${activeTab === "holdings" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setActiveTab("holdings"))}
          >
            Asset Holdings ({portfolio.holdings.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`portfolio-tab ${activeTab === "history" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setActiveTab("history"))}
          >
            Distribution History ({royalties.claims.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Creator Royalty Vaults */}
      {activeTab === "royalties" && (
        <section aria-label="Creator Royalty Vaults">
          <div className="royalty-vaults-grid">
            {loading ? (
              <div style={{ gridColumn: "1 / -1", padding: 48, textAlign: "center", color: "var(--os-muted)", background: "#fff", borderRadius: 20, border: "1px solid var(--os-border)" }}>
                Reading on-chain creator vaults...
              </div>
            ) : royalties.vaults.length > 0 ? (
              royalties.vaults.map((vault) => {
                const isClaiming = claimingId === vault.id;
                return (
                  <div className="royalty-vault-card" key={vault.id}>
                    <div>
                      <div className="royalty-vault-top">
                        <div className="royalty-vault-tokens">
                          <div className="royalty-vault-avatar">
                            {vault.tokenLogo ? (
                              <img src={vault.tokenLogo} alt={vault.tokenSymbol} />
                            ) : (
                              <div style={{ display: "grid", placeItems: "center", height: "100%", fontWeight: 700 }}>
                                {vault.tokenSymbol.slice(0, 3)}
                              </div>
                            )}
                            <div className="royalty-vault-pair-badge">
                              <StockLogo symbol={vault.pairedStockSymbol} size={22} />
                            </div>
                          </div>
                          <div className="royalty-vault-title">
                            <h3>{vault.tokenName}</h3>
                            <span>${vault.tokenSymbol} × ${vault.pairedStockSymbol}</span>
                          </div>
                        </div>
                        <span className="royalty-vault-venue">
                          {vault.venue === "pumpfun" ? "Pump.fun" : "Meteora DBC"}
                        </span>
                      </div>

                      <div className="royalty-vault-metrics" style={{ marginTop: 14 }}>
                        <div className="royalty-metric-row">
                          <span>Creator Fee Rate</span>
                          <strong>{(vault.feeBps / 100).toFixed(1)}% in {vault.pairedStockSymbol}</strong>
                        </div>
                        <div className="royalty-metric-row">
                          <span>24h Trading Volume</span>
                          <strong>${vault.tradingVolume24hUsd.toLocaleString()}</strong>
                        </div>
                        <div className="royalty-metric-row">
                          <span>Accrued Royalties</span>
                          <strong style={{ color: "var(--solana-green, #14f195)" }}>
                            {vault.unclaimedStockShares.toFixed(2)} {vault.pairedStockSymbol} (${vault.unclaimedUsd.toFixed(2)})
                          </strong>
                        </div>
                        <div className="royalty-metric-row">
                          <span>Total Claimed To Date</span>
                          <span>{vault.claimedStockShares.toFixed(2)} {vault.pairedStockSymbol}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="royalty-claim-btn"
                      disabled={vault.unclaimedStockShares <= 0 || isClaiming || claimingId !== null}
                      onClick={() => handleClaim(vault.id)}
                    >
                      {isClaiming ? "Claiming..." : vault.unclaimedStockShares > 0 ? `Claim ${vault.unclaimedStockShares.toFixed(2)} ${vault.pairedStockSymbol} ($${vault.unclaimedUsd.toFixed(2)})` : "No Unclaimed Royalties"}
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: "1 / -1", padding: 48, textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid var(--os-border)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💎</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--os-foreground)" }}>No Creator Vaults Found</h3>
                <p style={{ color: "var(--os-muted)", maxWidth: 480, margin: "0 auto 20px", fontSize: 13, lineHeight: 1.6 }}>
                  {address
                    ? "This wallet has not launched any synthetic stock pairs yet. Launch a community pair on Pump.fun or Meteora DBC paired against $NVDAx, $AAPLx, or $TSLAx to earn a permanent 1.0%–3.0% creator royalty paid directly in real stock shares."
                    : "Connect your Solana wallet to view your active creator vaults and claim accrued stock royalties."}
                </p>
                <Link href="/launch" className="button button--gradient" style={{ padding: "10px 24px", fontSize: 13 }}>
                  + Launch Your First Stock Pair
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 2: Asset Holdings */}
      {activeTab === "holdings" && (
        <section aria-label="Asset Holdings">
          <div className="holdings-table-wrap">
            {portfolio.holdings.length > 0 ? (
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Price</th>
                    <th>24h Change</th>
                    <th>Raw Tokens</th>
                    <th>Multiplier</th>
                    <th>Actual Shares</th>
                    <th>Total Value</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.map((h) => {
                    const isUp = (h.change24h ?? 0) >= 0;
                    const multVal = h.multiplier && Number.isFinite(h.multiplier) ? h.multiplier : 1;
                    return (
                      <tr key={h.symbol}>
                        <td>
                          <div className="holding-asset-cell">
                            <StockLogo symbol={h.symbol} logo={h.logo ?? undefined} size={36} />
                            <div className="holding-asset-name">
                              <strong>{h.name}</strong>
                              <span>{h.symbol}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontFamily: "ui-monospace, monospace" }}>
                            ${h.priceUsd ? h.priceUsd.toFixed(2) : "—"}
                          </strong>
                        </td>
                        <td>
                          {h.change24h !== undefined && h.change24h !== null ? (
                            <span className={`launch-pair-stat-tag ${isUp ? "is-up" : "is-down"}`}>
                              {isUp ? "+" : ""}{h.change24h.toFixed(2)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--os-muted, #666)" }}>
                            {(h.rawTokens ?? h.shares).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              background: multVal !== 1 ? "rgba(153, 69, 255, 0.15)" : "rgba(0,0,0,0.06)",
                              color: multVal !== 1 ? "var(--solana-purple, #9945ff)" : "var(--os-muted, #666)",
                            }}
                          >
                            {multVal.toFixed(4)}×
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontFamily: "ui-monospace, monospace" }}>
                            {h.shares.toLocaleString()} shares
                          </strong>
                        </td>
                        <td>
                          <strong style={{ fontFamily: "ui-monospace, monospace", color: "var(--solana-purple, #9945ff)" }}>
                            ${h.valueUsd ? h.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                          </strong>
                        </td>
                        <td>
                          <Link href={`/app/asset/${h.symbol}`} className="button button--light" style={{ padding: "4px 10px", fontSize: 11 }}>
                            Trade ↗
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 48, textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid var(--os-border)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--os-foreground)" }}>No Tokenized Stock Assets</h3>
                <p style={{ color: "var(--os-muted)", maxWidth: 480, margin: "0 auto 20px", fontSize: 13, lineHeight: 1.6 }}>
                  {address
                    ? "No tokenized stock assets ($NVDAx, $TSLAx, $AAPLx, etc.) were found in this wallet."
                    : "Connect your wallet to inspect your on-chain synthetic stock portfolio."}
                </p>
                <Link href="/app/community" className="button button--light" style={{ padding: "10px 24px", fontSize: 13 }}>
                  Explore Community Market
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 3: Claim History */}
      {activeTab === "history" && (
        <section aria-label="Distribution History">
          <div className="holdings-table-wrap">
            {royalties.claims.length > 0 ? (
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Token Pair</th>
                    <th>Equity Received</th>
                    <th>USD Value</th>
                    <th>Date / Time</th>
                    <th>Solana Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {royalties.claims.map((claim) => (
                    <tr key={claim.id}>
                      <td>
                        <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{claim.id}</strong>
                      </td>
                      <td>
                        <strong>${claim.tokenSymbol} × ${claim.stockSymbol}</strong>
                      </td>
                      <td>
                        <strong style={{ color: "var(--solana-green, #14f195)" }}>
                          +{claim.claimedShares.toFixed(2)} {claim.stockSymbol}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ fontFamily: "ui-monospace, monospace" }}>
                          ${claim.valueUsd.toFixed(2)}
                        </strong>
                      </td>
                      <td style={{ color: "var(--os-muted)", fontSize: 12 }}>
                        {new Date(claim.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <a
                          href={`https://solscan.io/tx/${claim.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button button--light"
                          style={{ padding: "4px 10px", fontSize: 11 }}
                        >
                          Solscan ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 48, textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid var(--os-border)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--os-foreground)" }}>No Distributions Recorded</h3>
                <p style={{ color: "var(--os-muted)", maxWidth: 480, margin: "0 auto", fontSize: 13, lineHeight: 1.6 }}>
                  Claimed creator royalties and on-chain distributions will appear here with Solscan transaction proofs.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
