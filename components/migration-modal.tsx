"use client";

import { useEffect, useState } from "react";
import { Transaction } from "@solana/web3.js";
import { browserConnection, waitForSignature } from "@/lib/client-rpc";
import { StockLogo } from "@/components/stock-logo";
import { useWallet } from "@/components/wallet-session";
import { translateWalletError } from "@/lib/solana-preflight";
import type { CommunityToken } from "@/lib/community-tokens";
import { curveStatusLabel, dexLabel, formatMarketCap, formatTokenPrice, formatTokenVolume, isOnAmmPool } from "@/lib/community-token-utils";

interface MigrationModalProps {
  token: CommunityToken;
  onClose: () => void;
  onOpenSwap?: (token: CommunityToken) => void;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function MigrationModal({ token, onClose, onOpenSwap }: MigrationModalProps) {
  const { address, connect, canSign, signAnyTransaction } = useWallet();
  const [isGraduated, setIsGraduated] = useState(isOnAmmPool(token));
  // Migration is only offered for OpenStock Meteora DBC launches whose curve progress was measured on-chain.
  const canMigrate = token.source === "openstock" && token.venue === "meteora" && Boolean(token.progressKnown) && Boolean(token.poolAddress);
  const [meteoraPoolUrl, setMeteoraPoolUrl] = useState(token.meteoraUrl || "");
  const [migrationTxHash, setMigrationTxHash] = useState("");

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStep, setMigrationStep] = useState("");
  const [migrationError, setMigrationError] = useState("");

  const progress = Math.min(100, Math.max(0, isGraduated ? 100 : token.bondingCurveProgress));
  const progressShown = isGraduated || Boolean(token.progressKnown);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleExecuteMigration() {
    if (!address) {
      try {
        await connect();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Please connect your wallet";
        setMigrationError(msg);
      }
      return;
    }

    setIsMigrating(true);
    setMigrationError("");
    setMigrationStep("Preparing move to full pool...");

    if (!canSign) {
      setMigrationError("Connect a Solana wallet that can sign to continue.");
      setIsMigrating(false);
      return;
    }

    try {
      const poolAddress = token.poolAddress || token.mint;
      const connection = browserConnection();

      // Step 1: Prepare migration transaction from API
      const prepRes = await fetch("/api/migration/meteora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "prepare",
          poolAddress,
          payerWallet: address,
          mint: token.mint,
        }),
      });

      const prepData = await prepRes.json();
      if (!prepRes.ok || !prepData.transactionBase64) {
        throw new Error(prepData.error || "Payment didn’t go through. Try again.");
      }

      // Step 2: Prompt user wallet to sign
      setMigrationStep("Please approve in your wallet...");
      const tx = Transaction.from(base64ToUint8Array(prepData.transactionBase64));

      const signed = await signAnyTransaction(tx);
      setMigrationStep("Submitting transaction...");
      const txSignature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });

      setMigrationStep("Confirming on Solana...");
      await waitForSignature(connection, txSignature);

      // Step 3: Confirm migration on registry
      const confirmRes = await fetch("/api/migration/meteora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "confirm",
          poolAddress,
          txSignature,
          mint: token.mint,
          dammPoolAddress: prepData.dammPoolAddress,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.error || "The migration could not be verified yet. Try again shortly.");
      }

      setIsGraduated(true);
      setMeteoraPoolUrl(confirmData.meteoraUrl || `https://solscan.io/account/${prepData.dammPoolAddress}`);
      setMigrationTxHash(txSignature);
      setMigrationStep("Move to full pool complete!");
    } catch (err: unknown) {
      console.error("Migration error:", err);
      const msg = translateWalletError(err);
      setMigrationError(msg);
    } finally {
      setIsMigrating(false);
    }
  }

  return (
    <div className="migration-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="migration-modal-title">
      <div className="migration-modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="migration-modal-container">
        {/* Modal Header */}
        <div className="migration-modal-header">
          <div className="migration-header-brand">
            <div className="migration-avatar-pair">
              <img
                src={token.imageUrl}
                alt={token.name}
                className="migration-avatar-main"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b2333'/><text x='50' y='58' font-size='32' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>OS</text></svg>";
                }}
              />
              <div className="migration-avatar-stock" title={`Paired with ${token.pairedStockSymbol}`}>
                <StockLogo symbol={token.pairedStockSymbol} size={22} />
              </div>
            </div>
            <div>
              <h2 id="migration-modal-title" className="migration-title">
                {token.name} (${token.symbol})
              </h2>
              <div className="migration-subtitle-row">
                <span className="migration-badge-pair">Paired with {token.pairedStockSymbol}</span>
                <span className={`migration-status-pill ${isGraduated ? "is-graduated" : "is-active"}`}>
                  <span className="migration-pulse-dot" />
                  {curveStatusLabel(token)}
                </span>
              </div>
            </div>
          </div>

          <button type="button" className="migration-close-btn" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="migration-modal-body">
          {/* Progress Visualizer Hero */}
          <div className="migration-gauge-hero">
            <div className="migration-gauge-header">
              <span>{isGraduated ? "Trading venue" : "Curve progress"}</span>
              <strong>{isGraduated ? `${dexLabel(token)} pool` : progressShown ? `${progress.toFixed(1)}% / 100%` : "Not published"}</strong>
            </div>

            {progressShown ? (
              <div className="migration-progress-track">
                <div
                  className={`migration-progress-bar ${isGraduated ? "is-graduated" : ""}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}

            <div className="migration-gauge-meta">
              <span className={`migration-meta-notice ${isGraduated ? "is-success" : ""}`}>
                {isGraduated
                  ? `Trading on a ${dexLabel(token)} pool against ${token.pairedStockSymbol}.`
                  : progressShown
                  ? "Progress = quote raised ÷ the PoolConfig migration threshold, read from Solana."
                  : `${dexLabel(token)} does not publish curve progress through our data sources.`}
              </span>
            </div>
          </div>

          {/* Migration Error Banner */}
          {migrationError && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
              ⚠️ {migrationError}
            </div>
          )}

          {/* Migration In-Progress Status */}
          {isMigrating && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(3, 225, 255, 0.1)", border: "1px solid rgba(3, 225, 255, 0.3)", color: "var(--solana-cyan, #03e1ff)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="launch-pulse-dot" /> {migrationStep}
            </div>
          )}

          {/* 3-Step Automated Migration Pipeline */}
          <div className="migration-steps-box">
            <h3 className="migration-steps-title">Path to Full Trading Pool</h3>
            <div className="migration-steps-grid">
              {/* Step 1 */}
              <div className={`migration-step-card ${progress > 0 ? "is-active" : ""}`}>
                <div className="migration-step-badge">01</div>
                <div className="migration-step-content">
                  <h4>Initial Curve Trading</h4>
                  <p>
                    Trades settle against <strong>{token.pairedStockSymbol}</strong>
                    {token.creatorFeeBps ? <>; the creator earns <strong>{(token.creatorFeeBps / 100).toFixed(2)}%</strong> of volume</> : null}.
                  </p>
                  <span className="migration-step-stat">
                    {isGraduated ? "✓ Curve complete" : progressShown ? `${progress.toFixed(1)}% filled` : "On curve"}
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`migration-step-card ${isGraduated ? "is-active" : ""}`}>
                <div className="migration-step-badge">02</div>
                <div className="migration-step-content">
                  <h4>Full Pool Activation</h4>
                  <p>
                    When the curve fills, anyone can send the migration transaction that seeds an AMM pool
                    with the raised {token.pairedStockSymbol}.
                  </p>
                  <span className="migration-step-stat">
                    {isGraduated ? "✓ Pool Initialized" : "Ready at 100%"}
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`migration-step-card ${isGraduated ? "is-active" : ""}`}>
                <div className="migration-step-badge">03</div>
                <div className="migration-step-content">
                  <h4>Liquidity terms</h4>
                  <p>
                    How much migrated liquidity is locked is set by each venue&apos;s pool config — check the pool on Solscan.
                  </p>
                  <span className="migration-step-stat">
                    {isGraduated ? "✓ Pool live" : "After migration"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div className="migration-telemetry-grid">
            <div className="migration-telemetry-item">
              <span>Current Token Price</span>
              <strong>{formatTokenPrice(token.priceUsd)}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Market Cap</span>
              <strong>{formatMarketCap(token.marketCapUsd)}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>24h Paired Volume</span>
              <strong>{formatTokenVolume(token.volume24hUsd)}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Source</span>
              <strong>{token.source === "openstock" ? "Launched on OpenStock" : "Discovered on DexScreener"}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Trading Venue</span>
              <strong style={{ color: "var(--solana-cyan, #03e1ff)" }}>
                {curveStatusLabel(token)}
              </strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Creator fee</span>
              <strong style={{ color: "var(--solana-green, #14f195)" }}>
                {token.creatorFeeBps ? `${(token.creatorFeeBps / 100).toFixed(2)}%` : "Unknown"}
              </strong>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="migration-modal-footer">
          <div className="migration-footer-links">
            <a href={token.explorerUrl} target="_blank" rel="noreferrer" className="migration-link-btn">
              Solscan ↗
            </a>
            {meteoraPoolUrl ? (
              <a href={meteoraPoolUrl} target="_blank" rel="noreferrer" className="migration-link-btn is-meteora">
                Pool ↗
              </a>
            ) : null}
            {migrationTxHash ? (
              <a href={`https://solscan.io/tx/${migrationTxHash}`} target="_blank" rel="noreferrer" className="migration-link-btn">
                View transaction ↗
              </a>
            ) : null}
            <a
              href={`https://app.bubblemaps.io/sol/token/${token.mint}`}
              target="_blank"
              rel="noreferrer"
              className="migration-link-btn"
            >
              Bubblemaps ↗
            </a>
          </div>

          <div className="migration-footer-actions">
            {canMigrate && !isGraduated && progress >= 100 ? (
              <button
                type="button"
                className="migration-primary-btn"
                disabled={isMigrating}
                onClick={handleExecuteMigration}
                style={{ background: "linear-gradient(135deg, #03e1ff 0%, #14f195 100%)", color: "#000" }}
              >
                {isMigrating ? "Moving to full pool..." : "Move to full pool 🚀"}
              </button>
            ) : !isGraduated && onOpenSwap ? (
              <button
                type="button"
                className="migration-primary-btn"
                onClick={() => {
                  onClose();
                  onOpenSwap(token);
                }}
              >
                Trade ${token.symbol}
              </button>
            ) : isGraduated && meteoraPoolUrl ? (
              <a href={meteoraPoolUrl} target="_blank" rel="noreferrer" className="migration-primary-btn">
                Open pool ↗
              </a>
            ) : (
              <button type="button" className="migration-primary-btn" onClick={onClose}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
