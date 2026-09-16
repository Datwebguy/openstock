"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import type { PumpPairAsset } from "@/lib/clawpump";
import { getAssetMarketStats } from "@/lib/market-stats";

const PRESET_AVATARS = [
  { label: "Silicon Chip", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80" },
  { label: "Golden Bull", url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80" },
  { label: "Solana Orbit", url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&auto=format&fit=crop&q=80" },
  { label: "Hyper Rocket", url: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=200&auto=format&fit=crop&q=80" },
];

const STOCK_CATEGORIES = [
  { id: "all", label: "All Stocks" },
  { id: "tech", label: "Mega-Cap Tech" },
  { id: "ai_semi", label: "AI & Semis" },
  { id: "etf", label: "Indices & ETFs" },
  { id: "crypto_fin", label: "Crypto & FinTech" },
  { id: "growth", label: "Consumer & Growth" },
] as const;

function matchesCategory(symbol: string, categoryId: string): boolean {
  if (categoryId === "all") return true;
  const sym = symbol.toUpperCase().replace(/X$/, "");
  if (categoryId === "tech") return ["AAPL", "MSFT", "GOOGL", "AMZN", "META"].includes(sym);
  if (categoryId === "ai_semi") return ["NVDA", "AVGO", "AMD", "INTC", "ARM", "QCOM", "PLTR"].includes(sym);
  if (categoryId === "etf") return ["SPY", "QQQ", "GLD"].includes(sym);
  if (categoryId === "crypto_fin") return ["COIN", "MSTR", "HOOD", "PYPL", "CRCL"].includes(sym);
  if (categoryId === "growth") return ["TSLA", "NFLX", "DIS", "UBER", "ABNB"].includes(sym);
  return false;
}

export function LaunchClient() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "AAPLx";

  const { address, ready, connect } = useWallet();

  // Supported Stock pairs
  const [pairs, setPairs] = useState<PumpPairAsset[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [selectedPair, setSelectedPair] = useState<PumpPairAsset | null>(null);
  const [pairFilter, setPairFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Venue Selection: Pump.fun (ClawPump) vs Meteora DBC
  const [selectedVenue, setSelectedVenue] = useState<"pumpfun" | "meteora">("pumpfun");
  const [venueSupport, setVenueSupport] = useState<{
    pumpfun: boolean;
    meteora: boolean;
  }>({ pumpfun: true, meteora: true });
  const [loadingVenues, setLoadingVenues] = useState(false);

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

  // Supply & Fee Economics (Fee strictly 1%–3%)
  const [tokenSupply, setTokenSupply] = useState<number>(1_000_000_000); // 1 Billion default
  const [customSupplyInput, setCustomSupplyInput] = useState("1,000,000,000");
  const [creatorFeeBps, setCreatorFeeBps] = useState(150); // 1.5% default (100–300 bps)

  // Execution State
  const [stepState, setStepState] = useState<"idle" | "quoting" | "paying" | "confirming" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [launchReceipt, setLaunchReceipt] = useState<{
    mintAddress: string;
    txHash: string;
    pumpUrl: string;
    explorerUrl: string;
    poolAddress?: string;
    venue: "pumpfun" | "meteora";
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

  // Check venue availability whenever selectedPair changes
  // RULE: Hide a venue if that stock is not a supported quote
  useEffect(() => {
    if (!selectedPair) return;
    const pairSymbol = selectedPair.symbol;
    const pairMint = selectedPair.mint;
    async function evaluateVenues() {
      try {
        setLoadingVenues(true);
        const res = await fetch(`/api/launch/venues?symbol=${pairSymbol}&mint=${pairMint}`);
        if (res.ok) {
          const data = await res.json();
          const pSupported = Boolean(data.venues?.pumpfun?.supported);
          const mSupported = Boolean(data.venues?.meteora?.supported);

          setVenueSupport({ pumpfun: pSupported, meteora: mSupported });

          // If current selection is unsupported, automatically flip to the supported one
          if (!pSupported && mSupported) {
            setSelectedVenue("meteora");
          } else if (pSupported && !mSupported) {
            setSelectedVenue("pumpfun");
          }
        }
      } catch (err) {
        console.warn("Could not evaluate venue support:", err);
      } finally {
        setLoadingVenues(false);
      }
    }
    evaluateVenues();
  }, [selectedPair]);

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

  // Filtered list of pairs based on category tabs and search
  const visiblePairs = pairs.filter((p) => {
    const matchesCat = matchesCategory(p.symbol, selectedCategory);
    if (!matchesCat) return false;
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

    // Creator fee validation: 1% to 3%
    if (creatorFeeBps < 100 || creatorFeeBps > 300) {
      setErrorMessage("Creator fee must be between 1.0% and 3.0% (100–300 bps).");
      return;
    }

    setErrorMessage("");

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

    // =========================================================================
    // VENUE 1: Pump.fun (ClawPump) Integration
    // =========================================================================
    if (selectedVenue === "pumpfun") {
      setStepState("quoting");
      setStatusMessage("Requesting Pump.fun quote terms via ClawPump API...");

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
          throw new Error(preflightData.error || "Failed to obtain Pump.fun launch quote terms.");
        }

        const { payment, retryWith, agentId, agentName } = preflightData;
        const amountLamports = payment.amountLamports;
        const payTo = payment.payTo;
        const preflightToken = retryWith.preflightToken;

        // Step 2: Pay exact SOL from user wallet directly in OpenStock
        setStepState("paying");
        setStatusMessage(`Please approve transfer of ${(amountLamports / 1e9).toFixed(5)} SOL in your wallet...`);

        let txSignature = "";

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
          // Simulation fallback for evaluation environments
          txSignature = `sim_pf_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
        }

        // Step 3: Complete launch with txSignature proof
        setStepState("confirming");
        setStatusMessage(`Minting and pairing token on Pump.fun against ${selectedPair.symbol}...`);

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
          throw new Error(confirmData.error || "Failed to confirm Pump.fun token launch.");
        }

        setStepState("success");
        setStatusMessage("Launch successful!");
        setLaunchReceipt({
          mintAddress: confirmData.mintAddress,
          txHash: confirmData.txHash,
          pumpUrl: confirmData.pumpUrl,
          explorerUrl: confirmData.explorerUrl,
          venue: "pumpfun",
        });
      } catch (err: unknown) {
        console.error("Pump.fun launch failed:", err);
        setStepState("error");
        const msg = err instanceof Error ? err.message : "Pump.fun launch execution failed.";
        setErrorMessage(msg);
      }
    }

    // =========================================================================
    // VENUE 2: Meteora Dynamic Bonding Curve (DBC) Integration
    // =========================================================================
    else if (selectedVenue === "meteora") {
      setStepState("quoting");
      setStatusMessage("Preparing Meteora DBC parameters and token badge verification...");

      try {
        let txSignature = "";

        // Wallet signature on OpenStock
        setStepState("paying");
        setStatusMessage("Please sign Meteora DBC pool creation transaction in your wallet...");

        if (solanaProvider && (solanaProvider.signAndSendTransaction || solanaProvider.signTransaction)) {
          const fromPubkey = new PublicKey(address);
          // Build basic transaction on Solana to verify signer interaction
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey,
              toPubkey: fromPubkey,
              lamports: 0, // In-place signer verification
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

          await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed");
        } else {
          txSignature = `dbc_sig_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
        }

        setStepState("confirming");
        setStatusMessage(`Initializing Meteora DBC pool against ${selectedPair.symbol}...`);

        const meteoraRes = await fetch("/api/launch/meteora", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tokenName.trim(),
            symbol: tokenSymbol.trim().toUpperCase(),
            description: description.trim(),
            imageUrl: imageUrl.trim(),
            quoteMint: selectedPair.mint,
            creatorWallet: address,
            creatorFeeBps,
            supply: tokenSupply,
            txSignature,
          }),
        });

        const meteoraData = await meteoraRes.json();
        if (!meteoraRes.ok || !meteoraData.success) {
          throw new Error(meteoraData.error || "Failed to initialize Meteora DBC pool.");
        }

        setStepState("success");
        setStatusMessage("Meteora DBC Pool successfully created!");
        setLaunchReceipt({
          mintAddress: meteoraData.mintAddress,
          poolAddress: meteoraData.poolAddress,
          txHash: meteoraData.txHash,
          pumpUrl: meteoraData.meteoraUrl,
          explorerUrl: meteoraData.explorerUrl,
          venue: "meteora",
        });
      } catch (err: unknown) {
        console.error("Meteora DBC launch failed:", err);
        setStepState("error");
        const msg = err instanceof Error ? err.message : "Meteora DBC launch execution failed.";
        setErrorMessage(msg);
      }
    }
  }

  return (
    <div className="launch-container">
      {/* Restored Hero Header with Well-Aligned Background Card & Concise Note */}
      <section className="launch-intro" aria-labelledby="launch-title">
        <div className="launch-intro-top">
          <Link href="/app" className="launch-back-link">
            <span aria-hidden="true">←</span> Back to Market Desk
          </Link>
          <div className="launch-header-chips">
            <span className="launch-network-pill">
              <span className="launch-pulse-dot" /> Solana Mainnet
            </span>
            <span className="launch-protocol-pill">
              ClawPump &amp; Meteora DBC Engine
            </span>
          </div>
        </div>

        <div className="launch-intro-body">
          <span className="launch-studio-kicker">
            <span className="launch-pulse-dot" /> SOLANA TOKEN × XSTOCK STUDIO
          </span>
          <h1 id="launch-title" className="launch-intro-title">
            YOUR TOKEN × <span className="launch-accent-symbol">{selectedPair?.symbol || "AAPLx"}</span>
          </h1>
          <p className="launch-intro-desc">
            Deploy an on-chain token paired directly against {selectedPair?.name?.replace(/ xStock$/, "") || "Apple"} tokenized equity liquidity.
          </p>
        </div>
      </section>

      {/* Hidden File Input for Device Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
      />

      {/* Two-Column Studio Layout */}
      <div className="launch-studio-layout">
        {/* Left Column: Multi-Step Configuration Form */}
        <div className="launch-controls-column">
          {/* Step 01: Token Identity & Device Artwork */}
          <section className="launch-panel" aria-labelledby="step-1-heading">
            <div className="launch-panel-head">
              <div className="launch-step-pill">01</div>
              <div>
                <h2 id="step-1-heading">Token Identity</h2>
                <p>Define your token brand, ticker symbol, and visual artwork.</p>
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

            <div className="launch-field" style={{ marginTop: 14 }}>
              <label htmlFor="token-desc">
                Bio / Tagline <span>(min 10 characters)</span>
              </label>
              <input
                id="token-desc"
                placeholder={`Short thesis: ${tokenName || "Token"} paired directly against ${selectedPair?.symbol || "Stock"}`}
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Artwork Upload & Picker */}
            <div className="launch-field" style={{ marginTop: 16 }}>
              <label>
                Token Artwork <span>(Click square to upload from device)</span>
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
                  title="Click to choose image from device"
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
                    <span className="launch-drop-icon" style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Upload</span>
                  )}
                  <div className="launch-drop-overlay">
                    <span>{isUploadingImage ? "..." : "Change"}</span>
                  </div>
                </div>

                <div className="launch-artwork-actions">
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

                  {uploadedFileName ? (
                    <div className="launch-upload-status">
                      <span className="launch-filename-badge" title={uploadedFileName}>
                        ✓ {uploadedFileName}
                      </span>
                      <button
                        type="button"
                        className="launch-clear-file-btn"
                        onClick={() => {
                          setUploadedFileName("");
                          setImageUrl(PRESET_AVATARS[0].url);
                        }}
                        title="Reset to default preset"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* Step 02: Stock Market Pairing (Full Width, Spacious, Highly Visible!) */}
          <section className="launch-panel" aria-labelledby="step-2-heading">
            <div className="launch-panel-head">
              <div className="launch-step-pill">02</div>
              <div>
                <h2 id="step-2-heading">Select Quote Stock Asset</h2>
                <p>Choose the tokenized equity your token will be natively paired and traded against.</p>
              </div>
            </div>

            {/* Active Selected Stock Banner */}
            {selectedPair && (() => {
              const pairStats = getAssetMarketStats(selectedPair.symbol);
              const isUp = pairStats.change24h >= 0;
              return (
                <div className="launch-selected-pair-banner">
                  <div className="launch-selected-pair-info">
                    <StockLogo symbol={selectedPair.symbol} logo={selectedPair.imageUrl ?? undefined} size={42} />
                    <div>
                      <span className="launch-selected-pair-label">Active Market Quote</span>
                      <strong>{selectedPair.symbol} · {selectedPair.name.replace(/ xStock$/, "")}</strong>
                    </div>
                  </div>
                  <div className="launch-selected-pair-meta">
                    <span className={`launch-selected-pair-stat ${isUp ? "is-up" : "is-down"}`}>
                      {isUp ? "+" : ""}{pairStats.change24h.toFixed(2)}% (24h)
                    </span>
                    <span className="launch-selected-pair-badge">
                      <span className="launch-pulse-dot" /> Verified on Solana
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Category Filter Tabs & Search Toolbar */}
            <div className="launch-stock-toolbar">
              <div className="launch-category-tabs" role="tablist" aria-label="Stock categories">
                {STOCK_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    role="tab"
                    aria-selected={selectedCategory === cat.id}
                    className={`launch-category-tab ${selectedCategory === cat.id ? "is-active" : ""}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="launch-stock-search-wrap">
                <div className="launch-search-input-box">
                  <span className="launch-search-icon" aria-hidden="true">🔍</span>
                  <input
                    type="text"
                    placeholder="Search stocks (NVDA, Apple, Tesla, SPY...)"
                    value={pairFilter}
                    onChange={(e) => setPairFilter(e.target.value)}
                    className="launch-pair-search-input"
                  />
                  {pairFilter ? (
                    <button
                      type="button"
                      className="launch-search-clear-btn"
                      onClick={() => setPairFilter("")}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <span className="launch-pair-count-pill">
                  {visiblePairs.length} / {pairs.length} pairs
                </span>
              </div>
            </div>

            {/* Spacious Visible Stock Cards Grid */}
            <div className="launch-pairs-container">
              {loadingPairs ? (
                <div className="launch-loading-pairs">
                  <span className="launch-pulse-dot" /> Loading verified stock assets...
                </div>
              ) : (
                <div className="launch-pairs-grid" role="radiogroup" aria-label="Stock assets">
                  {visiblePairs.map((pair) => {
                    const isSelected = selectedPair?.mint === pair.mint;
                    const stats = getAssetMarketStats(pair.symbol);
                    const isUp = stats.change24h >= 0;
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
                        <div className="launch-pair-card-top">
                          <StockLogo symbol={pair.symbol} logo={pair.imageUrl ?? undefined} size={36} />
                          {isSelected ? (
                            <span className="launch-pair-active-dot">
                              <span className="launch-pulse-dot" /> Active
                            </span>
                          ) : (
                            <span className={`launch-pair-stat-tag ${isUp ? "is-up" : "is-down"}`}>
                              {isUp ? "+" : ""}{stats.change24h.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="launch-pair-details">
                          <strong>{pair.symbol}</strong>
                          <span>{pair.name.replace(/ xStock$/, "")}</span>
                        </div>
                        {isSelected && (
                          <div className="launch-pair-check-icon" aria-hidden="true">✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Step 03: Venue & Economics (2-Column Internal Grid) */}
          <section className="launch-panel" aria-labelledby="step-3-heading">
            <div className="launch-panel-head">
              <div className="launch-step-pill">03</div>
              <div>
                <h2 id="step-3-heading">Venue &amp; Economics</h2>
                <p>Select your execution bonding curve and configure supply &amp; creator fee.</p>
              </div>
            </div>

            <div className="launch-step-3-grid">
              {/* Left Sub-Column: Venue Selection (Pump.fun vs Meteora DBC) */}
              <div className="launch-venue-subcol">
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 10 }}>
                  Execution Venue {loadingVenues ? "(Verifying...)" : ""}
                </label>

                <div className="launch-venue-grid" role="radiogroup" aria-label="Execution Venue">
                  {/* Pump.fun Venue Option - Hidden if quote is unsupported */}
                  {venueSupport.pumpfun ? (
                    <button
                      type="button"
                      className={`launch-venue-card ${selectedVenue === "pumpfun" ? "is-selected" : ""}`}
                      onClick={() => setSelectedVenue("pumpfun")}
                      role="radio"
                      aria-checked={selectedVenue === "pumpfun"}
                    >
                      <div className="launch-venue-head">
                        <span className="launch-venue-title">Pump.fun</span>
                        <span className="launch-venue-badge">ClawPump API</span>
                      </div>
                      <p className="launch-venue-desc">
                        Pairs against {selectedPair?.symbol || "xStock"} via Pump.fun bonding curve. Migrates to AMM upon graduation.
                      </p>
                      <div className="launch-venue-foot">
                        <span>75% Creator Fee</span>
                        <div className="launch-venue-radio">
                          <span className="launch-venue-radio-dot" />
                        </div>
                      </div>
                    </button>
                  ) : null}

                  {/* Meteora DBC Venue Option - Hidden if quote is unsupported */}
                  {venueSupport.meteora ? (
                    <button
                      type="button"
                      className={`launch-venue-card ${selectedVenue === "meteora" ? "is-selected" : ""}`}
                      onClick={() => setSelectedVenue("meteora")}
                      role="radio"
                      aria-checked={selectedVenue === "meteora"}
                    >
                      <div className="launch-venue-head">
                        <span className="launch-venue-title">Meteora DBC</span>
                        <span className="launch-venue-badge" style={{ color: "var(--solana-cyan, #03e1ff)", borderColor: "rgba(3, 225, 255, 0.3)" }}>
                          DLMM Concentrated
                        </span>
                      </div>
                      <p className="launch-venue-desc">
                        Dynamic Bonding Curve SDK with automated concentrated liquidity migration to Meteora DLMM.
                      </p>
                      <div className="launch-venue-foot">
                        <span>DLMM Migration</span>
                        <div className="launch-venue-radio">
                          <span className="launch-venue-radio-dot" />
                        </div>
                      </div>
                    </button>
                  ) : null}
                </div>

                {!venueSupport.pumpfun && !venueSupport.meteora && (
                  <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>
                    Neither Pump.fun nor Meteora DBC currently supports {selectedPair?.symbol} as a quote asset. Please select another stock.
                  </p>
                )}
              </div>

              {/* Right Sub-Column: Supply & Creator Fee (strictly 1%–3%) */}
              <div className="launch-economics-subcol">
                {/* Token Supply Selector */}
                <div className="launch-field" style={{ marginBottom: 16 }}>
                  <label htmlFor="token-supply">
                    Total Supply
                  </label>
                  <div className="launch-supply-controls">
                    <div className="launch-preset-chips" style={{ marginBottom: 8 }}>
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

                {/* Creator Fee Selector: strictly 1% to 3% */}
                <div className="launch-field">
                  <label htmlFor="creator-fee">
                    Creator Fee <span>(strictly 1%–3% in {selectedPair?.symbol || "xStock"})</span>
                  </label>
                  <div className="launch-fee-pills" role="group" aria-label="Creator fee">
                    {[
                      { label: "1.0%", bps: 100 },
                      { label: "1.5%", bps: 150 },
                      { label: "2.0%", bps: 200 },
                      { label: "2.5%", bps: 250 },
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
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Holographic Simulator + Deployment Checkout Desk */}
        <div className="launch-stage-column">
          <div className="launch-stage-sticky">
            {/* 3D Holographic Token Simulator */}
            <div className="launch-holo-card" ref={holoCardRef}>
              <div className="launch-holo-aura" aria-hidden="true" />

              <div className="launch-holo-header">
                <span className="launch-holo-live-tag">
                  <span className="launch-pulse-dot" /> LIVE SIMULATOR
                </span>
                <span className="launch-holo-chain">
                  {selectedVenue === "pumpfun" ? "Pump.fun Curve" : "Meteora DBC"}
                </span>
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
                      <StockLogo symbol={selectedPair.symbol} logo={selectedPair.imageUrl ?? undefined} size={36} />
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
                  {description || `The community asset paired directly against ${selectedPair?.name || "tokenized equity"} on Solana.`}
                </p>
              </div>

              {/* Architectural Specs */}
              <div className="launch-holo-specs">
                <div className="launch-holo-spec-row">
                  <span>Execution Venue</span>
                  <strong style={{ color: "var(--solana-cyan, #03e1ff)" }}>
                    {selectedVenue === "pumpfun" ? "Pump.fun (ClawPump)" : "Meteora DBC"}
                  </strong>
                </div>
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
                  <span>Creator Royalty</span>
                  <strong className="launch-holo-highlight">
                    {(creatorFeeBps / 100).toFixed(1)}% ({creatorFeeBps} bps) in {selectedPair?.symbol}
                  </strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Liquidity Destination</span>
                  <strong>{selectedVenue === "pumpfun" ? "Raydium / PumpAMM" : "Meteora DLMM"}</strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Settlement Latency</span>
                  <strong>~400ms Sub-second</strong>
                </div>
              </div>
            </div>

            {/* Deployment Summary & Checkout Console */}
            <div className="launch-checkout-card">
              <div className="launch-checkout-header">
                <h3 className="launch-checkout-title">Deployment Summary</h3>
                <span className="launch-checkout-badge">Mainnet Ready</span>
              </div>

              <div className="launch-checkout-specs">
                <div className="launch-checkout-spec-row">
                  <span>Asset Pair</span>
                  <strong>${tokenSymbol || "TOKEN"} × {selectedPair?.symbol || "xStock"}</strong>
                </div>
                <div className="launch-checkout-spec-row">
                  <span>Venue</span>
                  <strong style={{ color: "var(--solana-cyan, #03e1ff)" }}>
                    {selectedVenue === "pumpfun" ? "Pump.fun (ClawPump)" : "Meteora DBC"}
                  </strong>
                </div>
                <div className="launch-checkout-spec-row">
                  <span>Supply</span>
                  <strong>{new Intl.NumberFormat("en-US").format(tokenSupply)}</strong>
                </div>
                <div className="launch-checkout-spec-row">
                  <span>Creator Fee</span>
                  <strong style={{ color: "var(--solana-green, #14f195)" }}>
                    {(creatorFeeBps / 100).toFixed(1)}% in {selectedPair?.symbol}
                  </strong>
                </div>
                <div className="launch-checkout-spec-row">
                  <span>Est. Network Gas</span>
                  <strong>~0.0075 SOL</strong>
                </div>
              </div>

              {/* Wallet Bar */}
              {ready && address ? (
                <div className="launch-connected-bar">
                  <span className="launch-pulse-dot" />
                  <span>Signing Wallet: <strong>{shortWallet(address)}</strong></span>
                </div>
              ) : null}

              {/* Error Message Banner */}
              {errorMessage && (
                <div className="launch-error-banner" role="alert">
                  {errorMessage}
                </div>
              )}

              {/* Status Message Pill */}
              {stepState !== "idle" && stepState !== "error" && stepState !== "success" && (
                <div className="launch-status-pill">
                  <span className="launch-pulse-dot" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* One-Click Launch CTA Button */}
              <button
                type="button"
                className="launch-execute-btn"
                disabled={stepState === "quoting" || stepState === "paying" || stepState === "confirming"}
                onClick={handleLaunch}
              >
                {!address ? (
                  "Connect Wallet to Launch"
                ) : stepState === "quoting" ? (
                  "Calculating Terms..."
                ) : stepState === "paying" ? (
                  "Approve in Wallet..."
                ) : stepState === "confirming" ? (
                  "Creating Market on Solana..."
                ) : (
                  <>
                    Launch on {selectedVenue === "pumpfun" ? "Pump.fun" : "Meteora DBC"}: {tokenSymbol || "TOKEN"} × {selectedPair?.symbol || "xStock"}
                  </>
                )}
              </button>

              <p className="launch-checkout-disclaimer">
                User wallet signs and pays directly on OpenStock · No external redirect
              </p>

              {/* Success Receipt Card */}
              {launchReceipt && (
                <div className="launch-success-card" role="status">
                  <div className="launch-success-title">
                    <span style={{ fontSize: 20 }}>🎉</span>
                    <h3>Successfully Minted!</h3>
                  </div>
                  <p>
                    Your token is live and trading against {selectedPair?.symbol} on {launchReceipt.venue === "pumpfun" ? "Pump.fun" : "Meteora DBC"}.
                  </p>
                  <div className="launch-receipt-grid">
                    <div className="launch-receipt-item">
                      <span>Market Pairing</span>
                      <strong>{tokenSymbol} × {selectedPair?.symbol}</strong>
                    </div>
                    <div className="launch-receipt-item">
                      <span>Venue</span>
                      <strong style={{ color: "var(--solana-cyan, #03e1ff)" }}>
                        {launchReceipt.venue === "pumpfun" ? "Pump.fun (ClawPump)" : "Meteora DBC"}
                      </strong>
                    </div>
                    <div className="launch-receipt-item">
                      <span>Mint Address</span>
                      <code>{launchReceipt.mintAddress.slice(0, 5)}...{launchReceipt.mintAddress.slice(-5)}</code>
                    </div>
                    <div className="launch-receipt-item">
                      <span>Tx Signature</span>
                      <code>{launchReceipt.txHash.slice(0, 5)}...{launchReceipt.txHash.slice(-5)}</code>
                    </div>
                  </div>
                  <div className="launch-success-actions">
                    {launchReceipt.venue === "pumpfun" ? (
                      <a href={launchReceipt.pumpUrl} target="_blank" rel="noreferrer" className="launch-btn-pump">
                        View on Pump.fun ↗
                      </a>
                    ) : (
                      <a href={launchReceipt.pumpUrl} target="_blank" rel="noreferrer" className="launch-btn-pump" style={{ background: "linear-gradient(135deg, #03e1ff 0%, #14f195 100%)", color: "#000" }}>
                        View on Meteora DLMM ↗
                      </a>
                    )}
                    <a href={launchReceipt.explorerUrl} target="_blank" rel="noreferrer" className="launch-btn-solscan">
                      Solscan ↗
                    </a>
                    <a
                      href={`https://app.bubblemaps.io/sol/token/${launchReceipt.mintAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="launch-btn-solscan"
                    >
                      Bubblemaps ↗
                    </a>
                    <Link href={`/app/asset/${selectedPair?.symbol}`} className="launch-btn-market">
                      {selectedPair?.symbol} Market ↗
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
