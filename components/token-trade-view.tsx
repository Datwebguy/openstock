"use client";

import { useState } from "react";
import Link from "next/link";
import { VersionedTransaction } from "@solana/web3.js";
import type { CommunityToken } from "@/lib/community-tokens";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import { ShareToXModal } from "@/components/share-to-x-modal";
import { BubblemapsModal } from "@/components/bubblemaps-modal";
import { getStockCompany, formatStockTicker, TOKENIZED_STOCK_SAFE_WORDING } from "@/lib/tokenized-stock-wording";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { formatTokenPrice, formatTokenVolume } from "@/lib/community-token-utils";

interface TokenTradeViewProps {
  token: CommunityToken | null;
  mint: string;
  initialColor?: string;
}

function quoteMintFor(token: CommunityToken) {
  return VERIFIED_SOLANA_XSTOCKS_PAIRS.find((pair) => pair.symbol === token.pairedStockSymbol)?.mint ?? null;
}

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encode(value: Uint8Array) {
  let binary = "";
  for (let i = 0; i < value.length; i += 0x8000) {
    binary += String.fromCharCode(...value.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function TokenTradeView({ token, mint, initialColor }: TokenTradeViewProps) {
  const { address, connect, signTransaction } = useWallet();

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
  const cleanSymbol = token.symbol.startsWith("$") ? token.symbol.slice(1).toUpperCase() : token.symbol.toUpperCase();
  const isGraduated = token.bondingCurveProgress >= 100 || token.status === "graduated";

  const parsedAmount = parseFloat(amount) || 0;
  const quoteMint = quoteMintFor(token);
  const quoteSymbol = token.pairedStockSymbol;
  const quoteDecimals = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((pair) => pair.symbol === quoteSymbol)?.decimals ?? 6;

  async function handleExecuteTrade() {
    if (!token) return;

    if (!address) {
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
      const slippageBps = Math.round(slippage * 100);
      const inputMint = side === "buy" ? quoteMint : token.mint;
      const outputMint = side === "buy" ? token.mint : quoteMint;
      const inputDecimals = side === "buy" ? quoteDecimals : 6;
      const rawAmount = Math.max(1, Math.round(parsedAmount * (10 ** inputDecimals))).toString();

      // Query live Jupiter Lite routing
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(rawAmount)}&slippageBps=${slippageBps}`;
      const quoteRes = await fetch(quoteUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!quoteRes.ok) {
        // Fallback to pool/bonding curve
        const poolUrl = token.meteoraUrl || token.pumpUrl || `https://jup.ag/swap/${quoteSymbol}-${token.mint}`;
        const poolLabel = token.meteoraUrl ? "Meteora DLMM Pool" : "Pump.fun Bonding Curve";
        setBondingNotice({
          message: `Direct AMM route is pending curve graduation (${token.bondingCurveProgress.toFixed(1)}%). Trade directly on the pool:`,
          url: poolUrl,
          label: poolLabel,
        });
        setIsSwapping(false);
        return;
      }

      const quoteResponse = await quoteRes.json();
      if (!quoteResponse || quoteResponse.error) {
        throw new Error(quoteResponse?.error || "Unable to acquire an on-chain DEX quote.");
      }

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: address,
          wrapAndUnwrapSol: false,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!swapRes.ok) {
        throw new Error(`Swap builder returned HTTP ${swapRes.status}`);
      }

      const swapData = (await swapRes.json()) as { swapTransaction?: string; lastValidBlockHeight?: number };
      if (!swapData.swapTransaction) {
        throw new Error("Solana swap transaction could not be constructed.");
      }

      if (!signTransaction) {
        throw new Error("Connected wallet does not support transaction signing.");
      }

      const deserialized = VersionedTransaction.deserialize(decode(swapData.swapTransaction));
      const signed = await signTransaction(deserialized);

      const execRes = await fetch("/api/trade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: encode(signed.serialize()),
          requestId: `comm_${Date.now()}`,
          lastValidBlockHeight: swapData.lastValidBlockHeight,
        }),
      });

      const execution = await execRes.json();
      if (!execRes.ok || !execution.signature) {
        throw new Error(execution.error || "The swap was not confirmed by Solana RPC.");
      }

      const formattedReceived =
        side === "buy"
          ? `${token.symbol} against ${quoteSymbol}`
          : `${quoteSymbol} against ${token.symbol}`;

      setTxSuccess({
        signature: execution.signature,
        received: formattedReceived,
      });
    } catch (err: any) {
      setSwapError(err?.message || "Execution error during swap.");
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
              <span className="token-trade-chip">
                {isGraduated ? "Meteora DLMM Pool" : "ClawPump Curve"}
              </span>
            </div>
            <div className="token-trade-name">{token.name}</div>
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
            title="View Bubblemaps cluster distribution"
          >
            Bubblemaps Audit
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
              <div className="token-metric-value">${formatTokenPrice(token.priceUsd)}</div>
              <div className="token-metric-sub">{token.priceSol.toFixed(7)} SOL</div>
            </div>

            <div className="token-metric-card">
              <div className="token-metric-label">24h Change</div>
              <div
                className={`token-metric-value ${
                  token.change24h >= 0 ? "is-positive" : "is-negative"
                }`}
              >
                {token.change24h >= 0 ? `+${token.change24h.toFixed(1)}%` : `${token.change24h.toFixed(1)}%`}
              </div>
              <div className="token-metric-sub">Rolling 24h</div>
            </div>

            <div className="token-metric-card">
              <div className="token-metric-label">24h Volume</div>
              <div className="token-metric-value">{formatTokenVolume(token.volume24hUsd)}</div>
              <div className="token-metric-sub">On-chain verified</div>
            </div>

            <div className="token-metric-card">
              <div className="token-metric-label">Market Cap</div>
              <div className="token-metric-value">
                {token.marketCapUsd >= 1_000_000
                  ? `$${(token.marketCapUsd / 1_000_000).toFixed(2)}M`
                  : `$${(token.marketCapUsd / 1000).toFixed(1)}K`}
              </div>
              <div className="token-metric-sub">FDV</div>
            </div>
          </div>

          {/* Bonding Curve Card */}
          <div className="token-curve-card">
            <div className="token-curve-header">
              <div>
                <h3 className="token-curve-title">Bonding Curve Progress</h3>
                <p className="token-curve-desc">
                  {isGraduated
                    ? "Curve completed. Pair migrated into full liquidity on Meteora DLMM."
                    : `When curve reaches 100%, 100% of collateral pool graduates directly to Meteora DLMM.`}
                </p>
              </div>
              <div className="token-curve-pct">{token.bondingCurveProgress.toFixed(1)}%</div>
            </div>

            <div className="token-progress-bar-wrap">
              <div
                className="token-progress-bar-fill"
                style={{ width: `${Math.min(100, Math.max(5, token.bondingCurveProgress))}%` }}
              />
            </div>
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
                <div>Trade executed successfully on Solana.</div>
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
