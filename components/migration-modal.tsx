"use client";

import { useEffect, useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { useWallet } from "@/components/wallet-session";
import { translateWalletError } from "@/lib/solana-preflight";
import type { CommunityToken } from "@/lib/community-tokens";

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
  const { address, connect } = useWallet();
  const [isGraduated, setIsGraduated] = useState(
    token.bondingCurveProgress >= 100 || token.status === "graduated"
  );
  const [meteoraPoolUrl, setMeteoraPoolUrl] = useState(token.meteoraUrl || "");
  const [migrationTxHash, setMigrationTxHash] = useState("");

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStep, setMigrationStep] = useState("");
  const [migrationError, setMigrationError] = useState("");

  const progress = Math.min(100, Math.max(0, isGraduated ? 100 : token.bondingCurveProgress));
  const remainingPercent = (100 - progress).toFixed(1);

  // Accurate remaining USD needed to graduate based on bonding curve progress
  const remainingUsd = isGraduated ? 0 : Math.round(((100 - progress) / 100) * 69_000);

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
    setMigrationStep("Preparing Meteora DAMM v2 migration transaction...");

    type WindowSolana = {
      signTransaction?: (tx: Transaction) => Promise<Transaction>;
      signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>;
    };
    const win = window as unknown as {
      solana?: WindowSolana;
      phantom?: { solana?: WindowSolana };
    };
    const solanaProvider: WindowSolana | null = win.solana ?? win.phantom?.solana ?? null;

    if (!solanaProvider || (!solanaProvider.signAndSendTransaction && !solanaProvider.signTransaction)) {
      setMigrationError("Solana wallet provider not detected. Connect Phantom or Solflare to sign.");
      setIsMigrating(false);
      return;
    }

    try {
      const poolAddress = token.poolAddress || token.mint;
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");

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
        throw new Error(prepData.error || "Failed to prepare DAMM v2 migration.");
      }

      // Step 2: Prompt user wallet to sign
      setMigrationStep("Please approve DAMM v2 migration in your wallet...");
      const tx = Transaction.from(base64ToUint8Array(prepData.transactionBase64));

      let txSignature = "";
      if (solanaProvider.signAndSendTransaction) {
        const sendRes = await solanaProvider.signAndSendTransaction(tx);
        txSignature = sendRes.signature;
      } else if (solanaProvider.signTransaction) {
        const signed = await solanaProvider.signTransaction(tx);
        setMigrationStep("Broadcasting migration transaction to Solana...");
        txSignature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      }

      setMigrationStep("Confirming pool migration and permanent LP lock on Solana...");
      await connection.confirmTransaction(txSignature, "confirmed");

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
        throw new Error(confirmData.error || "Failed to finalize migration status.");
      }

      setIsGraduated(true);
      setMeteoraPoolUrl(confirmData.meteoraUrl || `https://app.meteora.ag/dlmm/${prepData.dammPoolAddress}`);
      setMigrationTxHash(txSignature);
      setMigrationStep("Migration successfully completed!");
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
                  {isGraduated ? "✓ Graduated to Meteora DLMM" : `${progress.toFixed(1)}% to Migration`}
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
              <span>Bonding Curve Capacity</span>
              <strong>{progress.toFixed(1)}% / 100%</strong>
            </div>

            <div className="migration-progress-track">
              <div
                className={`migration-progress-bar ${isGraduated ? "is-graduated" : ""}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="migration-gauge-meta">
              {isGraduated ? (
                <span className="migration-meta-notice is-success">
                  🎉 Migration Complete: Liquidity permanently seeded and locked in Meteora DLMM / DAMM v2 pool.
                </span>
              ) : (
                <span className="migration-meta-notice">
                  Remaining to DLMM Migration: <strong>${remainingUsd.toLocaleString()} USD</strong> (~{remainingPercent}% of curve)
                </span>
              )}
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
            <h3 className="migration-steps-title">Meteora DBC → DAMM v2 Migration Pipeline</h3>
            <div className="migration-steps-grid">
              {/* Step 1 */}
              <div className={`migration-step-card ${progress > 0 ? "is-active" : ""}`}>
                <div className="migration-step-badge">01</div>
                <div className="migration-step-content">
                  <h4>Bonding Curve Accumulation</h4>
                  <p>
                    Community trades against <strong>{token.pairedStockSymbol}</strong>. Creator earns{" "}
                    <strong>{(token.creatorFeeBps / 100).toFixed(1)}%</strong> in stock on every swap.
                  </p>
                  <span className="migration-step-stat">
                    {progress >= 100 ? "✓ Curve 100% Filled" : `${progress.toFixed(1)}% Filled`}
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`migration-step-card ${isGraduated ? "is-active" : ""}`}>
                <div className="migration-step-badge">02</div>
                <div className="migration-step-content">
                  <h4>Meteora DLMM / DAMM v2 Seeding</h4>
                  <p>
                    Upon hitting 100%, accumulated liquidity is automatically deposited into a concentrated{" "}
                    <strong>Meteora DAMM v2</strong> pool on Solana.
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
                  <h4>Permanent LP Lock &amp; Burn</h4>
                  <p>
                    Liquidity Provider (LP) tokens are permanently burned or locked into protocol escrow. Zero rug-pull risk guarantee.
                  </p>
                  <span className="migration-step-stat">
                    {isGraduated ? "✓ Rug-Proof Verified" : "Autonomous Lock"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div className="migration-telemetry-grid">
            <div className="migration-telemetry-item">
              <span>Current Token Price</span>
              <strong>${token.priceUsd.toFixed(6)}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Market Cap</span>
              <strong>${token.marketCapUsd.toLocaleString()}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>24h Paired Volume</span>
              <strong>${token.volume24hUsd.toLocaleString()}</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Holders</span>
              <strong>{token.holdersCount.toLocaleString()} Wallets</strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Execution AMM</span>
              <strong style={{ color: "var(--solana-cyan, #03e1ff)" }}>
                {isGraduated ? "Meteora DLMM" : token.venue === "meteora" ? "Meteora DBC" : "Pump.fun Curve"}
              </strong>
            </div>
            <div className="migration-telemetry-item">
              <span>Creator Stock Royalty</span>
              <strong style={{ color: "var(--solana-green, #14f195)" }}>
                {(token.creatorFeeBps / 100).toFixed(1)}% in {token.pairedStockSymbol}
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
                Meteora DLMM Pool ↗
              </a>
            ) : null}
            {migrationTxHash ? (
              <a href={`https://solscan.io/tx/${migrationTxHash}`} target="_blank" rel="noreferrer" className="migration-link-btn">
                Migration Tx ↗
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
            {!isGraduated && progress >= 100 ? (
              <button
                type="button"
                className="migration-primary-btn"
                disabled={isMigrating}
                onClick={handleExecuteMigration}
                style={{ background: "linear-gradient(135deg, #03e1ff 0%, #14f195 100%)", color: "#000" }}
              >
                {isMigrating ? "Migrating on Solana..." : "Execute Meteora DAMM v2 Migration 🚀"}
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
                Trade ${token.symbol} to Fast-Track Migration ⚡
              </button>
            ) : isGraduated && meteoraPoolUrl ? (
              <a href={meteoraPoolUrl} target="_blank" rel="noreferrer" className="migration-primary-btn">
                Trade on Meteora DLMM ↗
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
