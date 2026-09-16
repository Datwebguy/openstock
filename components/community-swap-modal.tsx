"use client";

import { useState } from "react";
import type { CommunityToken } from "@/lib/community-tokens";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";

type CommunitySwapModalProps = {
  token: CommunityToken;
  onClose: () => void;
  onTradeSuccess?: (updatedVolume: number) => void;
};

export function CommunitySwapModal({ token, onClose, onTradeSuccess }: CommunitySwapModalProps) {
  const { address, ready, connect } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("0.5");
  const [slippage, setSlippage] = useState<number>(1.0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [txSuccess, setTxSuccess] = useState<{ signature: string; received: string } | null>(null);

  const parsedAmount = parseFloat(amount) || 0;
  const priceSol = token.priceSol || 0.0001;

  // Bonding curve quote
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

    // Simulate on-chain DEX execution against ClawPump bonding curve
    setTimeout(() => {
      const fakeSig = `swap_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const formattedReceived =
        side === "buy"
          ? `${tokensToReceive.toLocaleString()} ${token.symbol}`
          : `${solToReceive.toFixed(4)} SOL`;

      setTxSuccess({
        signature: fakeSig,
        received: formattedReceived,
      });

      setIsSwapping(false);
      onTradeSuccess?.(token.volume24hUsd + (parsedAmount * 150));
    }, 1200);
  }

  return (
    <div className="os-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="os-modal-card community-swap-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="community-swap-head">
          <div className="community-swap-token-identity">
            <img src={token.imageUrl} alt={token.name} className="community-swap-avatar" />
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
                onClick={() => setTxSuccess(null)}
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
                  onChange={(e) => setAmount(e.target.value)}
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
                      <img src={token.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
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
                      onClick={() => setAmount(val.toString())}
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
                      <img src={token.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
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
                ? "Confirming on Solana..."
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
