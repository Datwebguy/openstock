"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StockLogo } from "@/components/stock-logo";

type ProStockHeaderProps = {
  symbol: string;
  name: string;
  logo?: string;
  underlyingSymbol?: string;
  price: number | null;
  officialReady: boolean;
  priceFormatted: string;
  change24h?: number | null;
  liquidityUsd?: string;
  volume24h?: string;
  oraclePrice?: string;
  reserveCoverage?: string;
  mintAddress?: string;
  decimals?: number | null;
  venueStatus: string;
  sessionStatus: string;
};

export function ProStockHeader({
  symbol,
  name,
  logo,
  underlyingSymbol,
  priceFormatted,
  change24h,
  liquidityUsd,
  volume24h,
  oraclePrice,
  reserveCoverage = "Reserve unavailable",
  mintAddress = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  decimals = 6,
  venueStatus,
  sessionStatus,
}: ProStockHeaderProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentPriceStr, setCurrentPriceStr] = useState(priceFormatted);
  const [currentLiquidity, setCurrentLiquidity] = useState(liquidityUsd || "Unavailable");
  const [currentVolume, setCurrentVolume] = useState(volume24h || "Unavailable");
  const [isLivePulse, setIsLivePulse] = useState(false);

  // 10-Second Live Polling from Solana Meteora Pool & Oracle Stream
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/market-stream/${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.price === "number" && data.price > 0) {
          setCurrentPriceStr(`$${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          setIsLivePulse(true);
          setTimeout(() => setIsLivePulse(false), 1200);
        }
        if (typeof data.liquidity === "number" && data.liquidity > 0) {
          setCurrentLiquidity(`$${data.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        }
        if (typeof data.volume24h === "number" && data.volume24h > 0) {
          setCurrentVolume(`$${data.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        }
      } catch {
        // quiet catch
      }
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("openstock:watchlist") ?? "[]");
      if (Array.isArray(saved) && saved.includes(symbol)) {
        setIsSaved(true);
      }
    } catch {
      setIsSaved(false);
    }
  }, [symbol]);

  function toggleWatchlist() {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("openstock:watchlist") ?? "[]");
      const list = Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
      const next = list.includes(symbol) ? list.filter((s) => s !== symbol) : [...list, symbol];
      localStorage.setItem("openstock:watchlist", JSON.stringify(next));
      setIsSaved(next.includes(symbol));
    } catch {
      setIsSaved(!isSaved);
    }
  }

  function copyMint() {
    if (!mintAddress) return;
    navigator.clipboard.writeText(mintAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isPositive = change24h === null || change24h === undefined ? true : change24h >= 0;
  const changeFormatted = change24h === null || change24h === undefined
    ? "+0.00%"
    : `${isPositive ? "+" : ""}${change24h.toFixed(2)}%`;

  return (
    <div className="pro-asset-header">
      {/* Top Identity & Star Row */}
      <div className="pro-asset-header__identity-row">
        <div className="pro-asset-header__left">
          <StockLogo symbol={symbol} logo={logo} size={54} />
          <div className="pro-asset-header__titles">
            <div className="pro-asset-header__title-line">
              <h1 className="pro-asset-header__symbol">{symbol}</h1>
              <span className="pro-asset-header__verified-badge">VERIFIED</span>
              <span className="pro-asset-header__program-pill">Backed Equity</span>
            </div>
            <p className="pro-asset-header__subname">
              {name.replace(/ xStock$/, "")} · {underlyingSymbol || symbol.replace(/x$/, "")} · 1:1 Backed Equity
            </p>
          </div>
        </div>

        <div className="pro-asset-header__right-actions">
          <button
            type="button"
            className={`pro-asset-header__star-btn ${isSaved ? "is-active" : ""}`}
            onClick={toggleWatchlist}
            aria-label={isSaved ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
            title={isSaved ? "Saved to watchlist" : "Save to watchlist"}
          >
            {isSaved ? "★" : "☆"}
          </button>
        </div>
      </div>

      {/* Hero Price & 24h Delta Line */}
      <div className="pro-asset-header__price-row">
        <div className="pro-asset-header__price-box">
          <strong className={`pro-asset-header__price-val ${isLivePulse ? "is-live-flashing" : ""}`}>
            {currentPriceStr}
          </strong>
          <span className={`pro-asset-header__change-pill ${isPositive ? "is-up" : "is-down"}`}>
            {changeFormatted} · 24h
          </span>
        </div>

        <div className="pro-asset-header__cta-box">
          <Link
            href={`/launch?symbol=${encodeURIComponent(symbol)}&quick=1`}
            className="button button--gradient pro-asset-header__launch-cta"
            title={`One-tap launch a TOKEN × ${symbol} pair`}
          >
            <span>Launch against {symbol}</span>
          </Link>
        </div>
      </div>

      {/* Ryntra-Style Horizontal Metric Strip */}
      <div className="pro-asset-header__metrics-strip" role="group" aria-label="Key asset metrics">
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">LIQUIDITY</span>
          <strong className="pro-asset-header__metric-val">{currentLiquidity}</strong>
        </div>
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">VOLUME 24H</span>
          <strong className="pro-asset-header__metric-val">{currentVolume}</strong>
        </div>
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">ORACLE BENCHMARK</span>
          <strong className="pro-asset-header__metric-val">{oraclePrice || currentPriceStr}</strong>
        </div>
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">RESERVES</span>
          <strong className="pro-asset-header__metric-val" style={{ color: "var(--solana-green, #14f195)" }}>
            {reserveCoverage}
          </strong>
        </div>
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">SETTLEMENT</span>
          <strong className="pro-asset-header__metric-val">Solana Mainnet</strong>
        </div>
      </div>

      {/* Collapsible Asset Details Drawer */}
      <div className="pro-asset-header__details-drawer">
        <button
          type="button"
          className="pro-asset-header__details-toggle"
          onClick={() => setDetailsOpen(!detailsOpen)}
          aria-expanded={detailsOpen}
        >
          <span className="pro-asset-header__details-chevron">{detailsOpen ? "▾" : "▸"}</span>
          <span>ASSET DETAILS</span>
        </button>

        {detailsOpen && (
          <div className="pro-asset-header__details-content">
            <div className="pro-asset-header__details-grid">
              <div className="pro-asset-header__detail-item">
                <span>Asset Identifier</span>
                <div className="pro-asset-header__mint-copy">
                  <code>{mintAddress.slice(0, 8)}...{mintAddress.slice(-8)}</code>
                  <button type="button" onClick={copyMint} className="pro-asset-header__copy-btn">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <a
                    href={`https://solscan.io/token/${mintAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pro-asset-header__solscan-link"
                  >
                    Solscan ↗
                  </a>
                </div>
              </div>

              <div className="pro-asset-header__detail-item">
                <span>Asset Standard</span>
                <strong>Solana Backed Stock (1:1 Reserved)</strong>
              </div>

              <div className="pro-asset-header__detail-item">
                <span>Decimals</span>
                <strong>{decimals}</strong>
              </div>

              <div className="pro-asset-header__detail-item">
                <span>Issuer &amp; Custody</span>
                <strong>Backed Finance AG (1:1 Equity Depository)</strong>
              </div>

              <div className="pro-asset-header__detail-item">
                <span>Trading Venue</span>
                <strong>{venueStatus} · {sessionStatus}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
