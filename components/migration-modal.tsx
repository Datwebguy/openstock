"use client";

import { useEffect } from "react";
import { StockLogo } from "@/components/stock-logo";
import type { CommunityToken } from "@/lib/community-tokens";

interface MigrationModalProps {
  token: CommunityToken;
  onClose: () => void;
  onOpenSwap?: (token: CommunityToken) => void;
}

export function MigrationModal({ token, onClose, onOpenSwap }: MigrationModalProps) {
  const isGraduated = token.bondingCurveProgress >= 100 || token.status === "graduated";
  const progress = Math.min(100, Math.max(0, token.bondingCurveProgress));
  const remainingPercent = (100 - progress).toFixed(1);

  // Accurate remaining USD needed to graduate based on bonding curve progress
  const remainingUsd = isGraduated ? 0 : Math.round(((100 - progress) / 100) * 69_000);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="migration-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="migration-modal-title">
      <div className="migration-modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="migration-modal-container">
        {/* Modal Header */}
        <div className="migration-modal-header">
          <div className="migration-header-brand">
            <div className="migration-avatar-pair">
              <img
                src={token.imageUrl}
                alt={token.name}
                className="migration-avatar-main"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b2333'/><text x='50' y='58' font-size='32' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>OS</text></svg>";
                }}
              />
              <div className="migration-avatar-stock" title={`Paired with ${token.pairedStockSymbol}`}>
                <StockLogo symbol={token.pairedStockSymbol} size={22} />
              </div>
            </div>
            <div>
              <h2 id="migration-modal-title" className="migration-title">
                {token.name} (${token.symbol})
              </h2>
              <div className="migration-subtitle-row">
                <span className="migration-badge-pair">Paired with {token.pairedStockSymbol}</span>
                <span className={`migration-status-pill ${isGraduated ? "is-graduated" : "is-active"}`}>
                  <span className="migration-pulse-dot" />
                  {isGraduated ? "✓ Graduated to Meteora DLMM" : `${progress.toFixed(1)}% to Migration`}
                </span>
              </div>
            </div>
          </div>

          <button type="button" className="migration-close-btn" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="migration-modal-body">
          {/* Progress Visualizer Hero */}
          <div className="migration-gauge-hero">
            <div className="migration-gauge-header">
              <span>Bonding Curve Capacity</span>
              <strong>{progress.toFixed(1)}% / 100%</strong>
            </div>

            <div className="migration-progress-track">
              <div
                className={`migration-progress-bar ${isGraduated ? "is-graduated" : ""}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="migration-gauge-meta">
              {isGraduated ? (
                <span className="migration-meta-notice is-success">
                  🎉 Migration Complete: Liquidity permanently locked in Meteora DLMM pool.
                </span>
              ) : (
                <span className="migration-meta-notice">
                  Remaining to DLMM Migration: <strong>${remainingUsd.toLocaleString()} USD</strong> (~{remainingPercent}% of curve)
                </span>
              )}
            </div>
          </div>

          {/* 3-Step Automated Migration Pipeline */}
          <div className="migration-steps-box">
            <h3 className="migration-steps-title">Automated Solana Migration Pipeline</h3>
            <div className="migration-steps-grid">
              {/* Step 1 */}
              <div className={`migration-step-card ${progress > 0 ? "is-active" : ""}`}>
                <div className="migration-step-badge">01</div>
                <div className="migration-step-content">
                  <h4>Bonding Curve Accumulation</h4>
                  <p>
                    Community trades against <strong>{token.pairedStockSymbol}</strong>. Creator earns{" "}
                    <strong>{(token.creatorFeeBps / 100).toFixed(1)}%</strong> in stock on every swap.
                  </p>
                  <span className="migration-step-stat">
                    {progress >= 100 ? "✓ Curve 100% Filled" : `${progress.toFixed(1)}% Filled`}
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`migration-step-card ${isGraduated ? "is-active" : ""}`}>
                <div className="migration-step-badge">02</div>
                <div className="migration-step-content">
                  <h4>Meteora DLMM Pool Seeding</h4>
                  <p>
                    Upon hitting 100%, accumulated liquidity is automatically deposited into a concentrated{" "}
                    <strong>Meteora DLMM Dynamic AMM</strong> pool on Solana.
                  </p>
                  <span className="migration-step-stat">
                    {isGraduated ? "✓ Pool Initialized" : "Triggers at 100%"}
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`migration-step-card ${isGraduated ? "is-active" : ""}`}>
                <div className="migration-step-badge">03</div>
                <div className="migration-step-content">
                  <h4>Permanent LP Lock &amp; Burn</h4>
                  <p>
                    Liquidity Provider (LP) tokens are permanently burned or locked into protocol escrow. Zero rug-pull risk guarantee.
                  </p>
                  <span className="migration-step-stat">
                    {isGraduated ? "✓ Rug-Proof Verified" : "Autonomous Lock"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div className="migration-telemetry-grid">
            <div className="migration-telemetry-item">
              <span>Current Token Price</span>
              <strong>${token.priceUsd.toFixed(6)}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Market Cap</span>
              <strong>${token.marketCapUsd.toLocaleString()}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>24h Paired Volume</span>
              <strong>${token.volume24hUsd.toLocaleString()}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Holders</span>
              <strong>{token.holdersCount.toLocaleString()} Wallets</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Execution AMM</span>
              <strong style={{ color: "var(--solana-cyan, #03e1ff)" }}>
                {isGraduated ? "Meteora DLMM" : "Pump.fun Curve"}
              </strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Creator Stock Royalty</span>
              <strong style={{ color: "var(--solana-green, #14f195)" }}>
                {(token.creatorFeeBps / 100).toFixed(1)}% in {token.pairedStockSymbol}
              </strong>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="migration-modal-footer">
          <div className="migration-footer-links">
            <a href={token.explorerUrl} target="_blank" rel="noreferrer" className="migration-link-btn">
              Solscan ↗
            </a>
            {token.meteoraUrl ? (
              <a href={token.meteoraUrl} target="_blank" rel="noreferrer" className="migration-link-btn is-meteora">
                Meteora DLMM Pool ↗
              </a>
            ) : null}
            <a
              href={`https://app.bubblemaps.io/sol/token/${token.mint}`}
              target="_blank"
              rel="noreferrer"
              className="migration-link-btn"
            >
              Bubblemaps ↗
            </a>
          </div>

          <div className="migration-footer-actions">
            {!isGraduated && onOpenSwap ? (
              <button
                type="button"
                className="migration-primary-btn"
                onClick={() => {
                  onClose();
                  onOpenSwap(token);
                }}
              >
                Ape ${token.symbol} to Fast-Track Migration ⚡
              </button>
            ) : isGraduated && token.meteoraUrl ? (
              <a href={token.meteoraUrl} target="_blank" rel="noreferrer" className="migration-primary-btn">
                Trade on Meteora DLMM ↗
              </a>
            ) : (
              <button type="button" className="migration-primary-btn" onClick={onClose}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
