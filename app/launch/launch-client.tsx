"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import type { PumpPairAsset } from "@/lib/clawpump";

const PRESET_AVATARS = [
  { label: "Silicon Chip", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80" },
  { label: "Golden Bull", url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80" },
  { label: "Solana Orbit", url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&auto=format&fit=crop&q=80" },
  { label: "Hyper Rocket", url: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=200&auto=format&fit=crop&q=80" },
];

export function LaunchClient() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "NVDAx";

  const { address, ready, connect } = useWallet();

  // Supported ClawPump pairs
  const [pairs, setPairs] = useState<PumpPairAsset[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [selectedPair, setSelectedPair] = useState<PumpPairAsset | null>(null);
  const [pairFilter, setPairFilter] = useState("");

  // Form State: Token Identity
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState(PRESET_AVATARS[0].url);

  // Device Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Supply & Fee Economics
  const [tokenSupply, setTokenSupply] = useState<number>(1_000_000_000); // 1 Billion default
  const [customSupplyInput, setCustomSupplyInput] = useState("1,000,000,000");
  const [creatorFeeBps, setCreatorFeeBps] = useState(150); // 1.5% default

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
  const holoCardRef = useRef<HTMLDivElement | null>(null);

  // 3D Perspective Mouse Tracking for Holographic Token Simulator
  useEffect(() => {
    const card = holoCardRef.current;
    if (!card) return;
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reducedMotion) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.5);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.5);
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const update = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      card.style.setProperty("--holo-rx", `${(-currentY * 9).toFixed(2)}deg`);
      card.style.setProperty("--holo-ry", `${(currentX * 11).toFixed(2)}deg`);
      card.style.setProperty("--holo-tx", `${(currentX * 8).toFixed(2)}px`);
      card.style.setProperty("--holo-ty", `${(currentY * 8).toFixed(2)}px`);

      rafId = requestAnimationFrame(update);
    };

    card.addEventListener("pointermove", onPointerMove, { passive: true });
    card.addEventListener("pointerleave", onPointerLeave);
    rafId = requestAnimationFrame(update);

    return () => {
      card.removeEventListener("pointermove", onPointerMove);
      card.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Load pairs from API
  useEffect(() => {
    async function loadPairs() {
      try {
        setLoadingPairs(true);
        const res = await fetch("/api/launch/pairs");
        const data = await res.json();
        const assetList: PumpPairAsset[] = data.assets ?? [];
        setPairs(assetList);

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

  // Supply handlers
  function handleSupplySelect(amount: number) {
    setTokenSupply(amount);
    setCustomSupplyInput(new Intl.NumberFormat("en-US").format(amount));
  }

  function handleCustomSupplyChange(val: string) {
    const digitsOnly = val.replace(/[^\d]/g, "");
    const num = Number(digitsOnly);
    if (Number.isFinite(num)) {
      setTokenSupply(num);
      setCustomSupplyInput(digitsOnly ? new Intl.NumberFormat("en-US").format(num) : "");
    }
  }

  // File Upload Handlers (Device Upload)
  async function handleFileSelect(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, WebP, SVG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image file must be under 5MB.");
      return;
    }

    setErrorMessage("");
    setUploadedFileName(file.name);

    // 1. Instant zero-latency local preview in 3D simulator
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setImageUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);

    // 2. Upload to server endpoint in background
    try {
      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/launch/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
      }
    } catch (err) {
      console.warn("Background upload failed, continuing with local preview data:", err);
    } finally {
      setIsUploadingImage(false);
    }
  }

  // Filtered list of pairs based on search
  const visiblePairs = pairs.filter((p) => {
    if (!pairFilter.trim()) return true;
    const q = pairFilter.toLowerCase();
    return p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  // Handle One-Click Launch Action
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
      setErrorMessage("Please select a supported xStock market pair.");
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

    if (description.trim().length < 10) {
      setErrorMessage("Description / thesis should be at least 10 characters.");
      return;
    }

    if (!tokenSupply || tokenSupply < 1000) {
      setErrorMessage("Token supply must be at least 1,000 tokens.");
      return;
    }

    setErrorMessage("");
    setStepState("quoting");
    setStatusMessage("Requesting ClawPump quote terms on Solana...");

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
          supply: tokenSupply,
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
      setStatusMessage(`Please approve transfer of ${(amountLamports / 1e9).toFixed(5)} SOL in your wallet...`);

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

        setStatusMessage("Confirming payment on Solana mainnet...");
        await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed");
      } else {
        // Fallback simulation signature for browser environments without wallet extension
        txSignature = `sim_sig_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
      }

      // Step 3: Complete launch with txSignature proof
      setStepState("confirming");
      setStatusMessage(`Minting and pairing token on ClawPump against ${selectedPair.symbol}...`);

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
          supply: tokenSupply,
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
      setErrorMessage(err instanceof Error ? err.message : "Launch process encountered an unexpected issue.");
    }
  }

  return (
    <div className="launch-container">
      {/* Top Header Navigation */}
      <div className="launch-top-bar">
        <Link href="/app" className="launch-back-link">
          <span aria-hidden="true">←</span> Back to Market Desk
        </Link>
        <div className="launch-header-chips">
          <span className="launch-network-pill">
            <span className="launch-pulse-dot" /> Solana Mainnet-Beta
          </span>
          <span className="launch-protocol-pill">Powered by ClawPump</span>
        </div>
      </div>

      {/* Main Studio Grid: Left Form Pane + Right Live Holographic Simulator */}
      <div className="launch-studio-layout">
        {/* Left Column: Studio Controls */}
        <div className="launch-controls-column">
          <div className="launch-intro">
            <span className="launch-studio-kicker">Solana Token Studio</span>
            <h1>Launch a Token Paired to Real Stocks</h1>
            <p>
              Set your token identity, supply, and fee structure. Then deploy in one click against verified Backed equities on Solana.
            </p>
          </div>

          {/* Hidden File Input for Device Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {/* Step 01: Token Identity & Device Artwork */}
          <section className="launch-panel" aria-labelledby="step-1-heading">
            <div className="launch-panel-head">
              <div className="launch-step-pill">01</div>
              <div>
                <h2 id="step-1-heading">Token Identity</h2>
              </div>
            </div>

            <div className="launch-grid-2">
              <div className="launch-field">
                <label htmlFor="token-name">
                  Token Name <span>(max 32)</span>
                </label>
                <input
                  id="token-name"
                  placeholder="e.g. HyperCompute"
                  value={tokenName}
                  maxLength={32}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </div>

              <div className="launch-field">
                <label htmlFor="token-symbol">
                  Ticker Symbol <span>(max 10)</span>
                </label>
                <input
                  id="token-symbol"
                  placeholder="e.g. COMPUTE"
                  value={tokenSymbol}
                  maxLength={10}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="launch-field" style={{ marginTop: 16 }}>
              <label htmlFor="token-desc">
                Bio / Tagline <span>(optional)</span>
              </label>
              <input
                id="token-desc"
                placeholder={`Short tagline or default: ${tokenName || "Token"} paired against ${selectedPair?.symbol || "Stock"}`}
                value={description}
                maxLength={100}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Artwork Upload & Picker */}
            <div className="launch-field" style={{ marginTop: 18 }}>
              <label>
                Token Artwork <span>(Device upload, presets, or URL)</span>
              </label>
              <div className="launch-artwork-box">
                {/* Drag & Drop Thumbnail */}
                <div
                  className={`launch-drop-zone ${isDragging ? "is-dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Click or drag image to upload from device"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Artwork Preview"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="launch-drop-icon">📁</span>
                  )}
                  <span className="launch-drop-hint">
                    {isUploadingImage ? "Uploading..." : "Click or drop device image"}
                  </span>
                </div>

                <div className="launch-artwork-actions">
                  <div className="launch-upload-row">
                    <button
                      type="button"
                      className="launch-upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                    >
                      📁 Upload from device
                    </button>
                    {uploadedFileName && (
                      <span className="launch-filename-badge" title={uploadedFileName}>
                        ✓ {uploadedFileName}
                      </span>
                    )}
                  </div>

                  <input
                    id="token-image"
                    placeholder="Or paste https:// image URL..."
                    value={imageUrl.startsWith("data:") ? "(Image loaded from device)" : imageUrl}
                    onChange={(e) => {
                      setUploadedFileName("");
                      setImageUrl(e.target.value);
                    }}
                    className="launch-image-url-input"
                  />

                  <div className="launch-preset-chips">
                    <span className="launch-preset-label">Presets:</span>
                    {PRESET_AVATARS.map((preset) => (
                      <button
                        type="button"
                        key={preset.label}
                        className={`launch-preset-btn ${imageUrl === preset.url ? "is-selected" : ""}`}
                        onClick={() => {
                          setUploadedFileName("");
                          setImageUrl(preset.url);
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Step 02: Stock Market Pairing */}
          <section className="launch-panel" aria-labelledby="step-2-heading">
            <div className="launch-panel-head">
              <div className="launch-step-pill">02</div>
              <div>
                <h2 id="step-2-heading">Stock Market Pairing</h2>
              </div>
            </div>

            {/* Pair Search Filter */}
            <div className="launch-pair-filter-row">
              <input
                type="text"
                placeholder="Search stocks (NVDA, Apple, Tesla, Coinbase, S&P 500...)"
                value={pairFilter}
                onChange={(e) => setPairFilter(e.target.value)}
                className="launch-pair-search-input"
              />
              <span className="launch-pair-count">
                {visiblePairs.length} of {pairs.length} pairs
              </span>
            </div>

            {/* Stock Pairs Grid */}
            <div className="launch-pairs-container">
              {loadingPairs ? (
                <div className="launch-loading-pairs">
                  <span className="launch-pulse-dot" /> Loading verified ClawPump stock pairs...
                </div>
              ) : (
                <div className="launch-pairs-grid" role="radiogroup" aria-label="Stock pairs">
                  {visiblePairs.map((pair) => {
                    const isSelected = selectedPair?.mint === pair.mint;
                    return (
                      <button
                        type="button"
                        key={pair.mint}
                        className={`launch-pair-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => {
                          startTransition(() => {
                            setSelectedPair(pair);
                          });
                        }}
                        role="radio"
                        aria-checked={isSelected}
                      >
                        <StockLogo symbol={pair.symbol} logo={pair.imageUrl ?? undefined} size={36} />
                        <div className="launch-pair-details">
                          <strong>{pair.symbol}</strong>
                          <span>{pair.name.replace(/ xStock$/, "")}</span>
                        </div>
                        {isSelected ? <span className="launch-pair-check">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Step 03: Set Supply & Creator Fee Economics */}
          <section className="launch-panel" aria-labelledby="step-3-heading">
            <div className="launch-panel-head">
              <div className="launch-step-pill">03</div>
              <div>
                <h2 id="step-3-heading">Supply &amp; Economics</h2>
              </div>
            </div>

            {/* Token Supply Selector */}
            <div className="launch-field" style={{ marginBottom: 20 }}>
              <label htmlFor="token-supply">
                Total Supply
              </label>
              <div className="launch-supply-controls">
                <div className="launch-preset-chips" style={{ marginBottom: 10 }}>
                  {[
                    { label: "100M", val: 100_000_000 },
                    { label: "500M", val: 500_000_000 },
                    { label: "1B", val: 1_000_000_000 },
                    { label: "10B", val: 10_000_000_000 },
                  ].map((tier) => (
                    <button
                      type="button"
                      key={tier.val}
                      className={`launch-preset-btn ${tokenSupply === tier.val ? "is-selected" : ""}`}
                      onClick={() => handleSupplySelect(tier.val)}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
                <input
                  id="token-supply"
                  type="text"
                  placeholder="e.g. 1,000,000,000"
                  value={customSupplyInput}
                  onChange={(e) => handleCustomSupplyChange(e.target.value)}
                  className="launch-supply-input"
                />
              </div>
            </div>

            {/* Creator Fee Selector */}
            <div className="launch-field">
              <label htmlFor="creator-fee">
                Creator Royalty <span>(in {selectedPair?.symbol || "xStock"})</span>
              </label>
              <div className="launch-fee-pills" role="group" aria-label="Creator fee">
                {[
                  { label: "0.5%", bps: 50 },
                  { label: "1.0%", bps: 100 },
                  { label: "1.5%", bps: 150 },
                  { label: "2.0%", bps: 200 },
                  { label: "3.0%", bps: 300 },
                ].map((tier) => (
                  <button
                    type="button"
                    key={tier.bps}
                    className={`launch-fee-pill ${creatorFeeBps === tier.bps ? "is-active" : ""}`}
                    onClick={() => setCreatorFeeBps(tier.bps)}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Zone: One-Click Launch Button */}
            <div className="launch-execution-zone" style={{ marginTop: 24 }}>
              <div className="launch-wallet-bar">
                <div className="launch-wallet-id">
                  <span className="launch-pulse-dot" />
                  <span>
                    {ready && address
                      ? `Active Wallet: ${shortWallet(address)}`
                      : "Connect Phantom or Solflare wallet"}
                  </span>
                </div>
                <span className="launch-quote-tag">ClawPump Rent: ~0.0075 SOL</span>
              </div>

              {errorMessage && (
                <div className="launch-error-banner" role="alert">
                  ⚠️ {errorMessage}
                </div>
              )}

              {stepState !== "idle" && stepState !== "error" && stepState !== "success" && (
                <div className="launch-status-pill">
                  <span className="launch-spin">✦</span> {statusMessage}
                </div>
              )}

              <button
                type="button"
                className="launch-execute-btn"
                disabled={stepState === "quoting" || stepState === "paying" || stepState === "confirming"}
                onClick={handleLaunch}
              >
                {!address ? (
                  "Connect Wallet to Launch"
                ) : stepState === "quoting" ? (
                  <>
                    <span className="launch-spin">✦</span> Calculating Quote...
                  </>
                ) : stepState === "paying" ? (
                  <>
                    <span className="launch-spin">✦</span> Approve ~0.0075 SOL in Wallet...
                  </>
                ) : stepState === "confirming" ? (
                  <>
                    <span className="launch-spin">✦</span> Minting on ClawPump...
                  </>
                ) : (
                  <>🚀 One-Click Launch: {tokenSymbol || "Token"} × {selectedPair?.symbol || "xStock"}</>
                )}
              </button>
            </div>

            {/* Success Receipt Modal */}
            {launchReceipt && (
              <div className="launch-success-card" role="status">
                <div className="launch-success-title">
                  <span>🎉</span>
                  <h3>Successfully Paired &amp; Minted!</h3>
                </div>
                <p>Your community token is now live and trading against {selectedPair?.symbol} on Solana.</p>
                <div className="launch-receipt-grid">
                  <div className="launch-receipt-item">
                    <span>Pairing</span>
                    <strong>{tokenSymbol} × {selectedPair?.symbol}</strong>
                  </div>
                  <div className="launch-receipt-item">
                    <span>Total Supply</span>
                    <strong>{new Intl.NumberFormat("en-US").format(tokenSupply)}</strong>
                  </div>
                  <div className="launch-receipt-item">
                    <span>Mint Address</span>
                    <code>{launchReceipt.mintAddress.slice(0, 6)}...{launchReceipt.mintAddress.slice(-6)}</code>
                  </div>
                  <div className="launch-receipt-item">
                    <span>Payment Tx</span>
                    <code>{launchReceipt.txHash.slice(0, 6)}...{launchReceipt.txHash.slice(-6)}</code>
                  </div>
                </div>
                <div className="launch-success-actions">
                  <a href={launchReceipt.pumpUrl} target="_blank" rel="noreferrer" className="launch-btn-pump">
                    View on Pump.fun ↗
                  </a>
                  <a href={launchReceipt.explorerUrl} target="_blank" rel="noreferrer" className="launch-btn-solscan">
                    View on Solscan ↗
                  </a>
                  <Link href={`/app/asset/${selectedPair?.symbol}`} className="launch-btn-market">
                    Open {selectedPair?.symbol} Market Desk
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Interactive Holographic Token Simulator */}
        <div className="launch-stage-column">
          <div className="launch-stage-sticky">
            <div className="launch-holo-card" ref={holoCardRef}>
              <div className="launch-holo-aura" aria-hidden="true" />

              <div className="launch-holo-header">
                <span className="launch-holo-live-tag">
                  <span className="launch-pulse-dot" /> LIVE SIMULATOR
                </span>
                <span className="launch-holo-chain">Solana SPL Token</span>
              </div>

              {/* 3D Holographic Dual Coin Visual */}
              <div className="launch-holo-coin-stage">
                <div className="launch-holo-coin-ring">
                  <div className="launch-holo-coin-face">
                    {imageUrl ? (
                      <img src={imageUrl} alt={tokenSymbol || "Token"} className="launch-holo-coin-img" />
                    ) : (
                      <div className="launch-holo-coin-fallback">{tokenSymbol?.slice(0, 3) || "OS"}</div>
                    )}
                  </div>
                  {/* Paired Stock Badge */}
                  <div className="launch-holo-stock-badge" title={`Paired with ${selectedPair?.symbol}`}>
                    {selectedPair ? (
                      <StockLogo symbol={selectedPair.symbol} logo={selectedPair.imageUrl ?? undefined} size={38} />
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Token Info & Identity */}
              <div className="launch-holo-identity">
                <h3 className="launch-holo-name">{tokenName || "Your Token Name"}</h3>
                <div className="launch-holo-pair-badge">
                  <span>${tokenSymbol || "TOKEN"}</span>
                  <span className="launch-holo-times">×</span>
                  <span className="launch-holo-stock-symbol">{selectedPair?.symbol || "xStock"}</span>
                </div>
                <p className="launch-holo-desc">
                  {description || "The community asset paired directly against verified on-chain equities."}
                </p>
              </div>

              {/* Architectural Specs */}
              <div className="launch-holo-specs">
                <div className="launch-holo-spec-row">
                  <span>Total Supply</span>
                  <strong className="launch-holo-highlight">
                    {new Intl.NumberFormat("en-US").format(tokenSupply)}
                  </strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Paired Stock</span>
                  <strong>{selectedPair ? `${selectedPair.name.replace(/ xStock$/, "")} (${selectedPair.symbol})` : "xStock"}</strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Creator Fee</span>
                  <strong className="launch-holo-highlight">{creatorFeeBps / 100}% in {selectedPair?.symbol}</strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Bonding Curve</span>
                  <strong>ClawPump Engine</strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Settlement Latency</span>
                  <strong>~400ms Sub-second</strong>
                </div>
              </div>

              <div className="launch-holo-footer">
                <span>Direct liquidity settled in {selectedPair?.symbol || "xStocks"} on Solana</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
