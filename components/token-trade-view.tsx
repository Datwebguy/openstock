"use client";

import { useState } from "react";
import Link from "next/link";
import { executeCommunitySwap, NoRouteError } from "@/lib/community-swap";
import type { CommunityToken } from "@/lib/community-tokens";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import { ShareToXModal } from "@/components/share-to-x-modal";
import { BubblemapsModal } from "@/components/bubblemaps-modal";
import { getStockCompany, formatStockTicker, TOKENIZED_STOCK_SAFE_WORDING } from "@/lib/tokenized-stock-wording";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { curveStatusLabel, dexLabel, formatMarketCap, formatTokenPrice, formatTokenVolume, isLookalikeTicker, isOnAmmPool } from "@/lib/community-token-utils";

interface TokenTradeViewProps {
  token: CommunityToken | null;
  mint: string;
  initialColor?: string;
}

function quoteMintFor(token: CommunityToken) {
  return VERIFIED_SOLANA_XSTOCKS_PAIRS.find((pair) => pair.symbol === token.pairedStockSymbol)?.mint ?? null;
}

export function TokenTradeView({ token, mint, initialColor }: TokenTradeViewProps) {
  const { address, canSign, connect, signTransaction } = useWallet();

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBubbleModal, setShowBubbleModal] = useState(false);

  // Trading state
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("1");
  const [slippage, setSlippage] = useState<number>(1.0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<{ signature: string; received: string } | null>(null);
  const [bondingNotice, setBondingNotice] = useState<{ message: string; url: string; label: string } | null>(null);

  if (!token) {
    return (
      <div className="token-not-found-card">
        <div className="token-not-found-icon">🔍</div>
        <h2 className="token-not-found-title">Token not found</h2>
        <p className="token-not-found-desc">
          No stock-paired community token was found with mint address:
        </p>
        <code className="token-not-found-mint">{mint}</code>
        <div className="token-not-found-actions">
          <Link href="/app/community" className="button button--gradient">
            Browse Community Pairs ↗
          </Link>
          <Link href="/launch" className="workspace-pill-link workspace-pill-link--secondary">
            Launch New Stock Pair ↗
          </Link>
        </div>
      </div>
    );
  }

  const stockCompany = getStockCompany(token.pairedStockSymbol);
  const stockX = formatStockTicker(token.pairedStockSymbol);
  const cleanSymbol = token.symbol.startsWith("$") ? token.symbol.slice(1) : token.symbol;
  const isGraduated = isOnAmmPool(token);
  const lookalike = isLookalikeTicker(token.symbol);

  const parsedAmount = parseFloat(amount) || 0;
  const quoteMint = quoteMintFor(token);
  const quoteSymbol = token.pairedStockSymbol;

  async function handleExecuteTrade() {
    if (!token) return;

    if (!address || !canSign) {
      try {
        await connect();
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
      return;
    }

    if (parsedAmount <= 0) return;
    if (!quoteMint) {
      setSwapError(`No verified ${quoteSymbol} mint is available for this pair.`);
      return;
    }

    setIsSwapping(true);
    setSwapError(null);
    setBondingNotice(null);
    setTxSuccess(null);

    try {
      const result = await executeCommunitySwap({
        inputMint: side === "buy" ? quoteMint : token.mint,
        outputMint: side === "buy" ? token.mint : quoteMint,
        uiAmount: parsedAmount,
        slippageBps: Math.round(slippage * 100),
        wallet: address,
        sign: signTransaction,
      });
      const outSymbol = side === "buy" ? token.symbol : quoteSymbol;
      const inSymbol = side === "buy" ? quoteSymbol : token.symbol;
      setTxSuccess({
        signature: result.signature,
        received: `${result.inputUi} ${inSymbol} → ≈ ${result.expectedOutUi.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outSymbol}`,
      });
      
    } catch (err: unknown) {
      if (err instanceof NoRouteError) {
        const poolUrl = token.meteoraUrl || token.pumpUrl || `https://jup.ag/swap/${quoteMint}-${token.mint}`;
        setBondingNotice({
          message: token.dexId === "pumpfun" || !token.progressKnown
            ? "Jupiter has no route yet — this token still trades on its bonding curve. Trade it on the pool:"
            : "Jupiter has no route for this pair right now. Trade it on the pool:",
          url: poolUrl,
          label: token.dexId === "pumpfun" ? "Pump.fun" : "Open pool",
        });
      } else {
        setSwapError(err instanceof Error ? err.message : "Swap failed to execute.");
      }
    } finally {
      setIsSwapping(false);
    }
  }

  return (
    <div className="token-trade-layout">
      {/* Hero Header */}
      <div className="token-trade-hero">
        <div className="token-trade-hero__left">
          <div className="token-trade-avatar-wrap">
            {token.imageUrl ? (
              <img
                src={token.imageUrl}
                alt={token.name}
                className="token-trade-avatar"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "grid";
                }}
              />
            ) : null}
            <div
              className="token-trade-avatar token-trade-avatar--fallback"
              style={{ display: token.imageUrl ? "none" : "grid" }}
            >
              {cleanSymbol.slice(0, 2)}
            </div>
          </div>

          <div className="token-trade-meta">
            <div className="token-trade-title-row">
              <h1 className="token-trade-title">${cleanSymbol}</h1>
              <span className="token-trade-chip">{curveStatusLabel(token)}</span>
              <span className="token-trade-chip">{token.source === "openstock" ? "Launched on OpenStock" : "Discovered pool"}</span>
            </div>
            <div className="token-trade-name">{token.name}</div>
            {lookalike ? (
              <p className="token-trade-paired-wording" role="note">
                ⚠ This ticker copies a stock, stablecoin or major token. It is an unrelated token — check the mint.
              </p>
            ) : null}
            <div className="token-trade-paired-wording">
              <span className="token-trade-paired-dot" aria-hidden="true" />
              <span>
                Paired with tokenized {stockCompany.companyName} stock ({stockX}) on Solana
              </span>
            </div>
          </div>
        </div>

        <div className="token-trade-hero__actions">
          <button
            type="button"
            className="share-btn-secondary"
            onClick={() => setShowShareModal(true)}
            title="Share to X"
          >
            Share to X ↗
          </button>
          <button
            type="button"
            className="share-btn-secondary"
            onClick={() => setShowBubbleModal(true)}
            title="Top holders from Solana"
          >
            Holders
          </button>
          <a
            href={token.explorerUrl || `https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="share-btn-secondary"
          >
            Solscan ↗
          </a>
        </div>
      </div>

      {/* Main Grid: Metrics on Left, Trade Swap Box on Right */}
      <div className="token-trade-grid">
        {/* Left Column: Live Market Metrics & Bonding Curve */}
        <div className="token-trade-col-left">
          {/* Key Metrics Cards */}
          <div className="token-metrics-row">
            <div className="token-metric-card">
              <div className="token-metric-label">Price USD</div>
              <div className="token-metric-value">{formatTokenPrice(token.priceUsd)}</div>
              <div className="token-metric-sub">
                {token.priceInPairedStock ? `${token.priceInPairedStock.toPrecision(4)} ${token.pairedStockSymbol}` : `DexScreener · ${dexLabel(token)}`}
              </div>
            </div>

            <div className="token-metric-card">
              <div className="token-metric-label">24h Change</div>
              <div
                className={`token-metric-value ${
                  token.change24h >= 0 ? "is-positive" : "is-negative"
                }`}
              >
                {!token.change24h ? "—" : token.change24h >= 0 ? `+${token.change24h.toFixed(1)}%` : `${token.change24h.toFixed(1)}%`}
              </div>
              <div className="token-metric-sub">DexScreener 24h</div>
            </div>

            <div className="token-metric-card">
              <div className="token-metric-label">24h Volume</div>
              <div className="token-metric-value">{formatTokenVolume(token.volume24hUsd)}</div>
              <div className="token-metric-sub">Pools quoted in {token.pairedStockSymbol}</div>
            </div>

            <div className="token-metric-card">
              <div className="token-metric-label">Market Cap</div>
              <div className="token-metric-value">{formatMarketCap(token.marketCapUsd)}</div>
              <div className="token-metric-sub">DexScreener</div>
            </div>
          </div>

          {/* Bonding Curve Card */}
          <div className="token-curve-card">
            <div className="token-curve-header">
              <div>
                <h3 className="token-curve-title">Where it trades</h3>
                <p className="token-curve-desc">
                  {isGraduated
                    ? `Trading on a ${dexLabel(token)} pool against ${token.pairedStockSymbol}.`
                    : token.progressKnown
                    ? `Still on its bonding curve. Progress is read from the pool on Solana.`
                    : `Still on its ${dexLabel(token)} bonding curve. Progress is not published by this venue.`}
                </p>
              </div>
              <div className="token-curve-pct">{isGraduated ? "Pool" : token.progressKnown ? `${token.bondingCurveProgress.toFixed(1)}%` : "Curve"}</div>
            </div>

            {isGraduated || token.progressKnown ? (
              <div className="token-progress-bar-wrap">
                <div
                  className="token-progress-bar-fill"
                  style={{ width: `${isGraduated ? 100 : Math.min(100, Math.max(0, token.bondingCurveProgress))}%` }}
                />
              </div>
            ) : null}
          </div>

          {/* Pair Collateral Details */}
          <div className="token-pair-details-card">
            <div className="token-pair-details-title">Paired Stock Collateral</div>
            <div className="token-pair-stock-row">
              <StockLogo symbol={token.pairedStockSymbol} size={40} />
              <div>
                <div className="token-pair-stock-symbol">{stockX}</div>
                <div className="token-pair-stock-name">{stockCompany.fullName}</div>
              </div>
            </div>
            <div className="token-pair-notice">
              {TOKENIZED_STOCK_SAFE_WORDING.disclaimer}
            </div>
          </div>
        </div>

        {/* Right Column: One-Click Instant Trade Box */}
        <div className="token-trade-col-right">
          <div className="token-swap-box">
            <div className="token-swap-box__header">
              <h2 className="token-swap-box__title">Direct Trade</h2>
              <span className="token-swap-box__sub">
                {side === "buy" ? `Buy $${cleanSymbol} with ${stockX}` : `Sell $${cleanSymbol} for ${stockX}`}
              </span>
            </div>

            {/* Buy / Sell Tabs */}
            <div className="token-swap-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={side === "buy"}
                className={`token-swap-tab is-buy ${side === "buy" ? "is-active" : ""}`}
                onClick={() => setSide("buy")}
              >
                Buy ${cleanSymbol}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={side === "sell"}
                className={`token-swap-tab is-sell ${side === "sell" ? "is-active" : ""}`}
                onClick={() => setSide("sell")}
              >
                Sell ${cleanSymbol}
              </button>
            </div>

            {/* Amount Input */}
            <div className="token-swap-input-group">
              <div className="token-swap-input-label-row">
                <label htmlFor="token-trade-amount" className="token-swap-input-label">
                  You Pay
                </label>
                <span className="token-swap-asset-tag">
                  {side === "buy" ? stockX : `$${cleanSymbol}`}
                </span>
              </div>
              <input
                id="token-trade-amount"
                type="number"
                min="0"
                step="any"
                className="token-swap-input"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="token-swap-quick-amounts">
                {["1", "5", "10", "25", "100"].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    className="token-quick-btn"
                    onClick={() => setAmount(quick)}
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>

            {/* Slippage tolerance */}
            <div className="token-slippage-row">
              <span className="token-slippage-label">Slippage Tolerance</span>
              <div className="token-slippage-options">
                {[0.5, 1.0, 2.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`token-slip-btn ${slippage === s ? "is-active" : ""}`}
                    onClick={() => setSlippage(s)}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>

            {/* Swap Messages */}
            {swapError && <div className="token-swap-alert is-error">{swapError}</div>}
            {txSuccess && (
              <div className="token-swap-alert is-success">
                <div>Confirmed on Solana: {txSuccess.received}</div>
                <a
                  href={`https://solscan.io/tx/${txSuccess.signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="token-swap-tx-link"
                >
                  View signature ↗
                </a>
              </div>
            )}
            {bondingNotice && (
              <div className="token-swap-alert is-notice">
                <div>{bondingNotice.message}</div>
                <a
                  href={bondingNotice.url}
                  target="_blank"
                  rel="noreferrer"
                  className="button button--gradient token-swap-pool-btn"
                >
                  {bondingNotice.label} ↗
                </a>
              </div>
            )}

            {/* Swap Action Button */}
            <button
              type="button"
              className="button button--gradient token-swap-submit-btn"
              onClick={handleExecuteTrade}
              disabled={isSwapping}
            >
              {isSwapping
                ? "Processing on Solana..."
                : !address
                ? "Connect Wallet to Trade"
                : side === "buy"
                ? `Buy $${cleanSymbol}`
                : `Sell $${cleanSymbol}`}
            </button>

            {address && (
              <div className="token-wallet-status">
                Connected: <code>{shortWallet(address)}</code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareToXModal
          token={{
            name: token.name,
            symbol: token.symbol,
            pairedStockSymbol: token.pairedStockSymbol,
            creatorFeeBps: token.creatorFeeBps,
            venue: token.venue,
            mintAddress: token.mint,
            imageUrl: token.imageUrl,
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Bubblemaps Modal */}
      {showBubbleModal && (
        <BubblemapsModal
          token={token}
          onClose={() => setShowBubbleModal(false)}
        />
      )}
    </div>
  );
}
