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
  change24h = 1.84,
  liquidityUsd = "$1.9M",
  volume24h = "$6.2M",
  oraclePrice,
  reserveCoverage = "100% Backed",
  mintAddress = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  decimals = 6,
  venueStatus,
  sessionStatus,
}: ProStockHeaderProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
              <span className="pro-asset-header__program-pill">Token-2022</span>
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
          <strong className="pro-asset-header__price-val">{priceFormatted}</strong>
          <span className={`pro-asset-header__change-pill ${isPositive ? "is-up" : "is-down"}`}>
            {changeFormatted} · 24h
          </span>
        </div>

        <div className="pro-asset-header__cta-box">
          <Link
            href={`/launch?symbol=${symbol}`}
            className="button button--gradient pro-asset-header__launch-cta"
            title={`Launch a community meme or token paired with ${symbol}`}
          >
            <span>Pair &amp; Launch Token</span>
          </Link>
        </div>
      </div>

      {/* Ryntra-Style Horizontal Metric Strip */}
      <div className="pro-asset-header__metrics-strip" role="group" aria-label="Key asset metrics">
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">LIQUIDITY</span>
          <strong className="pro-asset-header__metric-val">{liquidityUsd}</strong>
        </div>
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">VOLUME 24H</span>
          <strong className="pro-asset-header__metric-val">{volume24h}</strong>
        </div>
        <div className="pro-asset-header__metric">
          <span className="pro-asset-header__metric-label">ORACLE BENCHMARK</span>
          <strong className="pro-asset-header__metric-val">{oraclePrice || priceFormatted}</strong>
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
                <span>Solana Mint</span>
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
                <span>Token Program</span>
                <strong>Token-2022 (Spl-Token-2022)</strong>
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
