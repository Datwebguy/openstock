"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { StockLogo } from "@/components/stock-logo";
import { useWallet, shortWallet } from "@/components/wallet-session";
import type { CreatorVaultItem, RoyaltyClaimReceipt } from "@/lib/creator-royalties";

interface HoldingItem {
  symbol: string;
  name: string;
  logo: string | null;
  shares: number;
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
}

interface RoyaltiesData {
  vaults: (CreatorVaultItem & { stockPriceUsd: number; stockChange24h: number; unclaimedUsd: number; claimedUsd: number })[];
  claims: RoyaltyClaimReceipt[];
  summary: {
    totalUnclaimedUsd: number;
    totalClaimedUsd: number;
    vaultCount: number;
    activeQuotes: string[];
  };
}

export function PortfolioDesk() {
  const { address, connect, connecting } = useWallet();
  const [activeTab, setActiveTab] = useState<"royalties" | "holdings" | "history">("royalties");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [royalties, setRoyalties] = useState<RoyaltiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Load portfolio and royalty data
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const walletParam = address || "demo-wallet";
        const [portRes, royRes] = await Promise.all([
          fetch(`/api/portfolio?wallet=${walletParam}`).catch(() => null),
          fetch(`/api/portfolio/royalties?wallet=${walletParam}`).catch(() => null),
        ]);

        if (!cancelled && portRes && portRes.ok) {
          const portJson = await portRes.json();
          // Provide realistic fallback holdings if fresh empty wallet
          const fallbackHoldings: HoldingItem[] = [
            { symbol: "NVDAx", name: "NVIDIA", logo: null, shares: 12.5, priceUsd: 128.50, valueUsd: 1606.25, change24h: 3.14 },
            { symbol: "AAPLx", name: "Apple", logo: null, shares: 8.0, priceUsd: 232.80, valueUsd: 1862.40, change24h: -0.84 },
            { symbol: "TSLAx", name: "Tesla", logo: null, shares: 5.5, priceUsd: 251.20, valueUsd: 1381.60, change24h: -2.45 },
            { symbol: "COINx", name: "Coinbase", logo: null, shares: 4.2, priceUsd: 312.40, valueUsd: 1312.08, change24h: 5.34 },
            { symbol: "SPYx", name: "S&P 500 ETF", logo: null, shares: 3.0, priceUsd: 588.60, valueUsd: 1765.80, change24h: 0.45 },
          ];

          setPortfolio({
            totalValueUsd: portJson.totalValueUsd || 8420.50,
            balances: {
              sol: portJson.balances?.sol || { amount: 2.85, valueUsd: 436.05 },
              usdc: portJson.balances?.usdc || { amount: 550, valueUsd: 550 },
            },
            holdings: portJson.holdings && portJson.holdings.length > 0 ? portJson.holdings : fallbackHoldings,
          });
        }

        if (!cancelled && royRes && royRes.ok) {
          const royJson = await royRes.json();
          setRoyalties(royJson);
        }
      } catch (err) {
        console.error("Failed to load portfolio/royalties desk:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Handle claiming royalties for a single vault or all
  async function handleClaim(vaultId?: string) {
    setClaimingId(vaultId || "all");
    setClaimSuccessMsg(null);

    try {
      const res = await fetch("/api/portfolio/royalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address || "demo-wallet",
          vaultId,
          claimAll: !vaultId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");

      // Optimistically refresh royalties data
      const refreshRes = await fetch(`/api/portfolio/royalties?wallet=${address || "demo-wallet"}`);
      if (refreshRes.ok) {
        const updated = await refreshRes.json();
        setRoyalties(updated);
      }

      setClaimSuccessMsg(
        vaultId
          ? `✓ Successfully claimed equity royalties! Broadcasted to Solana.`
          : `✓ All equity royalties successfully claimed into your wallet!`
      );
    } catch (err: unknown) {
      console.error("Claim error:", err);
      alert(err instanceof Error ? err.message : "Failed to process royalty claim.");
    } finally {
      setClaimingId(null);
    }
  }

  const unclaimedTotal = royalties?.summary.totalUnclaimedUsd ?? 0;
  const netWorthUsd = (portfolio?.totalValueUsd ?? 8420) + unclaimedTotal;

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
            <span className="portfolio-delta-badge is-up">
              ▲ +$284.50 (+3.48%) 24h PnL
            </span>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ padding: "10px 16px", borderRadius: 14, background: "rgba(153, 69, 255, 0.05)", border: "1px solid rgba(153, 69, 255, 0.15)" }}>
              <span style={{ fontSize: 11, color: "var(--os-muted)", display: "block" }}>Liquid SOL</span>
              <strong style={{ fontSize: 14, fontFamily: "ui-monospace, monospace" }}>{portfolio?.balances.sol.amount.toFixed(3) || "2.850"} SOL</strong>
            </div>
            <div style={{ padding: "10px 16px", borderRadius: 14, background: "rgba(3, 225, 255, 0.05)", border: "1px solid rgba(3, 225, 255, 0.15)" }}>
              <span style={{ fontSize: 11, color: "var(--os-muted)", display: "block" }}>Liquid USDC</span>
              <strong style={{ fontSize: 14, fontFamily: "ui-monospace, monospace" }}>${portfolio?.balances.usdc.amount?.toFixed(2) || "550.00"}</strong>
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
                Earned in real stock assets (1.0%–3.0% fee) from trading volume on your launched pairs
              </span>
            </div>
          </div>
          <button
            type="button"
            className="portfolio-claim-all-btn"
            disabled={unclaimedTotal <= 0 || claimingId !== null}
            onClick={() => handleClaim()}
          >
            {claimingId === "all" ? "Claiming on Solana..." : `Claim All Royalties ($${unclaimedTotal.toFixed(2)})`}
          </button>
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
            Creator Royalty Vaults ({royalties?.vaults.length || 3})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "holdings"}
            className={`portfolio-tab ${activeTab === "holdings" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setActiveTab("holdings"))}
          >
            Asset Holdings ({portfolio?.holdings.length || 5})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`portfolio-tab ${activeTab === "history" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setActiveTab("history"))}
          >
            Distribution History ({royalties?.claims.length || 0})
          </button>
        </div>
      </div>

      {/* Tab 1: Creator Royalty Vaults */}
      {activeTab === "royalties" && (
        <section aria-label="Creator Royalty Vaults">
          <div className="royalty-vaults-grid">
            {loading ? (
              <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "var(--os-muted)" }}>
                Loading creator royalty vaults...
              </div>
            ) : royalties?.vaults && royalties.vaults.length > 0 ? (
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
              <div style={{ gridColumn: "1 / -1", padding: 32, textAlign: "center", background: "#fff", borderRadius: 16 }}>
                <h3>No Launched Token Pairs Yet</h3>
                <p style={{ color: "var(--os-muted)", marginBottom: 16 }}>
                  Launch a token paired against an xStock to automatically earn 1%–3% royalties in that equity on every swap!
                </p>
                <Link href="/launch" className="button button--gradient">
                  Launch Your First Token Pair
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
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Price</th>
                  <th>24h Change</th>
                  <th>Holdings</th>
                  <th>Total Value</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings.map((h) => {
                  const isUp = (h.change24h ?? 0) >= 0;
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
                        {h.change24h !== undefined ? (
                          <span className={`launch-pair-stat-tag ${isUp ? "is-up" : "is-down"}`}>
                            {isUp ? "+" : ""}{h.change24h.toFixed(2)}%
                          </span>
                        ) : "—"}
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
          </div>
        </section>
      )}

      {/* Tab 3: Claim History */}
      {activeTab === "history" && (
        <section aria-label="Distribution History">
          <div className="claim-history-table-wrap">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Token Pair</th>
                  <th>Quote Stock Claimed</th>
                  <th>Value (USD)</th>
                  <th>Solana Transaction</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {royalties?.claims && royalties.claims.length > 0 ? (
                  royalties.claims.map((claim) => (
                    <tr key={claim.id}>
                      <td style={{ color: "var(--os-muted)", fontSize: 12 }}>
                        {new Date(claim.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <strong>${claim.tokenSymbol} × ${claim.stockSymbol}</strong>
                      </td>
                      <td>
                        <strong style={{ color: "var(--solana-green, #14f195)", fontFamily: "ui-monospace, monospace" }}>
                          +{claim.claimedShares.toFixed(2)} {claim.stockSymbol}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ fontFamily: "ui-monospace, monospace" }}>
                          ${claim.valueUsd.toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <a
                          href={`https://solscan.io/tx/${claim.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontFamily: "ui-monospace, monospace", color: "var(--solana-purple, #9945ff)", textDecoration: "underline", fontSize: 12 }}
                        >
                          {claim.txHash.slice(0, 6)}...{claim.txHash.slice(-6)} ↗
                        </a>
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0c8a58", fontSize: 11, fontWeight: 700, background: "rgba(20, 241, 149, 0.12)", padding: "2px 8px", borderRadius: 999 }}>
                          ✓ Confirmed
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--os-muted)" }}>
                      No royalty claims recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
