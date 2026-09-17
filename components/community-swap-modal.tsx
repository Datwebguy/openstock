"use client";

import { useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import type { CommunityToken } from "@/lib/community-tokens";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";

type CommunitySwapModalProps = {
  token: CommunityToken;
  onClose: () => void;
  onTradeSuccess?: (updatedVolume: number) => void;
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

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

export function CommunitySwapModal({ token, onClose, onTradeSuccess }: CommunitySwapModalProps) {
  const { address, connect, signTransaction } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("0.5");
  const [slippage, setSlippage] = useState<number>(1.0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [bondingNotice, setBondingNotice] = useState<{ message: string; url: string; label: string } | null>(null);
  const [txSuccess, setTxSuccess] = useState<{ signature: string; received: string } | null>(null);

  const parsedAmount = parseFloat(amount) || 0;
  const priceSol = token.priceSol || 0.0001;

  // Real-time bonding curve or AMM quote estimation
  const tokensToReceive = side === "buy" ? (parsedAmount > 0 ? Math.floor(parsedAmount / priceSol) : 0) : parsedAmount;
  const solToReceive = side === "sell" ? +(parsedAmount * priceSol * 0.99).toFixed(4) : parsedAmount;

  async function handleExecuteSwap() {
    if (!address) {
      try {
        await connect();
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
      return;
    }

    if (parsedAmount <= 0) return;

    setIsSwapping(true);
    setSwapError(null);
    setBondingNotice(null);

    try {
      const slippageBps = Math.round(slippage * 100);
      const inputMint = side === "buy" ? SOL_MINT : token.mint;
      const outputMint = side === "buy" ? token.mint : SOL_MINT;

      // SOL has 9 decimals; standard SPL tokens typically 6 decimals
      const rawAmount = side === "buy"
        ? Math.max(1, Math.round(parsedAmount * 1e9)).toString()
        : Math.max(1, Math.round(parsedAmount * 1e6)).toString();

      // Query live Jupiter Lite routing
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(rawAmount)}&slippageBps=${slippageBps}`;
      const quoteRes = await fetch(quoteUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!quoteRes.ok) {
        // If AMM routing is not yet available, token is likely trading on internal bonding curve
        const poolUrl = token.meteoraUrl || token.pumpUrl || `https://jup.ag/swap/SOL-${token.mint}`;
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

      // Build genuine Versioned Transaction
      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: address,
          wrapAndUnwrapSol: true,
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

      // Sign transaction using connected Solana wallet (Phantom, Solflare, etc.)
      const deserialized = VersionedTransaction.deserialize(decode(swapData.swapTransaction));
      const signed = await signTransaction(deserialized);

      // Broadcast authentic transaction to Solana Mainnet RPC
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
          ? `${tokensToReceive.toLocaleString()} ${token.symbol}`
          : `${solToReceive.toFixed(4)} SOL`;

      setTxSuccess({
        signature: execution.signature,
        received: formattedReceived,
      });

      onTradeSuccess?.(token.volume24hUsd + parsedAmount * 150);
    } catch (err: unknown) {
      console.error("Community swap error:", err);
      const msg = err instanceof Error ? err.message : "Swap failed to execute.";
      setSwapError(msg);
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
              src={token.imageUrl}
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
              setAmount("0.5");
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
                <span>{address ? `Wallet: ${shortWallet(address)}` : "Balance: ~ SOL"}</span>
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
                      <span className="solana-badge-mark">SOL</span>
                      <span>SOL</span>
                    </>
                  ) : (
                    <>
                      <img
                        src={token.imageUrl}
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
                  {[0.1, 0.5, 1.0, 5.0].map((val) => (
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
                      {val} SOL
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Receive Field Preview */}
            <div className="community-swap-field-card community-swap-field-card--receive">
              <div className="community-swap-field-top">
                <span>You Receive (Estimated)</span>
                <span>Price: ${token.priceUsd.toFixed(4)}</span>
              </div>
              <div className="community-swap-input-row">
                <div className="community-swap-output-val">
                  {side === "buy" ? tokensToReceive.toLocaleString() : solToReceive.toFixed(4)}
                </div>
                <div className="community-swap-currency-badge">
                  {side === "buy" ? (
                    <>
                      <img
                        src={token.imageUrl}
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
                      <span className="solana-badge-mark">SOL</span>
                      <span>SOL</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Slippage & Routing Info */}
            <div className="community-swap-meta-strip">
              <div className="community-swap-meta-row">
                <span>Bonding Curve Progress</span>
                <strong>{token.bondingCurveProgress.toFixed(1)}% to DLMM Pool</strong>
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
                ? `Buy ${token.symbol} with ${amount} SOL`
                : `Sell ${amount} ${token.symbol} for SOL`}
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
              Meteora DLMM Pool ↗
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
            href={`https://jup.ag/swap/SOL-${token.mint}`}
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
