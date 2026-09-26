"use client";
import { tokenImageSrc } from "@/lib/community-token-utils";

import { useEffect, useState } from "react";
import { executeCommunitySwap, NoRouteError, quoteCommunitySwap } from "@/lib/community-swap";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import type { CommunityToken } from "@/lib/community-tokens";
import { StockLogo } from "@/components/stock-logo";
import { curveStatusLabel } from "@/lib/community-token-utils";
import { shortWallet, useWallet } from "@/components/wallet-session";

type CommunitySwapModalProps = {
  token: CommunityToken;
  onClose: () => void;
  /** Called after a confirmed swap so the caller can refetch live data. */
  onTradeSuccess?: () => void;
};

function quoteMintFor(token: CommunityToken) {
  return VERIFIED_SOLANA_XSTOCKS_PAIRS.find((pair) => pair.symbol === token.pairedStockSymbol)?.mint ?? null;
}

export function CommunitySwapModal({ token, onClose, onTradeSuccess }: CommunitySwapModalProps) {
  const { address, canSign, connect, signTransaction } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("1");
  const [slippage, setSlippage] = useState<number>(1.0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [bondingNotice, setBondingNotice] = useState<{ message: string; url: string; label: string } | null>(null);
  const [txSuccess, setTxSuccess] = useState<{ signature: string; received: string } | null>(null);

  const parsedAmount = parseFloat(amount) || 0;
  const quoteMint = quoteMintFor(token);
  const quoteSymbol = token.pairedStockSymbol;
  const [estimate, setEstimate] = useState<{ state: "idle" | "loading" | "ok" | "noroute" | "error"; out?: number }>({ state: "idle" });

  // Live Jupiter estimate while the user types (debounced; stale requests aborted).
  useEffect(() => {
    if (!quoteMint || parsedAmount <= 0) { setEstimate({ state: "idle" }); return; }
    const controller = new AbortController();
    setEstimate({ state: "loading" });
    const timer = window.setTimeout(() => {
      quoteCommunitySwap({
        inputMint: side === "buy" ? quoteMint : token.mint,
        outputMint: side === "buy" ? token.mint : quoteMint,
        uiAmount: parsedAmount,
        slippageBps: Math.round(slippage * 100),
        signal: controller.signal,
      })
        .then((q) => setEstimate({ state: "ok", out: q.expectedOutUi }))
        .catch((err) => { if (!controller.signal.aborted) setEstimate({ state: err instanceof NoRouteError ? "noroute" : "error" }); });
    }, 400);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [quoteMint, parsedAmount, side, slippage, token.mint]);

  const estimateText = estimate.state === "ok" && estimate.out !== undefined
    ? estimate.out.toLocaleString(undefined, { maximumFractionDigits: estimate.out >= 1 ? 2 : 8 })
    : estimate.state === "loading" ? "Getting quote…"
    : estimate.state === "noroute" ? "No route yet"
    : estimate.state === "error" ? "Quote unavailable"
    : "0";

  async function handleExecuteSwap() {
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
      onTradeSuccess?.();
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
    <div className="os-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="os-modal-card community-swap-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="community-swap-head">
          <div className="community-swap-token-identity">
            <img
              src={tokenImageSrc(token)}
              alt={token.name}
              className="community-swap-avatar"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b2333'/><text x='50' y='58' font-size='32' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>OS</text></svg>";
              }}
            />
            <div>
              <div className="community-swap-title-row">
                <h3>{token.name}</h3>
                <span className="community-swap-symbol">${token.symbol}</span>
              </div>
              <div className="community-swap-paired-tag">
                <span>Paired with</span>
                <StockLogo symbol={token.pairedStockSymbol} size={16} />
                <strong>{token.pairedStockSymbol}</strong>
              </div>
            </div>
          </div>
          <button type="button" className="os-modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Buy / Sell Tabs */}
        <div className="community-swap-tabs" role="tablist">
          <button
            type="button"
            className={`community-swap-tab ${side === "buy" ? "is-buy" : ""}`}
            onClick={() => {
              setSide("buy");
              setAmount("1");
              setTxSuccess(null);
              setSwapError(null);
              setBondingNotice(null);
            }}
          >
            Buy {token.symbol}
          </button>
          <button
            type="button"
            className={`community-swap-tab ${side === "sell" ? "is-sell" : ""}`}
            onClick={() => {
              setSide("sell");
              setAmount("5000");
              setTxSuccess(null);
              setSwapError(null);
              setBondingNotice(null);
            }}
          >
            Sell {token.symbol}
          </button>
        </div>

        {/* Success Banner */}
        {txSuccess ? (
          <div className="community-swap-success">
            <div className="community-swap-success-head">
              <span className="live-dot" />
              <strong>Swap Confirmed on Solana!</strong>
            </div>
            <p>You received: <strong>{txSuccess.received}</strong></p>
            <div className="community-swap-success-links">
              <a
                href={`https://solscan.io/tx/${txSuccess.signature}`}
                target="_blank"
                rel="noreferrer"
                className="community-swap-tx-link"
              >
                View Transaction on Solscan ↗
              </a>
              <button
                type="button"
                className="button button--light"
                style={{ padding: "6px 14px", fontSize: 11 }}
                onClick={() => {
                  setTxSuccess(null);
                  setSwapError(null);
                  setBondingNotice(null);
                }}
              >
                New Swap
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Pay Field */}
            <div className="community-swap-field-card">
              <div className="community-swap-field-top">
                <span>You Pay</span>
                <span>{address ? `Wallet: ${shortWallet(address)}` : `Pay in ${quoteSymbol}`}</span>
              </div>
              <div className="community-swap-input-row">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setSwapError(null);
                    setBondingNotice(null);
                  }}
                  placeholder="0.0"
                  className="community-swap-input"
                />
                <div className="community-swap-currency-badge">
                  {side === "buy" ? (
                    <>
                      <StockLogo symbol={quoteSymbol} size={18} />
                      <span>{quoteSymbol}</span>
                    </>
                  ) : (
                    <>
                      <img
                        src={tokenImageSrc(token)}
                        alt=""
                        style={{ width: 18, height: 18, borderRadius: "50%" }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b2333'/><text x='50' y='58' font-size='32' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>OS</text></svg>";
                        }}
                      />
                      <span>{token.symbol}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Amount Presets (For Buy) */}
              {side === "buy" && (
                <div className="community-swap-presets">
                  {[0.1, 0.5, 1, 5].map((val) => (
                    <button
                      type="button"
                      key={val}
                      className="community-swap-preset-btn"
                      onClick={() => {
                        setAmount(val.toString());
                        setSwapError(null);
                        setBondingNotice(null);
                      }}
                    >
                      {val} {quoteSymbol}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Receive Field Preview */}
            <div className="community-swap-field-card community-swap-field-card--receive">
              <div className="community-swap-field-top">
                <span>You Receive (Estimated)</span>
                <span>{estimate.state === "ok" && estimate.out && parsedAmount > 0 ? (side === "buy" ? `1 ${quoteSymbol} ≈ ${(estimate.out / parsedAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token.symbol}` : `1 ${token.symbol} ≈ ${(estimate.out / parsedAmount).toPrecision(3)} ${quoteSymbol}`) : "Live Jupiter quote"}</span>
              </div>
              <div className="community-swap-input-row">
                <div className="community-swap-output-val">
                  {estimateText}
                </div>
                <div className="community-swap-currency-badge">
                  {side === "buy" ? (
                    <>
                      <img
                        src={tokenImageSrc(token)}
                        alt=""
                        style={{ width: 18, height: 18, borderRadius: "50%" }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b2333'/><text x='50' y='58' font-size='32' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>OS</text></svg>";
                        }}
                      />
                      <span>{token.symbol}</span>
                    </>
                  ) : (
                    <>
                      <StockLogo symbol={quoteSymbol} size={18} />
                      <span>{quoteSymbol}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Slippage & Routing Info */}
            <div className="community-swap-meta-strip">
              <div className="community-swap-meta-row">
                <span>Where it trades</span>
                <strong>{curveStatusLabel(token)}</strong>
              </div>
              <div className="community-swap-meta-row">
                <span>Slippage Tolerance</span>
                <div className="community-swap-slippage-chips">
                  {[0.5, 1.0, 2.5].map((slip) => (
                    <button
                      type="button"
                      key={slip}
                      className={`community-swap-slip-btn ${slippage === slip ? "is-selected" : ""}`}
                      onClick={() => setSlippage(slip)}
                    >
                      {slip}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bonding Curve Route Notice if AMM route pending */}
            {bondingNotice && (
              <div className="community-swap-notice-box">
                <p>{bondingNotice.message}</p>
                <a
                  href={bondingNotice.url}
                  target="_blank"
                  rel="noreferrer"
                  className="button button--light"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12 }}
                >
                  Open {bondingNotice.label} ↗
                </a>
              </div>
            )}

            {/* Error Message */}
            {swapError && (
              <div className="community-swap-error-box" role="alert">
                <span>⚠️ {swapError}</span>
              </div>
            )}

            {/* Execute Button */}
            <button
              type="button"
              disabled={isSwapping || parsedAmount <= 0}
              className={`button button--gradient community-swap-execute-btn ${side === "sell" ? "is-sell-btn" : ""}`}
              onClick={handleExecuteSwap}
            >
              {!address
                ? "Connect Wallet to Swap"
                : isSwapping
                ? "Broadcasting to Solana..."
                : side === "buy"
                ? `Buy ${token.symbol} with ${amount} ${quoteSymbol}`
                : `Sell ${amount} ${token.symbol} for ${quoteSymbol}`}
            </button>
          </>
        )}

        {/* Footer External Links */}
        <div className="community-swap-footer-links">
          {token.meteoraUrl ? (
            <a
              href={token.meteoraUrl}
              target="_blank"
              rel="noreferrer"
              className="community-swap-ext-link"
              style={{ color: "var(--solana-green, #14f195)" }}
            >
              Meteora pool ↗
            </a>
          ) : null}
          {token.pumpUrl ? (
            <a
              href={token.pumpUrl}
              target="_blank"
              rel="noreferrer"
              className="community-swap-ext-link"
            >
              Trade on Pump.fun ↗
            </a>
          ) : null}
          <a
            href={`https://jup.ag/swap/${quoteSymbol}-${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="community-swap-ext-link"
          >
            Jupiter DEX Route ↗
          </a>
          <a
            href={`https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="community-swap-ext-link"
          >
            Solscan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
