"use client";
import { tokenImageSrc } from "@/lib/community-token-utils";

import { StockLogo } from "@/components/stock-logo";
import type { CommunityToken } from "@/lib/community-tokens";
import { formatTokenPrice, formatTokenVolume } from "@/lib/community-token-utils";

interface GraduationRadarProps {
  tokens: CommunityToken[];
  onInspectMigration: (token: CommunityToken) => void;
  onOpenSwap: (token: CommunityToken) => void;
}

export function GraduationRadar({ tokens, onInspectMigration, onOpenSwap }: GraduationRadarProps) {
  // Only curves whose progress was actually measured on-chain (OpenStock Meteora DBC launches).
  const radarSpotlight = tokens
    .filter((t) => t.progressKnown && t.status !== "graduated" && t.bondingCurveProgress < 100)
    .sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress)
    .slice(0, 3);

  if (radarSpotlight.length === 0) return null;

  return (
    <section className="graduation-radar-section" aria-label="Bonding Curve Migration Radar">
      <div className="graduation-radar-banner">
        <div className="graduation-radar-glow-layer" aria-hidden="true" />

        {/* Clean, institutional header */}
        <div className="graduation-radar-header">
          <div className="graduation-radar-header-left">
            <div className="graduation-radar-title-row">
              <span className="radar-pulse-core" aria-hidden="true" />
              <h2 className="graduation-radar-title">Curves closest to migration</h2>
              <span className="graduation-radar-chip">Meteora DBC</span>
            </div>
            <p className="graduation-radar-subtitle">
              Progress is read from each pool on Solana. When a curve fills, anyone can migrate it to a Meteora pool.
            </p>
          </div>
        </div>

        {/* Spotlight Cards Grid */}
        <div className="graduation-radar-grid">
          {radarSpotlight.map((item) => {
            const isGraduated = false;
            const progress = Math.min(100, Math.max(0, item.bondingCurveProgress));

            return (
              <article key={item.mint} className={`radar-card ${isGraduated ? "is-graduated" : ""}`}>
                {/* Identity Row */}
                <div className="radar-card-top">
                  <div className="radar-card-identity">
                    <div className="radar-avatar-stage">
                      <img
                        src={tokenImageSrc(item)}
                        alt={item.name}
                        className="radar-avatar-main"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector(".radar-fallback-avatar")) {
                            const fallback = document.createElement("div");
                            fallback.className = "radar-avatar-main radar-fallback-avatar";
                            fallback.style.cssText =
                              "display:grid;place-items:center;background:linear-gradient(135deg,#9945ff,#14f195);color:#fff;font-weight:800;font-size:12px;border-radius:12px;";
                            fallback.textContent = item.symbol.slice(0, 3).toUpperCase();
                            parent.prepend(fallback);
                          }
                        }}
                      />
                      <div className="radar-avatar-stock" title={`Paired with ${item.pairedStockSymbol}`}>
                        <StockLogo symbol={item.pairedStockSymbol} size={18} />
                      </div>
                    </div>
                    <div className="radar-identity-text">
                      <strong className="radar-name">{item.name}</strong>
                      <div className="radar-pair-line">
                        <span className="radar-token-symbol">${item.symbol}</span>
                        <span className="radar-times">×</span>
                        <span className="radar-stock-symbol">{item.pairedStockSymbol}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`radar-status-tag ${isGraduated ? "is-graduated" : "is-filling"}`}>
                    {isGraduated ? "✓ Full Pool" : `${progress.toFixed(1)}%`}
                  </span>
                </div>

                {/* Progress Visualizer */}
                <div className="radar-progress-container">
                  <div className="radar-progress-labels">
                    <span className="radar-progress-title">Curve Progress</span>
                    <strong className="radar-progress-percent">{progress.toFixed(1)}%</strong>
                  </div>
                  <div className="radar-progress-track">
                    <div
                      className={`radar-progress-fill ${isGraduated ? "is-graduated" : ""}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="radar-progress-sub">
                    <span className="radar-target-label">Quote raised vs. migration threshold</span>
                  </div>
                </div>

                {/* Quick Stats Row: Perfectly aligned 3 columns */}
                <div className="radar-stats-row">
                  <div className="radar-stat-col">
                    <span className="radar-stat-lbl">Price</span>
                    <strong className="radar-stat-val">{formatTokenPrice(item.priceUsd)}</strong>
                  </div>
                  <div className="radar-stat-col">
                    <span className="radar-stat-lbl">24h Vol</span>
                    <strong className="radar-stat-val">{formatTokenVolume(item.volume24hUsd)}</strong>
                  </div>
                  <div className="radar-stat-col">
                    <span className="radar-stat-lbl">Royalty</span>
                    <strong className="radar-stat-val is-green">
                      {item.creatorFeeBps ? `${(item.creatorFeeBps / 100).toFixed(2)}%` : "—"}
                    </strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="radar-actions">
                  {!isGraduated ? (
                    <button
                      type="button"
                      className="radar-btn-trade"
                      onClick={() => onOpenSwap(item)}
                      title={`Buy or Swap $${item.symbol}`}
                    >
                      Trade ${item.symbol} ⚡
                    </button>
                  ) : item.meteoraUrl ? (
                    <a
                      href={item.meteoraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="radar-btn-trade is-meteora"
                    >
                      Meteora Pool ↗
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="radar-btn-trade"
                      onClick={() => onOpenSwap(item)}
                    >
                      Trade ${item.symbol} ⚡
                    </button>
                  )}

                  <button
                    type="button"
                    className="radar-btn-details"
                    onClick={() => onInspectMigration(item)}
                    title="View full pool progress"
                  >
                    Pool Details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
