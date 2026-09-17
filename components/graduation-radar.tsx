"use client";

import { StockLogo } from "@/components/stock-logo";
import type { CommunityToken } from "@/lib/community-tokens";

interface GraduationRadarProps {
  tokens: CommunityToken[];
  onInspectMigration: (token: CommunityToken) => void;
  onOpenSwap: (token: CommunityToken) => void;
}

export function GraduationRadar({ tokens, onInspectMigration, onOpenSwap }: GraduationRadarProps) {
  // Sort tokens by highest bonding curve progress that are actively filling (not yet 100%), fallback to highest overall
  const activeCandidates = tokens
    .filter((t) => t.bondingCurveProgress > 0 && t.bondingCurveProgress < 100)
    .sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress);

  const completedCandidates = tokens
    .filter((t) => t.bondingCurveProgress >= 100 || t.status === "graduated")
    .slice(0, 1);

  // Top 3 spotlight items
  const radarSpotlight = [...activeCandidates, ...completedCandidates].slice(0, 3);

  if (radarSpotlight.length === 0) return null;

  return (
    <section className="graduation-radar-section" aria-label="Bonding Curve Migration Radar">
      <div className="graduation-radar-banner">
        <div className="graduation-radar-glow-layer" aria-hidden="true" />

        {/* Radar Header */}
        <div className="graduation-radar-header">
          <div className="graduation-radar-title-group">
            <div className="graduation-radar-ping">
              <span className="radar-pulse-core" />
              <span className="radar-pulse-ring" />
            </div>
            <div>
              <div className="graduation-radar-eyebrow">
                <span>LIVE GRADUATION RADAR</span>
                <span className="graduation-radar-chip">Meteora DLMM Queue</span>
              </div>
              <h2 className="graduation-radar-title">Bonding Curves Near 100% Migration</h2>
            </div>
          </div>
          <p className="graduation-radar-desc">
            When a pair reaches 100% capacity, liquidity automatically migrates into concentrated{" "}
            <strong>Meteora DLMM Dynamic AMM</strong> pools on Solana with permanently burned LP tokens.
          </p>
        </div>

        {/* Radar Cards Carousel / Grid */}
        <div className="graduation-radar-grid">
          {radarSpotlight.map((item, idx) => {
            const isGraduated = item.bondingCurveProgress >= 100 || item.status === "graduated";
            const progress = Math.min(100, Math.max(0, item.bondingCurveProgress));
            const remainingPercentage = Math.max(0, 100 - progress);
            const remainingUsd = isGraduated ? 0 : Math.round((remainingPercentage / 100) * 69_000);

            return (
              <article key={item.mint} className={`radar-card ${isGraduated ? "is-graduated" : ""}`}>
                <div className="radar-card-top">
                  <div className="radar-card-identity">
                    <div className="radar-avatar-stage">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="radar-avatar-main"
                        onError={(e) => {
                          // Clean gradient fallback if CDN or external link fails
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector(".radar-fallback-avatar")) {
                            const fallback = document.createElement("div");
                            fallback.className = "radar-avatar-main radar-fallback-avatar";
                            fallback.style.cssText = "display:grid;place-items:center;background:linear-gradient(135deg,#9945ff,#14f195);color:#fff;font-weight:800;font-size:12px;";
                            fallback.textContent = item.symbol.slice(0, 3).toUpperCase();
                            parent.prepend(fallback);
                          }
                        }}
                      />
                      <div className="radar-avatar-stock" title={`Paired with ${item.pairedStockSymbol}`}>
                        <StockLogo symbol={item.pairedStockSymbol} size={22} />
                      </div>
                    </div>
                    <div>
                      <div className="radar-name-line">
                        <strong className="radar-name">{item.name}</strong>
                        <span className="radar-rank-badge">#{idx + 1}</span>
                      </div>
                      <div className="radar-pair-line">
                        <span>${item.symbol}</span>
                        <span className="radar-times">×</span>
                        <span className="radar-stock-symbol">{item.pairedStockSymbol}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`radar-status-tag ${isGraduated ? "is-graduated" : "is-filling"}`}>
                    {isGraduated ? "✓ Graduated" : `${progress.toFixed(1)}%`}
                  </span>
                </div>

                {/* Progress Visualizer */}
                <div className="radar-progress-container">
                  <div className="radar-progress-labels">
                    <span>Curve Capacity</span>
                    <strong>{progress.toFixed(1)}% / 100%</strong>
                  </div>
                  <div className="radar-progress-track">
                    <div
                      className={`radar-progress-fill ${isGraduated ? "is-graduated" : ""}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="radar-progress-sub">
                    {isGraduated ? (
                      <span className="radar-sub-success">Active on Meteora DLMM</span>
                    ) : (
                      <span>${remainingUsd.toLocaleString()} USD needed to graduate</span>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="radar-stats-row">
                  <div>
                    <span className="radar-stat-lbl">Price</span>
                    <strong className="radar-stat-val">${item.priceUsd.toFixed(4)}</strong>
                  </div>
                  <div>
                    <span className="radar-stat-lbl">24h Vol</span>
                    <strong className="radar-stat-val">${(item.volume24hUsd / 1000).toFixed(1)}K</strong>
                  </div>
                  <div>
                    <span className="radar-stat-lbl">Creator Royalty</span>
                    <strong className="radar-stat-val is-green">
                      {(item.creatorFeeBps / 100).toFixed(1)}% {item.pairedStockSymbol}
                    </strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="radar-actions">
                  {!isGraduated ? (
                    <button
                      type="button"
                      className="radar-btn-ape"
                      onClick={() => onOpenSwap(item)}
                      title={`Buy $${item.symbol} to push the bonding curve`}
                    >
                      Ape ${item.symbol} ⚡
                    </button>
                  ) : item.meteoraUrl ? (
                    <a
                      href={item.meteoraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="radar-btn-ape is-meteora"
                    >
                      Meteora Pool ↗
                    </a>
                  ) : null}

                  <button
                    type="button"
                    className="radar-btn-mechanics"
                    onClick={() => onInspectMigration(item)}
                    title="View bonding curve mechanics and DLMM details"
                  >
                    Migration Details
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
