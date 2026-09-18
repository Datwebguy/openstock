"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { StockLogo } from "@/components/stock-logo";
import { BubblemapsModal } from "@/components/bubblemaps-modal";
import { CommunitySwapModal } from "@/components/community-swap-modal";
import { GraduationRadar } from "@/components/graduation-radar";
import { MigrationModal } from "@/components/migration-modal";
import { ShareToXModal, type ShareTokenData } from "@/components/share-to-x-modal";
import type { CommunityToken } from "@/lib/community-tokens";
import { formatTokenPrice, formatTokenVolume } from "@/lib/community-token-utils";

type FilterTab = "all" | "new" | "graduating" | "graduated";

export function CommunityMarketHub({ initialTokens }: { initialTokens?: CommunityToken[] }) {
  const [tokens, setTokens] = useState<CommunityToken[]>(initialTokens || []);
  const [loading, setLoading] = useState(!initialTokens || initialTokens.length === 0);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Active Modals
  const [activeSwapToken, setActiveSwapToken] = useState<CommunityToken | null>(null);
  const [activeBubbleToken, setActiveBubbleToken] = useState<CommunityToken | null>(null);
  const [activeMigrationToken, setActiveMigrationToken] = useState<CommunityToken | null>(null);
  const [activeShareToken, setActiveShareToken] = useState<ShareTokenData | null>(null);

  const [, startTransition] = useTransition();

  // Load tokens from API and start 5s live polling
  useEffect(() => {
    let cancelled = false;

    async function load(showSpinner = false) {
      try {
        if (showSpinner) setLoading(true);
        const res = await fetch("/api/community-tokens", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.tokens)) {
          setTokens(data.tokens);
        }
      } catch (err) {
        console.warn("Failed to sync community tokens:", err);
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }

    void load(true);
    const interval = setInterval(() => void load(false), 5_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Filtered Tokens
  const filteredTokens = tokens.filter((t) => {
    if (filter === "new") {
      const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
      if (ageHours > 24) return false;
    } else if (filter === "graduating") {
      if (t.bondingCurveProgress < 70 || t.bondingCurveProgress >= 100) return false;
    } else if (filter === "graduated") {
      if (t.status !== "graduated" && t.bondingCurveProgress < 100) return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.pairedStockSymbol.toLowerCase().includes(q) ||
      t.pairedStockName.toLowerCase().includes(q)
    );
  });

  // KPI Calculations
  const totalLaunches = tokens.length;
  const totalVolumeUsd = tokens.reduce((acc, t) => acc + t.volume24hUsd, 0);
  const totalVolumeFormatted = formatTokenVolume(totalVolumeUsd);
  const graduatedCount = tokens.filter((t) => t.status === "graduated" || t.bondingCurveProgress >= 100).length;
  const newCount = tokens.filter((t) => {
    const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
    return ageHours <= 24;
  }).length;
  const avgChange24h = tokens.length > 0
    ? +(tokens.reduce((acc, t) => acc + (t.change24h || 0), 0) / tokens.length).toFixed(1)
    : 0;

  function handleTradeSuccess(newVol: number) {
    if (!activeSwapToken) return;
    setTokens((prev) =>
      prev.map((t) =>
        t.mint === activeSwapToken.mint
          ? {
              ...t,
              volume24hUsd: newVol,
              bondingCurveProgress: Math.min(100, +(t.bondingCurveProgress + 1.2).toFixed(1)),
              holdersCount: t.holdersCount + 1,
            }
          : t
      )
    );
  }

  return (
    <section className="community-market-section" aria-label="Community Meme & Stock Pairs Market">
      {/* KPI Highlight Strip */}
      <div className="community-kpi-ribbon" role="region" aria-label="Key launch metrics">
        <div className="community-kpi-card">
          <span className="community-kpi-label">TOTAL LAUNCHES</span>
          <div className="community-kpi-value-row">
            <strong>{totalLaunches}</strong>
            <span className="community-kpi-badge">Verified on Solana</span>
          </div>
        </div>

        <div className="community-kpi-card">
          <span className="community-kpi-label">24H PAIRED VOLUME</span>
          <div className="community-kpi-value-row">
            <strong>{totalVolumeFormatted}</strong>
            <span className={`community-kpi-badge ${avgChange24h >= 0 ? "is-green" : "is-red"}`}>
              {avgChange24h >= 0 ? "+" : ""}{avgChange24h}% 24h
            </span>
          </div>
        </div>

        <div className="community-kpi-card">
          <span className="community-kpi-label">NEW IN LAST 24H</span>
          <div className="community-kpi-value-row">
            <strong>{newCount}</strong>
            <span className="community-kpi-badge is-purple">
              <span className="live-dot" /> Live Solana Feed
            </span>
          </div>
        </div>

        <div className="community-kpi-card">
          <span className="community-kpi-label">IN FULL POOL</span>
          <div className="community-kpi-value-row">
            <strong>{graduatedCount}</strong>
            <span className="community-kpi-badge is-cyan">Meteora Live</span>
          </div>
        </div>
      </div>

      {/* Feature #2: Live Bonding Curve Migration Tracker ("Graduation Radar") */}
      <GraduationRadar
        tokens={tokens}
        onInspectMigration={(token) => setActiveMigrationToken(token)}
        onOpenSwap={(token) => setActiveSwapToken(token)}
      />

      {/* Filter and Search Controls */}
      <div className="discovery-toolbar">
        <div className="discovery-toolbar__top">
          <div className="discovery-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meme or paired stock (COMPUTE, NVDAx, Tesla, Apple, DOGE...)"
              aria-label="Search community tokens"
            />
          </div>

          <div className="discovery-toolbar__right">
            <div className="discovery-view-toggle" role="group" aria-label="View format toggle">
              <button
                type="button"
                className={`discovery-view-btn ${viewMode === "table" ? "is-active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Trends Table View"
              >
                Trends
              </button>
              <button
                type="button"
                className={`discovery-view-btn ${viewMode === "grid" ? "is-active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid Cards View"
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        <div className="discovery-filters" role="tablist" aria-label="Filter community launches">
          {[
            { id: "all", label: `All Launches (${tokens.length})` },
            { id: "new", label: `New Launches (${newCount})` },
            { id: "graduating", label: "Graduating Soon (>70%)" },
            { id: "graduated", label: `Graduated (${graduatedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={filter === tab.id ? "is-active" : ""}
              onClick={() => {
                startTransition(() => {
                  setFilter(tab.id as FilterTab);
                });
              }}
            >
              {tab.label}
            </button>
          ))}
          <Link href="/launch" className="discovery-filter-link" title="Launch a new stock-paired token">
            Launch New Pair ↗
          </Link>
        </div>
      </div>

      {/* Empty State */}
      {filteredTokens.length === 0 && !loading && (
        <div className="community-empty-card">
          <p>No token launches matched your filter.</p>
          <Link href="/launch" className="button button--gradient" style={{ display: "inline-flex", marginTop: 12 }}>
            Launch First Token Pair ↗
          </Link>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && filteredTokens.length > 0 && (
        <div className="trends-table-wrapper" style={{ marginTop: 20 }}>
          <table className="trends-table" aria-label="Community meme and stock paired tokens">
            <thead>
              <tr>
                <th scope="col" className="trends-th--rank">#</th>
                <th scope="col" className="trends-th--asset">TOKEN</th>
                <th scope="col" className="trends-th--stock">PAIRED STOCK</th>
                <th scope="col" className="trends-th--price">PRICE</th>
                <th scope="col" className="trends-th--change">24H CHANGE</th>
                <th scope="col" className="trends-th--volume">24H VOLUME</th>
                <th scope="col" className="trends-th--bonding">BONDING CURVE</th>
                <th scope="col" className="trends-th--mcap">MARKET CAP</th>
                <th scope="col" className="trends-th--actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((item, index) => {
                const isPositive = item.change24h >= 0;
                const isGraduated = item.bondingCurveProgress >= 100 || item.status === "graduated";
                const volumeFormatted = formatTokenVolume(item.volume24hUsd);

                return (
                  <tr key={item.mint} className="trends-tr">
                    <td className="trends-td--rank">{index + 1}</td>

                    {/* Token Identity */}
                    <td className="trends-td--asset">
                      <div className="trends-brand-cell">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="community-token-avatar"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector(".token-avatar-fallback")) {
                              const fallback = document.createElement("div");
                              fallback.className = "community-token-avatar token-avatar-fallback";
                              fallback.style.cssText = "display:grid;place-items:center;background:linear-gradient(135deg,#9945ff,#14f195);color:#fff;font-weight:800;font-size:11px;";
                              fallback.textContent = item.symbol.slice(0, 3).toUpperCase();
                              parent.prepend(fallback);
                            }
                          }}
                        />
                        <div className="trends-brand-details">
                          <div className="trends-symbol-line">
                            <span className="trends-symbol">${item.symbol}</span>
                            <span className="trends-chip trends-chip--verified">
                              {isGraduated ? "DLMM POOL" : "BONDING"}
                            </span>
                          </div>
                          <span className="trends-name">{item.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Paired Stock with Real Stock Logo */}
                    <td className="trends-td--stock">
                      <div className="community-paired-cell">
                        <StockLogo symbol={item.pairedStockSymbol} size={28} />
                        <div>
                          <strong>{item.pairedStockSymbol}</strong>
                          <small>{item.pairedStockName}</small>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="trends-td--price">
                      <div className="trends-price-cell">
                        <strong>{formatTokenPrice(item.priceUsd)}</strong>
                        <small>{item.priceSol.toFixed(6)} SOL</small>
                      </div>
                    </td>

                    {/* 24h Change */}
                    <td className="trends-td--change">
                      <span className={`trends-change-pill ${isPositive ? "is-up" : "is-down"}`}>
                        {isPositive ? "+" : ""}
                        {item.change24h}%
                      </span>
                    </td>

                    {/* 24h Volume */}
                    <td className="trends-td--volume">{volumeFormatted}</td>

                    {/* Bonding Curve Progress (Clickable Migration Trigger) */}
                    <td className="trends-td--bonding">
                      <div
                        className="bonding-progress-cell is-interactive"
                        onClick={() => setActiveMigrationToken(item)}
                        title="Click to view pool migration progress"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setActiveMigrationToken(item)}
                      >
                        <div className="bonding-progress-bar">
                          <div
                            className={`bonding-progress-fill ${isGraduated ? "is-graduated" : ""}`}
                            style={{ width: `${Math.min(100, item.bondingCurveProgress)}%` }}
                          />
                        </div>
                        <span className="bonding-progress-label">
                          {item.bondingCurveProgress.toFixed(1)}% {isGraduated ? "In Full Pool" : "Filled"} 🔍
                        </span>
                      </div>
                    </td>

                    {/* Market Cap */}
                    <td className="trends-td--mcap">
                      {item.marketCapUsd >= 1_000_000
                        ? `$${(item.marketCapUsd / 1_000_000).toFixed(2)}M`
                        : `$${(item.marketCapUsd / 1000).toFixed(1)}K`}
                    </td>

                    {/* Action Buttons */}
                    <td className="trends-td--actions">
                      <div className="trends-action-group">
                        <button
                          type="button"
                          className="community-action-btn is-swap"
                          onClick={() => setActiveSwapToken(item)}
                          title="Instant buy/sell swap"
                        >
                          Swap
                        </button>
                        <button
                          type="button"
                          className="community-action-btn is-bubble"
                          onClick={() => setActiveBubbleToken(item)}
                          title="View Bubblemaps cluster distribution"
                        >
                          Bubblemaps
                        </button>
                        <Link
                          href={`/launch?symbol=${item.pairedStockSymbol}`}
                          className="community-action-btn is-pair"
                          title="Launch another token paired to this stock"
                        >
                          Pair &amp; Launch
                        </Link>
                        <button
                          type="button"
                          className="community-action-btn is-share"
                          onClick={() =>
                            setActiveShareToken({
                              name: item.name,
                              symbol: item.symbol,
                              pairedStockSymbol: item.pairedStockSymbol,
                              creatorFeeBps: item.creatorFeeBps,
                              venue: item.venue,
                              mintAddress: item.mint,
                              imageUrl: item.imageUrl,
                            })
                          }
                          title="Share on X (Twitter)"
                        >
                          𝕏 Share
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid Cards View */}
      {viewMode === "grid" && filteredTokens.length > 0 && (
        <div className="community-cards-grid" style={{ marginTop: 24 }}>
          {filteredTokens.map((item) => {
            const isPositive = item.change24h >= 0;
            const isGraduated = item.bondingCurveProgress >= 100 || item.status === "graduated";

            return (
              <article key={item.mint} className="community-card">
                <div className="community-card__top">
                  <div className="community-card__avatars">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="community-card__avatar"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent && !parent.querySelector(".card-avatar-fallback")) {
                          const fallback = document.createElement("div");
                          fallback.className = "community-card__avatar card-avatar-fallback";
                          fallback.style.cssText = "display:grid;place-items:center;background:linear-gradient(135deg,#9945ff,#14f195);color:#fff;font-weight:800;font-size:14px;";
                          fallback.textContent = item.symbol.slice(0, 3).toUpperCase();
                          parent.prepend(fallback);
                        }
                      }}
                    />
                    <div className="community-card__stock-badge" title={`Paired against ${item.pairedStockSymbol}`}>
                      <StockLogo symbol={item.pairedStockSymbol} size={24} />
                    </div>
                  </div>
                  <span className={`trends-delta-pill ${isPositive ? "is-up" : "is-down"}`}>
                    {isPositive ? "+" : ""}{item.change24h}%
                  </span>
                </div>

                <div className="community-card__title-row">
                  <h3>{item.name}</h3>
                  <span className="community-card__sym">${item.symbol}</span>
                </div>

                <p className="community-card__desc">{item.description}</p>

                <div
                  className="community-card__bonding is-interactive"
                  onClick={() => setActiveMigrationToken(item)}
                  title="Click to view pool migration progress"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setActiveMigrationToken(item)}
                >
                  <div className="community-card__bonding-head">
                    <span>Curve Progress</span>
                    <strong>{item.bondingCurveProgress.toFixed(1)}% {isGraduated ? "✓ In Full Pool" : "🔍"}</strong>
                  </div>
                  <div className="bonding-progress-bar">
                    <div
                      className={`bonding-progress-fill ${isGraduated ? "is-graduated" : ""}`}
                      style={{ width: `${Math.min(100, item.bondingCurveProgress)}%` }}
                    />
                  </div>
                </div>

                <div className="community-card__meta">
                  <div>
                    <span>Price</span>
                    <strong>{formatTokenPrice(item.priceUsd)}</strong>
                  </div>
                  <div>
                    <span>24h Vol</span>
                    <strong>{formatTokenVolume(item.volume24hUsd)}</strong>
                  </div>
                  <div>
                    <span>Market Cap</span>
                    <strong>
                      {item.marketCapUsd >= 1_000_000
                        ? `$${(item.marketCapUsd / 1_000_000).toFixed(2)}M`
                        : `$${(item.marketCapUsd / 1000).toFixed(1)}K`}
                    </strong>
                  </div>
                </div>

                <div className="community-card__actions">
                  <button
                    type="button"
                    className="button button--gradient community-card__swap-btn"
                    onClick={() => setActiveSwapToken(item)}
                  >
                    Swap {item.symbol}
                  </button>
                  <button
                    type="button"
                    className="button button--light community-card__bubble-btn"
                    onClick={() => setActiveBubbleToken(item)}
                  >
                    Bubblemaps
                  </button>
                  <button
                    type="button"
                    className="button button--light community-card__share-btn"
                    onClick={() =>
                      setActiveShareToken({
                        name: item.name,
                        symbol: item.symbol,
                        pairedStockSymbol: item.pairedStockSymbol,
                        creatorFeeBps: item.creatorFeeBps,
                        venue: item.venue,
                        mintAddress: item.mint,
                        imageUrl: item.imageUrl,
                      })
                    }
                    title="Share on X"
                  >
                    𝕏 Share
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Active Modals */}
      {activeSwapToken && (
        <CommunitySwapModal
          token={activeSwapToken}
          onClose={() => setActiveSwapToken(null)}
          onTradeSuccess={handleTradeSuccess}
        />
      )}

      {activeBubbleToken && (
        <BubblemapsModal
          token={activeBubbleToken}
          onClose={() => setActiveBubbleToken(null)}
        />
      )}

      {activeMigrationToken && (
        <MigrationModal
          token={activeMigrationToken}
          onClose={() => setActiveMigrationToken(null)}
          onOpenSwap={(t) => {
            setActiveMigrationToken(null);
            setActiveSwapToken(t);
          }}
        />
      )}

      {activeShareToken && (
        <ShareToXModal
          token={activeShareToken}
          onClose={() => setActiveShareToken(null)}
        />
      )}
    </section>
  );
}
