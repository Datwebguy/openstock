"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import type { PumpPairAsset } from "@/lib/clawpump";

const PRESET_AVATARS = [
  { label: "Rocket", url: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=150&auto=format&fit=crop&q=80" },
  { label: "Bull", url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80" },
  { label: "Circuit", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80" },
  { label: "Diamond", url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80" },
];

export function LaunchClient() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "AAPLx";

  const { address, ready, connect } = useWallet();

  // Supported ClawPump pairs
  const [pairs, setPairs] = useState<PumpPairAsset[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [selectedPair, setSelectedPair] = useState<PumpPairAsset | null>(null);

  // Form State
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=200&auto=format&fit=crop&q=80");
  const [creatorFeeBps, setCreatorFeeBps] = useState(100); // 1% default

  // Execution State
  const [stepState, setStepState] = useState<"idle" | "quoting" | "paying" | "confirming" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [launchReceipt, setLaunchReceipt] = useState<{
    mintAddress: string;
    txHash: string;
    pumpUrl: string;
    explorerUrl: string;
  } | null>(null);

  const [, startTransition] = useTransition();

  // Load pairs from API
  useEffect(() => {
    async function loadPairs() {
      try {
        setLoadingPairs(true);
        const res = await fetch("/api/launch/pairs");
        const data = await res.json();
        const assetList: PumpPairAsset[] = data.assets ?? [];
        setPairs(assetList);

        // Match initial symbol
        const matched = assetList.find((p) => p.symbol.toLowerCase() === initialSymbol.toLowerCase()) || assetList[0];
        setSelectedPair(matched || null);
      } catch (err) {
        console.error("Failed to load pairs:", err);
      } finally {
        setLoadingPairs(false);
      }
    }
    loadPairs();
  }, [initialSymbol]);

  // Update selected pair if query param changes
  useEffect(() => {
    if (pairs.length > 0 && initialSymbol) {
      const matched = pairs.find((p) => p.symbol.toLowerCase() === initialSymbol.toLowerCase());
      if (matched) setSelectedPair(matched);
    }
  }, [initialSymbol, pairs]);

  // Handle Launch Action
  async function handleLaunch() {
    if (!address) {
      try {
        await connect();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Please connect your wallet";
        setErrorMessage(msg);
      }
      return;
    }

    if (!selectedPair) {
      setErrorMessage("Please select a supported xStock pair.");
      return;
    }

    if (!tokenName.trim()) {
      setErrorMessage("Please provide a token name.");
      return;
    }

    if (!tokenSymbol.trim()) {
      setErrorMessage("Please provide a token ticker symbol.");
      return;
    }

    if (description.trim().length < 20) {
      setErrorMessage("Description must be at least 20 characters.");
      return;
    }

    setErrorMessage("");
    setStepState("quoting");
    setStatusMessage("Requesting ClawPump self-funded quote terms...");

    try {
      // Step 1: Preflight quote
      const preflightRes = await fetch("/api/launch/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName.trim(),
          symbol: tokenSymbol.trim().toUpperCase(),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          pumpQuoteMint: selectedPair.mint,
          pumpCreatorFeeBps: creatorFeeBps,
          walletAddress: address,
        }),
      });

      const preflightData = await preflightRes.json();
      if (!preflightRes.ok || !preflightData.payment) {
        throw new Error(preflightData.error || "Failed to obtain launch quote terms.");
      }

      const { payment, retryWith, agentId, agentName } = preflightData;
      const amountLamports = payment.amountLamports;
      const payTo = payment.payTo;
      const preflightToken = retryWith.preflightToken;

      // Step 2: Pay from wallet
      setStepState("paying");
      setStatusMessage(`Please approve transfer of ${(amountLamports / 1e9).toFixed(5)} SOL to fund the launch...`);

      let txSignature = "";

      type WindowSolana = {
        signTransaction?: (tx: Transaction) => Promise<Transaction>;
        signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>;
      };

      const win = window as unknown as {
        solana?: WindowSolana;
        phantom?: { solana?: WindowSolana };
      };
      const solanaProvider: WindowSolana | null = win.solana ?? win.phantom?.solana ?? null;

      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");

      if (solanaProvider && (solanaProvider.signAndSendTransaction || solanaProvider.signTransaction)) {
        const fromPubkey = new PublicKey(address);
        const toPubkey = new PublicKey(payTo);

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: amountLamports,
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        if (solanaProvider.signAndSendTransaction) {
          const sendRes = await solanaProvider.signAndSendTransaction(tx);
          txSignature = sendRes.signature;
        } else if (solanaProvider.signTransaction) {
          const signed = await solanaProvider.signTransaction(tx);
          txSignature = await connection.sendRawTransaction(signed.serialize());
        }

        setStatusMessage("Confirming payment on Solana...");
        await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed");
      } else {
        // Fallback simulation signature for browser testing when physical wallet extension is not active
        txSignature = `sim_sig_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
      }

      // Step 3: Complete launch with txSignature proof
      setStepState("confirming");
      setStatusMessage("Minting and pairing token on ClawPump against " + selectedPair.symbol + "...");

      const confirmRes = await fetch("/api/launch/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName.trim(),
          symbol: tokenSymbol.trim().toUpperCase(),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          pumpQuoteMint: selectedPair.mint,
          pumpCreatorFeeBps: creatorFeeBps,
          walletAddress: address,
          agentId,
          agentName,
          txSignature,
          preflightToken,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.error || "Failed to finalize token launch.");
      }

      setStepState("success");
      setLaunchReceipt({
        mintAddress: confirmData.mintAddress,
        txHash: confirmData.txHash,
        pumpUrl: confirmData.pumpUrl,
        explorerUrl: confirmData.explorerUrl,
      });
    } catch (err: unknown) {
      console.error("Launch error:", err);
      setStepState("error");
      setErrorMessage(err instanceof Error ? err.message : "Launch process encountered an error.");
    }
  }

  return (
    <div className="launch-container">
      {/* Back Link */}
      <Link href="/app" className="launch-back-link">
        <span aria-hidden="true">←</span> Back to Market Desk
      </Link>

      {/* Banner / Pair Preview */}
      <section className="launch-banner" aria-label="Launch Header">
        <div className="launch-banner-content">
          <div>
            <span className="launch-brand-tag">OpenStock × ClawPump</span>
            <h1>
              Make the meme. <span>Pair the market.</span>
            </h1>
            <p>
              Create an independent community token and launch it directly against a tokenized stock on Solana.
            </p>
          </div>

          <div className="launch-pair-preview">
            <div className="launch-token-pill" title="Your Token">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={tokenSymbol || "Token"}
                  className="launch-token-avatar"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : null}
              <div className="launch-token-placeholder">
                {tokenSymbol || "YOUR TOKEN"}
              </div>
            </div>

            <span className="launch-pair-times">×</span>

            <div className="launch-stock-pill" title={`Paired with ${selectedPair?.symbol || "xStock"}`}>
              {selectedPair ? (
                <StockLogo symbol={selectedPair.symbol} logo={selectedPair.imageUrl ?? undefined} size={50} />
              ) : (
                <div style={{ color: "#9945ff", fontWeight: 700 }}>xStock</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Two Blocks Only */}
      <div className="launch-blocks">
        {/* Block 1: Name the idea */}
        <section className="launch-card" aria-labelledby="block-1-title">
          <div className="launch-block-header">
            <span className="launch-step-index">01</span>
            <h2 id="block-1-title">Name the idea.</h2>
            <p>Keep it immediate. People should understand the joke or community in one glance.</p>
          </div>

          <div className="launch-form-grid">
            <div className="launch-field">
              <label htmlFor="token-name">
                Token name <span>(1–32 chars)</span>
              </label>
              <input
                id="token-name"
                placeholder="e.g. Everything Is Fine"
                value={tokenName}
                maxLength={32}
                onChange={(e) => setTokenName(e.target.value)}
              />
            </div>

            <div className="launch-field">
              <label htmlFor="token-symbol">
                Symbol <span>(1–10 chars)</span>
              </label>
              <input
                id="token-symbol"
                placeholder="e.g. FINE"
                value={tokenSymbol}
                maxLength={10}
                onChange={(e) => setTokenSymbol(e.target.value)}
              />
            </div>
          </div>

          <div className="launch-field" style={{ marginBottom: 20 }}>
            <label htmlFor="token-desc">
              What is it? <span>(20–500 chars)</span>
            </label>
            <textarea
              id="token-desc"
              placeholder="The community token for people watching the markets burn beautifully..."
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Image URL & Presets */}
          <div className="launch-field">
            <label htmlFor="token-image">
              Artwork URL <span>(HTTPS image)</span>
            </label>
            <div className="launch-image-row">
              <div className="launch-avatar-thumb">
                {imageUrl ? <img src={imageUrl} alt="Preview" /> : <span>✦</span>}
              </div>
              <div>
                <input
                  id="token-image"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <div className="launch-avatar-presets">
                  <span style={{ fontSize: 11, color: "var(--os-muted)" }}>Quick presets:</span>
                  {PRESET_AVATARS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      className="launch-preset-btn"
                      onClick={() => setImageUrl(preset.url)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Block 2: Choose its market */}
        <section className="launch-card" aria-labelledby="block-2-title">
          <div className="launch-block-header">
            <span className="launch-step-index">02</span>
            <h2 id="block-2-title">Choose its market.</h2>
            <p>The token trades against the stock you select, rather than only SOL or USDC.</p>
          </div>

          {loadingPairs ? (
            <div style={{ padding: "24px 0", color: "var(--os-muted)", fontSize: 14 }}>
              Loading supported ClawPump stock pairs...
            </div>
          ) : (
            <div className="launch-pairs-grid" role="radiogroup" aria-label="Stock pairs">
              {pairs.map((pair) => {
                const isSelected = selectedPair?.mint === pair.mint;
                return (
                  <button
                    type="button"
                    key={pair.mint}
                    className={`launch-pair-item ${isSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedPair(pair);
                      });
                    }}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <StockLogo symbol={pair.symbol} logo={pair.imageUrl ?? undefined} size={36} />
                    <div className="launch-pair-info">
                      <strong>{pair.symbol}</strong>
                      <span>{pair.name.replace(/ xStock$/, "")}</span>
                    </div>
                    {isSelected && <span className="launch-pair-check">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fee Selector: 1% to 3% */}
          <div className="launch-fee-box">
            <div className="launch-fee-info">
              <strong>Collect creator fees in {selectedPair?.symbol || "xStock"}</strong>
              <span>Accrues automatically on all secondary trading activity.</span>
            </div>
            <div className="launch-fee-tabs" role="group" aria-label="Creator fee">
              {[
                { label: "1%", bps: 100 },
                { label: "2%", bps: 200 },
                { label: "2.5%", bps: 250 },
                { label: "3%", bps: 300 },
              ].map((tier) => (
                <button
                  type="button"
                  key={tier.bps}
                  className={`launch-fee-tab ${creatorFeeBps === tier.bps ? "is-active" : ""}`}
                  onClick={() => setCreatorFeeBps(tier.bps)}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action / Payment */}
          <div className="launch-action-section">
            <div className="launch-wallet-status">
              <div>
                <span className="launch-wallet-dot" />
                <span>
                  {ready && address
                    ? `Connected: ${shortWallet(address)}`
                    : "Connect your Phantom or Solflare wallet"}
                </span>
              </div>
              <span>ClawPump self-funded quote: ~0.0075 SOL</span>
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(240, 113, 128, 0.1)",
                  border: "1px solid rgba(240, 113, 128, 0.3)",
                  color: "#f07180",
                  fontSize: 13,
                }}
              >
                {errorMessage}
              </div>
            )}

            {stepState !== "idle" && stepState !== "error" && stepState !== "success" && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(153, 69, 255, 0.08)",
                  border: "1px solid rgba(153, 69, 255, 0.25)",
                  color: "var(--solana-purple)",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span className="launch-spinner" style={{ animation: "spin 1s linear infinite" }}>✦</span>
                {statusMessage}
              </div>
            )}

            <button
              type="button"
              className="launch-btn-main"
              disabled={stepState === "quoting" || stepState === "paying" || stepState === "confirming"}
              onClick={handleLaunch}
            >
              {!address
                ? "Connect wallet to launch"
                : stepState === "quoting"
                ? "Quoting launch terms..."
                : stepState === "paying"
                ? "Awaiting wallet payment..."
                : stepState === "confirming"
                ? "Minting on ClawPump..."
                : `Launch ${tokenSymbol || "Token"} × ${selectedPair?.symbol || "xStock"}`}
            </button>
          </div>

          {/* Success Banner */}
          {launchReceipt && (
            <div className="launch-success-banner" role="status">
              <div className="launch-success-head">
                <span style={{ fontSize: 24 }}>🎉</span>
                <h3>Token Live Quoted in {selectedPair?.symbol}!</h3>
              </div>

              <div className="launch-receipt-row">
                <span>Pairing</span>
                <strong>
                  {tokenSymbol} × {selectedPair?.symbol}
                </strong>
              </div>

              <div className="launch-receipt-row">
                <span>Mint Address</span>
                <code>{launchReceipt.mintAddress}</code>
              </div>

              <div className="launch-receipt-row">
                <span>Payment Tx</span>
                <code>{launchReceipt.txHash.slice(0, 8)}...{launchReceipt.txHash.slice(-8)}</code>
              </div>

              <div className="launch-receipt-row">
                <span>Protocol</span>
                <strong>ClawPump on Solana</strong>
              </div>

              <div className="launch-success-links">
                <a
                  href={launchReceipt.pumpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="launch-success-btn launch-btn-green"
                >
                  View on Pump.fun ↗
                </a>
                <a
                  href={launchReceipt.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="launch-success-btn launch-btn-ghost"
                >
                  View on Solscan ↗
                </a>
                <Link
                  href={`/app/asset/${selectedPair?.symbol}`}
                  className="launch-success-btn launch-btn-ghost"
                >
                  Open {selectedPair?.symbol} market desk
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
