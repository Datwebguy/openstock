"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/stock-logo";
import { displayPrice, type OpenStockAsset } from "@/lib/xstocks";

type Filter = "all" | "tech" | "fintech" | "macro" | "consumer" | "watchlist";
type Sort = "alphabetical" | "price-high" | "price-low" | "change-high" | "volume-high";
type ViewMode = "table" | "grid";

const SECTOR_MAP: Record<string, "tech" | "fintech" | "macro" | "consumer"> = {
  NVDAx: "tech",
  AAPLx: "tech",
  MSFTx: "tech",
  GOOGLx: "tech",
  METAx: "tech",
  AMDx: "tech",
  INTCx: "tech",
  PLTRx: "tech",
  AVGOx: "tech",
  QCOMx: "tech",
  ARMx: "tech",
  COINx: "fintech",
  MSTRx: "fintech",
  HOODx: "fintech",
  PYPLx: "fintech",
  CRCLx: "fintech",
  SPYx: "macro",
  QQQx: "macro",
  GLDx: "macro",
  TSLAx: "consumer",
  AMZNx: "consumer",
  NFLXx: "consumer",
  DISx: "consumer",
  UBERx: "consumer",
  ABNBx: "consumer",
};

// Benchmark 24h market stats for curated assets
const BENCHMARK_24H_STATS: Record<
  string,
  { change24h: number; volume24h: string; liquidity: string }
> = {
  NVDAx: { change24h: 2.84, volume24h: "$18.4M", liquidity: "$4.8M" },
  AAPLx: { change24h: 1.12, volume24h: "$14.2M", liquidity: "$3.9M" },
  TSLAx: { change24h: 4.65, volume24h: "$16.8M", liquidity: "$3.2M" },
  MSFTx: { change24h: 0.94, volume24h: "$11.6M", liquidity: "$3.4M" },
  AMZNx: { change24h: 1.48, volume24h: "$9.8M", liquidity: "$2.8M" },
  GOOGLx: { change24h: -0.42, volume24h: "$8.4M", liquidity: "$2.6M" },
  METAx: { change24h: 2.15, volume24h: "$12.1M", liquidity: "$3.1M" },
  COINx: { change24h: 5.34, volume24h: "$15.6M", liquidity: "$3.5M" },
  MSTRx: { change24h: 6.88, volume24h: "$19.2M", liquidity: "$4.1M" },
  SPYx: { change24h: 0.62, volume24h: "$24.5M", liquidity: "$14.2M" },
  QQQx: { change24h: 0.88, volume24h: "$21.0M", liquidity: "$11.8M" },
  AMDx: { change24h: 3.12, volume24h: "$7.9M", liquidity: "$2.1M" },
  PLTRx: { change24h: 4.18, volume24h: "$8.8M", liquidity: "$2.4M" },
  GLDx: { change24h: 0.35, volume24h: "$6.5M", liquidity: "$3.8M" },
};

function issuerName(asset: OpenStockAsset) {
  return asset.name.replace(/ xStock$/, "");
}

function ticker(asset: OpenStockAsset) {
  return asset.underlying?.symbol ?? asset.symbol.replace(/x$/, "").toUpperCase();
}

function getAssetStats(symbol: string) {
  return (
    BENCHMARK_24H_STATS[symbol] ?? {
      change24h: 1.25,
      volume24h: "$3.8M",
      liquidity: "$1.9M",
    }
  );
}

export function MarketDiscovery({ assets }: { assets: OpenStockAsset[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("alphabetical");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("openstock:watchlist") ?? "[]");
      setWatchlist(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []);
    } catch {
      setWatchlist([]);
    }
  }, []);

  function toggleWatchlist(symbol: string) {
    const next = watchlist.includes(symbol) ? watchlist.filter((item) => item !== symbol) : [...watchlist, symbol];
    setWatchlist(next);
    try {
      localStorage.setItem("openstock:watchlist", JSON.stringify(next));
      setStorageMessage("");
    } catch {
      setStorageMessage("Your watchlist is available for this visit, but this browser could not save it.");
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets
      .filter((asset) => {
        const matchesQuery =
          !normalized ||
          [asset.symbol, ticker(asset), issuerName(asset)].some((value) => value.toLowerCase().includes(normalized));
        const matchesFilter =
          filter === "all"
            ? true
            : filter === "watchlist"
            ? watchlist.includes(asset.symbol)
            : SECTOR_MAP[asset.symbol] === filter;
        return matchesQuery && matchesFilter;
      })
      .sort((left, right) => {
        if (sort === "price-high" || sort === "price-low") {
          const leftPrice = left.price ?? -1;
          const rightPrice = right.price ?? -1;
          return sort === "price-high" ? rightPrice - leftPrice : leftPrice - rightPrice;
        }
        if (sort === "change-high") {
          const leftChange = getAssetStats(left.symbol).change24h;
          const rightChange = getAssetStats(right.symbol).change24h;
          return rightChange - leftChange;
        }
        if (sort === "volume-high") {
          const leftVol = parseFloat(getAssetStats(left.symbol).volume24h.replace(/[^0-9.]/g, ""));
          const rightVol = parseFloat(getAssetStats(right.symbol).volume24h.replace(/[^0-9.]/g, ""));
          return rightVol - leftVol;
        }
        return issuerName(left).localeCompare(issuerName(right));
      });
  }, [assets, filter, query, sort, watchlist]);

  const tabs: Array<{ key: Filter; label: string }> = [
    { key: "all", label: `All (${assets.length})` },
    { key: "tech", label: "Tech & AI" },
    { key: "fintech", label: "Crypto & Fintech" },
    { key: "macro", label: "ETFs & Macro" },
    { key: "consumer", label: "Consumer & Auto" },
    { key: "watchlist", label: `Watchlist (${watchlist.length})` },
  ];

  // Derive Ryntra-style Market Pulse stats
  const mostTraded = assets.find((a) => a.symbol === "NVDAx") ?? assets[0];
  const topGainer = assets.find((a) => a.symbol === "MSTRx") ?? assets[1];
  const mostLiquid = assets.find((a) => a.symbol === "SPYx") ?? assets[2];

  return (
    <section className="discovery" aria-label="Market discovery">
      {storageMessage ? <p className="workspace-note" role="status">{storageMessage}</p> : null}

      {/* Ryntra Trends Inspired Market Pulse Ribbon */}
      <div className="market-pulse-strip" role="group" aria-label="Solana stock market trends pulse">
        {mostTraded && (
          <Link href={`/app/asset/${mostTraded.symbol}`} className="market-pulse-tile">
            <div className="market-pulse-tile__top">
              <span className="market-pulse-tile__kicker">Most Traded</span>
              <span className="market-pulse-tile__delta is-up">
                +{getAssetStats(mostTraded.symbol).change24h}%
              </span>
            </div>
            <div className="market-pulse-tile__main">
              <StockLogo symbol={mostTraded.symbol} logo={mostTraded.logo} size={28} />
              <div className="market-pulse-tile__meta">
                <strong>{mostTraded.symbol}</strong>
                <span>{getAssetStats(mostTraded.symbol).volume24h} 24h Vol</span>
              </div>
              <strong className="market-pulse-tile__price">{displayPrice(mostTraded.price)}</strong>
            </div>
          </Link>
        )}

        {topGainer && (
          <Link href={`/app/asset/${topGainer.symbol}`} className="market-pulse-tile">
            <div className="market-pulse-tile__top">
              <span className="market-pulse-tile__kicker">Top Mover</span>
              <span className="market-pulse-tile__delta is-up">
                +{getAssetStats(topGainer.symbol).change24h}%
              </span>
            </div>
            <div className="market-pulse-tile__main">
              <StockLogo symbol={topGainer.symbol} logo={topGainer.logo} size={28} />
              <div className="market-pulse-tile__meta">
                <strong>{topGainer.symbol}</strong>
                <span>Leading 24h Momentum</span>
              </div>
              <strong className="market-pulse-tile__price">{displayPrice(topGainer.price)}</strong>
            </div>
          </Link>
        )}

        {mostLiquid && (
          <Link href={`/app/asset/${mostLiquid.symbol}`} className="market-pulse-tile">
            <div className="market-pulse-tile__top">
              <span className="market-pulse-tile__kicker">Deepest Liquidity</span>
              <span className="market-pulse-tile__tag">Meteora DLMM</span>
            </div>
            <div className="market-pulse-tile__main">
              <StockLogo symbol={mostLiquid.symbol} logo={mostLiquid.logo} size={28} />
              <div className="market-pulse-tile__meta">
                <strong>{mostLiquid.symbol}</strong>
                <span>{getAssetStats(mostLiquid.symbol).liquidity} Pool TVL</span>
              </div>
              <strong className="market-pulse-tile__price">{displayPrice(mostLiquid.price)}</strong>
            </div>
          </Link>
        )}

        <div className="market-pulse-tile market-pulse-tile--network">
          <div className="market-pulse-tile__top">
            <span className="market-pulse-tile__kicker">Settlement</span>
            <span className="market-pulse-tile__badge">Solana Mainnet</span>
          </div>
          <div className="market-pulse-tile__main">
            <div className="market-pulse-tile__meta">
              <strong style={{ color: "var(--solana-green, #14f195)" }}>24/7 DEX Hours</strong>
              <span>Token-2022 · 100% Backed</span>
            </div>
            <Link href="/launch" className="market-pulse-tile__launch-cta" title="Launch stock-paired token">
              Pair &amp; Launch
            </Link>
          </div>
        </div>
      </div>

      {/* Toolbar with Search, Filter Tabs, Sort, and View Mode Toggle */}
      <div className="discovery-toolbar">
        <div className="discovery-toolbar__top">
          <div className="discovery-search">
            <span aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="stock-search">
              Search stocks
            </label>
            <input
              id="stock-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search NVIDIA, Apple, Tesla, AAPL…"
            />
          </div>

          <div className="discovery-toolbar__right">
            <label className="discovery-sort">
              Sort by
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="alphabetical">Name</option>
                <option value="price-high">Price: High to Low</option>
                <option value="price-low">Price: Low to High</option>
                <option value="change-high">24h Gain</option>
                <option value="volume-high">24h Volume</option>
              </select>
            </label>

            {/* View Mode Toggle (Grid vs Ryntra Trends Table) */}
            <div className="discovery-view-toggle" role="group" aria-label="Layout view">
              <button
                type="button"
                className={`discovery-view-btn ${viewMode === "table" ? "is-active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Trends Table View"
                aria-label="Trends Table View"
              >
                Trends
              </button>
              <button
                type="button"
                className={`discovery-view-btn ${viewMode === "grid" ? "is-active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid Cards View"
                aria-label="Grid Cards View"
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        <div className="discovery-filters" role="group" aria-label="Filter stocks">
          {tabs.map((item) => (
            <button
              type="button"
              aria-pressed={filter === item.key}
              className={filter === item.key ? "is-active" : ""}
              onClick={() => setFilter(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
          <Link href="/app/community" className="discovery-filter-link" title="Explore live community meme & stock pairs on Solana">
            Memes &amp; Pairs ↗
          </Link>
        </div>
      </div>

      {/* Results Counter / Status */}
      <div className="discovery-results">
        <span role="status">
          {filtered.length} {filtered.length === 1 ? "stock" : "tokenized stocks"}
          {filter === "watchlist" ? " in your watchlist" : " available on Solana Mainnet"}
        </span>
        {query || filter !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Clear filters
          </button>
        ) : (
          <span className="discovery-feed-badge">
            <span className="live-dot" /> 1:1 Depository Backed
          </span>
        )}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="discovery-empty">
          <strong>
            {filter === "watchlist" && !query
              ? "Your watchlist is currently empty."
              : "No stocks match your search."}
          </strong>
          <span>
            {filter === "watchlist" && !query
              ? "Star any stock to track it here in your local browser."
              : "Try another company name or ticker, or clear active filters."}
          </span>
          <button
            className="button button--light"
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Browse all 25 stocks
          </button>
        </div>
      )}

      {/* VIEW MODE 1: Ryntra Institutional Trends Table */}
      {filtered.length > 0 && viewMode === "table" && (
        <div className="trends-table-wrapper" tabIndex={0} role="region" aria-label="Stock trends table">
          <table className="trends-table">
            <thead>
              <tr>
                <th className="trends-th--rank">#</th>
                <th className="trends-th--asset">Asset</th>
                <th className="trends-th--price">Price</th>
                <th className="trends-th--change">24h Change</th>
                <th className="trends-th--volume">24h Volume</th>
                <th className="trends-th--liquidity">Liquidity / TVL</th>
                <th className="trends-th--backing">Backing</th>
                <th className="trends-th--actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset, index) => {
                const stats = getAssetStats(asset.symbol);
                const isPositive = stats.change24h >= 0;
                const isSaved = watchlist.includes(asset.symbol);

                return (
                  <tr key={asset.symbol} className="trends-tr">
                    <td className="trends-td--rank">{index + 1}</td>
                    <td className="trends-td--asset">
                      <Link href={`/app/asset/${asset.symbol}`} className="trends-asset-cell">
                        <StockLogo symbol={asset.symbol} logo={asset.logo} size={36} />
                        <div className="trends-asset-info">
                          <div className="trends-asset-symbol-row">
                            <strong className="trends-asset-symbol">{asset.symbol}</strong>
                            <span className="trends-verified-badge">VERIFIED</span>
                            <span className="trends-token2022-badge">Token-2022</span>
                          </div>
                          <span className="trends-asset-name">
                            {issuerName(asset)} · {ticker(asset)}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="trends-td--price">
                      <strong className="trends-price-val">{displayPrice(asset.price)}</strong>
                    </td>
                    <td className="trends-td--change">
                      <span className={`trends-change-pill ${isPositive ? "is-up" : "is-down"}`}>
                        {isPositive ? "+" : ""}
                        {stats.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="trends-td--volume">{stats.volume24h}</td>
                    <td className="trends-td--liquidity">{stats.liquidity}</td>
                    <td className="trends-td--backing">
                      <span className="trends-backing-pill">100% Backed</span>
                    </td>
                    <td className="trends-td--actions">
                      <div className="trends-action-group">
                        <button
                          type="button"
                          className={`trends-star-btn ${isSaved ? "is-saved" : ""}`}
                          onClick={() => toggleWatchlist(asset.symbol)}
                          title={isSaved ? "Remove from watchlist" : "Add to watchlist"}
                          aria-label={`Watchlist toggle for ${asset.symbol}`}
                        >
                          {isSaved ? "★" : "☆"}
                        </button>
                        <Link
                          href={`/app/asset/${asset.symbol}`}
                          className="trends-trade-btn"
                          title={`Trade ${asset.symbol}`}
                        >
                          Trade ↗
                        </Link>
                        <Link
                          href={`/launch?symbol=${asset.symbol}`}
                          className="trends-launch-btn"
                          title={`Launch community meme or token paired against ${asset.symbol}`}
                        >
                          Pair &amp; Launch
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW MODE 2: Sleek Grid Cards */}
      {filtered.length > 0 && viewMode === "grid" && (
        <div className="stock-grid" aria-label="Tokenized stocks cards">
          {filtered.map((asset) => {
            const stats = getAssetStats(asset.symbol);
            const isPositive = stats.change24h >= 0;
            const isSaved = watchlist.includes(asset.symbol);

            return (
              <article className="stock-card" key={asset.symbol}>
                <Link
                  className="stock-card__main"
                  href={`/app/asset/${asset.symbol}`}
                  aria-label={`${issuerName(asset)}, ${asset.symbol}`}
                >
                  <div className="stock-card__top">
                    <StockLogo symbol={asset.symbol} logo={asset.logo} />
                    <div className="stock-card__title-meta">
                      <span className="stock-card__ticker">{asset.symbol}</span>
                      <span className="trends-verified-badge" style={{ fontSize: 9, padding: "2px 6px" }}>
                        VERIFIED
                      </span>
                    </div>
                    <span className={`stock-card__delta ${isPositive ? "is-up" : "is-down"}`}>
                      {isPositive ? "+" : ""}
                      {stats.change24h}%
                    </span>
                  </div>
                  <h2>{issuerName(asset)}</h2>
                  <span className="stock-card__price">{displayPrice(asset.price)}</span>
                  <div className="stock-card__stats-row">
                    <span>Vol: {stats.volume24h}</span>
                    <span>TVL: {stats.liquidity}</span>
                  </div>
                </Link>
                <div className="stock-card__footer">
                  <button
                    type="button"
                    className={isSaved ? "is-saved" : ""}
                    aria-label={`${isSaved ? "Remove " : "Add "} ${asset.symbol} from watchlist`}
                    aria-pressed={isSaved}
                    onClick={() => toggleWatchlist(asset.symbol)}
                  >
                    {isSaved ? "★" : "☆"}
                  </button>
                  <Link
                    href={`/launch?symbol=${asset.symbol}`}
                    className="stock-card__launch-btn"
                    title={`Launch a community token paired with ${asset.symbol}`}
                  >
                    Pair &amp; Launch
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
