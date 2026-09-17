"use client";

import { useState } from "react";
import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function MultiplierGuidePage() {
  const [rawTokens, setRawTokens] = useState<string>("10.0");
  const [multiplier, setMultiplier] = useState<number>(4.0);
  const [stockPrice, setStockPrice] = useState<number>(120.0);

  const parsedRaw = parseFloat(rawTokens) || 0;
  const uiShares = +(parsedRaw * multiplier).toFixed(4);
  const totalValue = +(uiShares * stockPrice).toFixed(2);
  const unadjustedValue = +(parsedRaw * (stockPrice * multiplier)).toFixed(2);

  return (
    <main className="page">
      <AppNav ctaHref="/app" ctaLabel="Trade Market" />

      <div className="container app-page" style={{ maxWidth: 880, margin: "0 auto", paddingBottom: 64 }}>
        <Link href="/app" className="back-link">
          ← Back to Market
        </Link>

        <header className="workspace-heading" style={{ marginBottom: 32 }}>
          <div className="workspace-heading__body">
            <div className="workspace-kicker">
              <span className="live-dot" aria-hidden="true" />
              <span>Solana SPL Token-2022 Standard · Corporate Action Invariance</span>
            </div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", marginTop: 8 }}>
              Token-2022 Multipliers &amp; Stock Splits
            </h1>
            <p style={{ maxWidth: "68ch", fontSize: 16, lineHeight: 1.6, color: "var(--os-muted, #6e6782)" }}>
              Traditional stock splits change the number of outstanding shares. On Solana, Backed uses SPL Token-2022
              dynamic multipliers so token balances stay invariant on-chain while your tradeable equity automatically scales.
            </p>
          </div>
        </header>

        {/* Interactive Invariance Sandbox */}
        <section
          className="panel"
          style={{
            padding: 32,
            borderRadius: 24,
            border: "1px solid var(--os-line, rgba(22, 19, 33, 0.1))",
            background: "var(--os-card, #ffffff)",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--solana-purple, #9945ff)" }}>
                Interactive Simulator
              </span>
              <h2 style={{ fontSize: 22, margin: "4px 0 0" }}>Live Multiplier Calculator</h2>
            </div>
            <span className="status-badge is-verified" style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              Invariant: Total Value Preserved
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--os-muted)" }}>
                Raw Token-2022 Balance
              </label>
              <input
                type="number"
                step="any"
                value={rawTokens}
                onChange={(e) => setRawTokens(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--os-line, rgba(22, 19, 33, 0.15))",
                  fontSize: 16,
                  fontWeight: 700,
                  background: "var(--os-porcelain, #f7f5fc)",
                  color: "inherit",
                }}
              />
              <small style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--os-muted)" }}>
                Actual mint balance in your Solana wallet
              </small>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--os-muted)" }}>
                Corporate Action Multiplier
              </label>
              <select
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--os-line, rgba(22, 19, 33, 0.15))",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--os-porcelain, #f7f5fc)",
                  color: "inherit",
                }}
              >
                <option value={1.0}>1.0000× (Base / No Split)</option>
                <option value={2.0}>2.0000× (2:1 Stock Split)</option>
                <option value={3.0}>3.0000× (3:1 Stock Split)</option>
                <option value={4.0}>4.0000× (4:1 Apple / Tech Split)</option>
                <option value={10.0}>10.0000× (10:1 NVIDIA Mega Split)</option>
                <option value={0.5}>0.5000× (1:2 Reverse Split)</option>
              </select>
              <small style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--os-muted)" }}>
                Published on-chain by Backed Oracle
              </small>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--os-muted)" }}>
                Post-Split Share Price ($)
              </label>
              <input
                type="number"
                step="any"
                value={stockPrice}
                onChange={(e) => setStockPrice(parseFloat(e.target.value) || 0)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--os-line, rgba(22, 19, 33, 0.15))",
                  fontSize: 16,
                  fontWeight: 700,
                  background: "var(--os-porcelain, #f7f5fc)",
                  color: "inherit",
                }}
              />
              <small style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--os-muted)" }}>
                Current executable price on Meteora DLMM
              </small>
            </div>
          </div>

          {/* Equation Breakdown Box */}
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              background: "rgba(153, 69, 255, 0.05)",
              border: "1px solid rgba(153, 69, 255, 0.2)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: "var(--os-muted)" }}>Effective UI Shares</span>
              <strong style={{ display: "block", fontSize: 24, color: "var(--solana-purple, #9945ff)", marginTop: 4 }}>
                {uiShares.toLocaleString()} shares
              </strong>
              <small style={{ fontSize: 11, color: "var(--os-muted)" }}>
                {parsedRaw} tokens × {multiplier.toFixed(4)}×
              </small>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--os-muted)" }}>Total Position Value</span>
              <strong style={{ display: "block", fontSize: 24, color: "var(--solana-green, #14f195)", marginTop: 4 }}>
                ${totalValue.toLocaleString()} USD
              </strong>
              <small style={{ fontSize: 11, color: "var(--os-muted)" }}>
                {uiShares} shares @ ${stockPrice.toFixed(2)}
              </small>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--os-muted)" }}>Pre-Split Value Equivalence</span>
              <strong style={{ display: "block", fontSize: 24, marginTop: 4 }}>
                ${unadjustedValue.toLocaleString()} USD
              </strong>
              <small style={{ fontSize: 11, color: "var(--os-muted)" }}>
                Zero economic dilution
              </small>
            </div>
          </div>
        </section>

        {/* Why Multiplier Invariance Matters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 32 }}>
          <div className="panel" style={{ padding: 24, borderRadius: 20, border: "1px solid var(--os-line, rgba(22, 19, 33, 0.1))" }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>1. No Taxable Events</h3>
            <p style={{ fontSize: 13, color: "var(--os-muted)", lineHeight: 1.5 }}>
              In traditional wrapped token protocols, stock splits require burning old tokens and minting new ones, which can trigger taxable disposal events. With Token-2022 dynamic multipliers, the token mint remains identical while the share multiplier scales cleanly.
            </p>
          </div>

          <div className="panel" style={{ padding: 24, borderRadius: 20, border: "1px solid var(--os-line, rgba(22, 19, 33, 0.1))" }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>2. Pool Liquidity Safety</h3>
            <p style={{ fontSize: 13, color: "var(--os-muted)", lineHeight: 1.5 }}>
              Meteora DLMM concentrated liquidity bins adjust smoothly when oracle feeds update. LPs do not need to withdraw and redeploy into a newly minted contract address each time a stock executes a 2:1 or 4:1 split.
            </p>
          </div>

          <div className="panel" style={{ padding: 24, borderRadius: 20, border: "1px solid var(--os-line, rgba(22, 19, 33, 0.1))" }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>3. Pre-Flight Slip Verifications</h3>
            <p style={{ fontSize: 13, color: "var(--os-muted)", lineHeight: 1.5 }}>
              Whenever you place an order on OpenStock, our pre-flight safety slip recalculates the exact raw units and effective multiplier immediately before requesting your wallet signature to prevent front-running or stale multipliers.
            </p>
          </div>
        </div>

        {/* CTA Footer */}
        <div
          className="panel"
          style={{
            padding: 24,
            borderRadius: 20,
            border: "1px solid var(--os-line, rgba(22, 19, 33, 0.1))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Inspect Live Corporate Actions</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--os-muted)" }}>
              Follow upcoming stock splits, dividends, and corporate notices on the live calendar.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link className="button button--gradient" href="/app/actions">
              Corporate Actions Calendar ↗
            </Link>
            <Link className="button button--light" href="/app">
              Trade Equities ↗
            </Link>
          </div>
        </div>
      </div>

      <AppFooterNav />
    </main>
  );
}
