"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";
import { ShareToXModal } from "@/components/share-to-x-modal";
import { WalletSelectModal } from "@/components/wallet-select-modal";
import type { PumpPairAsset } from "@/lib/clawpump";
import { getAssetMarketStats } from "@/lib/market-stats";
import {
  applyComputeBudget,
  getDynamicPriorityFee,
  preflightSimulate,
  translateWalletError,
  type PriorityFeeTier,
} from "@/lib/solana-preflight";
import {
  METEORA_DBC_CURVE_PRESETS,
  type DbcCurvePresetKey,
} from "@/lib/meteora-dbc";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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

const KNOWN_STOCK_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "AMZN", "META",
  "NVDA", "AVGO", "AMD", "INTC", "ARM", "QCOM", "PLTR",
  "SPY", "QQQ", "GLD",
  "COIN", "MSTR", "HOOD", "PYPL", "CRCL",
  "TSLA", "NFLX", "DIS", "UBER", "ABNB",
  "SPCX", "RBLX", "SLX", "DNUT", "HTZ", "PTN", "FLY", "BROS", "FLWS", "SCHH",
]);

function isStockAsset(symbol: string): boolean {
  if (!symbol) return false;
  const sym = symbol.toUpperCase().replace(/X$/, "");
  return KNOWN_STOCK_TICKERS.has(sym) || symbol.toUpperCase().endsWith("X");
}

function matchesCategory(symbol: string, categoryId: string): boolean {
  if (!isStockAsset(symbol)) return false;
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
  const quickMode = searchParams.get("quick") === "1";

  const { address, ready, connect, connecting, canSign } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);

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
    meteoraBadged: boolean;
    dbcConfigReady: boolean;
  }>({ pumpfun: true, meteora: false, meteoraBadged: false, dbcConfigReady: false });
  const [loadingVenues, setLoadingVenues] = useState(false);

  // Meteora DBC equity-tuned presets (Equity Standard / Momentum / Deep Book)
  const [selectedCurvePreset, setSelectedCurvePreset] = useState<DbcCurvePresetKey>("linear");

  // Token-2022 Badge State — launches pair against the selected xStock only
  const [stockBadgeStatus, setStockBadgeStatus] = useState<"checking" | "badged" | "unbadged">("checking");
  const quoteBadgeStatus = stockBadgeStatus;
  const effectiveQuoteMint = selectedPair?.mint;
  const effectiveQuoteSymbol = selectedPair?.symbol;

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

  // Deployer Initial Buy (Dev Buy / Pre-mine) State
  const [devBuyPercent, setDevBuyPercent] = useState<number>(0); // 0% default
  const [devBuySolInput, setDevBuySolInput] = useState<string>("0");

  // Hardened Priority Fee & Preflight Simulation State
  const [priorityTier, setPriorityTier] = useState<PriorityFeeTier>("standard");
  const [simulatedUnits, setSimulatedUnits] = useState<number | null>(null);

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
  const [showShareModal, setShowShareModal] = useState(false);

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

  // Fetch supported pairs
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

    setStockBadgeStatus("checking");

    async function evaluateVenues() {
      try {
        setLoadingVenues(true);
        const res = await fetch(`/api/launch/venues?symbol=${pairSymbol}&mint=${pairMint}`);
        if (res.ok) {
          const data = await res.json();
          const pSupported = Boolean(data.venues?.pumpfun?.supported);
          const mSupported = Boolean(data.venues?.meteora?.supported);
          const isBadged = Boolean(data.isBadged ?? data.venues?.meteora?.isBadged);
          const dbcConfigReady = Boolean(data.dbcConfigReady ?? data.venues?.meteora?.dbcConfigReady);

          setStockBadgeStatus(isBadged ? "badged" : "unbadged");
          setVenueSupport({
            pumpfun: pSupported,
            meteora: mSupported,
            meteoraBadged: isBadged,
            dbcConfigReady,
          });

          // Pre–Phase D: Pump is the working launch path. Only use Meteora when
          // badge + METEORA_DBC_CONFIG are both ready (venues.supported already encodes that).
          if (pSupported) {
            setSelectedVenue("pumpfun");
          } else if (mSupported) {
            setSelectedVenue("meteora");
          } else {
            setSelectedVenue("pumpfun");
          }
        }
      } catch (err) {
        console.warn("Could not evaluate venue support:", err);
        setStockBadgeStatus("unbadged");
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

  // Pump.fun genesis buy is paid in SOL for network/curve bootstrapping.
  // The quote asset for the pair remains the selected xStock — SOL is not the product quote.
  const estimateTokensForSol = (sol: number, supply: number = tokenSupply) => {
    if (sol <= 0) return 0;
    const virtualSol = 30;
    const virtualTokens = supply * 1.073;
    const tokens = (virtualTokens * sol) / (virtualSol + sol);
    return Math.min(tokens, supply * 0.5);
  };

  const estimateSolForPercent = (pct: number, supply: number = tokenSupply) => {
    if (pct <= 0) return 0;
    const targetTokens = (pct / 100) * supply;
    const virtualSol = 30;
    const virtualTokens = supply * 1.073;
    if (targetTokens >= virtualTokens) return 30;
    const sol = (virtualSol * targetTokens) / (virtualTokens - targetTokens);
    return Math.max(0, Number(sol.toFixed(3)));
  };

  function handleDevBuyPercentSelect(pct: number) {
    setDevBuyPercent(pct);
    if (pct === 0) {
      setDevBuySolInput("0");
    } else {
      const estimatedSol = estimateSolForPercent(pct);
      setDevBuySolInput(estimatedSol.toString());
    }
  }

  function handleDevBuySolChange(val: string) {
    setDevBuySolInput(val);
    const numeric = parseFloat(val);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setDevBuyPercent(0);
    } else {
      const tokens = estimateTokensForSol(numeric);
      const calculatedPct = Math.min(50, (tokens / tokenSupply) * 100);
      setDevBuyPercent(Number(calculatedPct.toFixed(2)));
    }
  }

  // Preset avatar selector
  function handlePresetSelect(url: string) {
    setImageUrl(url);
    setUploadedFileName("");
  }

  // Handle local file selection for upload
  async function handleFileSelect(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image file must be under 5MB.");
      return;
    }

    setUploadedFileName(file.name);
    setIsUploadingImage(true);
    setErrorMessage("");

    try {
      const localDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setImageUrl(localDataUrl);

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

  // Filtered list of pairs based on category tabs, search, and venue support
  const visiblePairs = pairs.filter((p) => {
    const matchesCat = matchesCategory(p.symbol, selectedCategory);
    if (!matchesCat) return false;
    
    // Filter by venue support
    if (selectedVenue === "meteora") {
      // Only show stocks that support Meteora DBC (NVDAx, AAPLx)
      const meteoraSupportedSymbols = ["NVDAx", "AAPLx"];
      if (!meteoraSupportedSymbols.includes(p.symbol)) return false;
    }
    
    if (!pairFilter.trim()) return true;
    const q = pairFilter.toLowerCase();
    return p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  // Handle One-Click Launch Action with Hardened Preflight Simulator & Priority Fees
  async function handleLaunch() {
    if (!address) {
      setShowWalletModal(true);
      return;
    }

    if (!selectedPair || !effectiveQuoteMint) {
      setErrorMessage("Please select a supported xStock market pair.");
      return;
    }

    // Prevent launching an unbadged pair that cannot settle on-chain
    if (selectedVenue === "meteora" && quoteBadgeStatus === "unbadged") {
      setErrorMessage("This xStock is not badged on Meteora DBC yet. Launch against it on Pump.fun, or pick a badged stock.");
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

    const resolvedDescription =
      description.trim().length >= 10
        ? description.trim()
        : `${tokenName.trim()} paired against ${selectedPair.symbol} on OpenStock`;

    if (!quickMode && description.trim().length < 10) {
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
      setStatusMessage("Preparing launch terms...");

      try {
        // Step 1: Preflight quote
        const preflightRes = await fetch("/api/launch/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tokenName.trim(),
            symbol: tokenSymbol.trim().toUpperCase(),
            description: resolvedDescription,
            imageUrl: imageUrl.trim(),
            pumpQuoteMint: selectedPair.mint,
            pumpCreatorFeeBps: creatorFeeBps,
            walletAddress: address,
            supply: tokenSupply,
            devBuySol: Number(devBuySolInput) > 0 ? Number(devBuySolInput) : 0,
          }),
        });

        const preflightData = await preflightRes.json();
        if (!preflightRes.ok || !preflightData.payment) {
          throw new Error(preflightData.error || "Payment didn’t go through. Try again.");
        }

        const { payment, retryWith, agentId, agentName } = preflightData;
        const amountLamports = payment.amountLamports;
        const payTo = payment.payTo;
        const preflightToken = retryWith.preflightToken;

        // Step 2: Pay from user wallet directly in OpenStock
        setStepState("paying");
        setStatusMessage("Preparing transaction...");

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

          // Dynamic priority fee estimation
          const microLamports = await getDynamicPriorityFee(connection, priorityTier);
          applyComputeBudget(tx, 160_000, microLamports);

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          tx.recentBlockhash = blockhash;
          tx.feePayer = fromPubkey;

          // Simulation check before wallet popup
          setStatusMessage("Checking transaction...");
          const sim = await preflightSimulate(connection, tx, fromPubkey);
          if (!sim.success) {
            throw new Error(sim.humanMessage || sim.error || "Payment didn’t go through. Try again.");
          }
          if (sim.unitsConsumed) {
            setSimulatedUnits(sim.unitsConsumed);
          }

          setStatusMessage("Please approve in your wallet...");

          if (solanaProvider.signAndSendTransaction) {
            const sendRes = await solanaProvider.signAndSendTransaction(tx);
            txSignature = sendRes.signature;
          } else if (solanaProvider.signTransaction) {
            const signed = await solanaProvider.signTransaction(tx);
            setStatusMessage("Submitting transaction...");
            txSignature = await connection.sendRawTransaction(signed.serialize(), {
              skipPreflight: true,
              maxRetries: 3,
            });
          }

          setStatusMessage("Confirming transaction...");
          const confirmation = await connection.confirmTransaction(
            { signature: txSignature, blockhash, lastValidBlockHeight },
            "confirmed"
          );
          if (confirmation.value.err) {
            throw new Error(translateWalletError(confirmation.value.err));
          }
        } else {
          throw new Error("Wallet not detected. Connect Phantom or Solflare to continue.");
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
            description: resolvedDescription,
            imageUrl: imageUrl.trim(),
            pumpQuoteMint: selectedPair.mint,
            pumpCreatorFeeBps: creatorFeeBps,
            walletAddress: address,
            agentId,
            agentName,
            txSignature,
            preflightToken,
            supply: tokenSupply,
            devBuySol: Number(devBuySolInput) > 0 ? Number(devBuySolInput) : 0,
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
        const msg = translateWalletError(err);
        setErrorMessage(msg);
      }
    }

    // =========================================================================
    // VENUE 2: Meteora Dynamic Bonding Curve (DBC) Integration
    // =========================================================================
    else if (selectedVenue === "meteora") {
      setStepState("quoting");
      setStatusMessage("Preparing launch terms...");

      try {
        if (!solanaProvider || (!solanaProvider.signAndSendTransaction && !solanaProvider.signTransaction)) {
          throw new Error("Wallet not detected. Connect Phantom or Solflare to continue.");
        }

        // Step 1: Request prepared pool transaction
        const prepareRes = await fetch("/api/launch/meteora", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "prepare",
            name: tokenName.trim(),
            symbol: tokenSymbol.trim().toUpperCase(),
            description: resolvedDescription,
            imageUrl: imageUrl.trim(),
            quoteMint: effectiveQuoteMint,
            creatorWallet: address,
            creatorFeeBps,
            supply: tokenSupply,
            curvePreset: selectedCurvePreset,
          }),
        });

        const prepareData = await prepareRes.json();
        if (!prepareRes.ok || !prepareData.transactionBase64) {
          throw new Error(prepareData.error || "Failed to prepare pool. Please try again.");
        }

        const { transactionBase64, mintAddress, poolAddress } = prepareData;

        // Step 2: Sign transaction with user wallet
        setStepState("paying");
        setStatusMessage("Preparing transaction...");

        const fromPubkey = new PublicKey(address);
        const txBytes = base64ToUint8Array(transactionBase64);
        const tx = Transaction.from(txBytes);

        // Preflight validation simulation
        setStatusMessage("Checking transaction...");
        try {
          const sim = await preflightSimulate(connection, tx, fromPubkey);
          if (sim.unitsConsumed) {
            setSimulatedUnits(sim.unitsConsumed);
          }
        } catch (simErr) {
          console.warn("Transaction check note:", simErr);
        }

        setStatusMessage("Please approve in your wallet...");

        let txSignature = "";
        if (solanaProvider.signAndSendTransaction) {
          const sendRes = await solanaProvider.signAndSendTransaction(tx);
          txSignature = sendRes.signature;
        } else if (solanaProvider.signTransaction) {
          const signed = await solanaProvider.signTransaction(tx);
          setStatusMessage("Submitting transaction...");
          txSignature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
        }

        setStatusMessage("Confirming launch...");
        const confirmation = await connection.confirmTransaction(txSignature, "confirmed");
        if (confirmation.value.err) {
          throw new Error(translateWalletError(confirmation.value.err));
        }

        // Step 3: Confirm launch on OpenStock registry
        setStepState("confirming");
        setStatusMessage(`Finalizing launch against ${effectiveQuoteSymbol}...`);

        const confirmRes = await fetch("/api/launch/meteora", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "confirm",
            name: tokenName.trim(),
            symbol: tokenSymbol.trim().toUpperCase(),
            description: resolvedDescription,
            imageUrl: imageUrl.trim(),
            quoteMint: effectiveQuoteMint,
            creatorWallet: address,
            creatorFeeBps,
            supply: tokenSupply,
            curvePreset: selectedCurvePreset,
            txSignature,
            mintAddress,
            poolAddress,
          }),
        });

        const confirmData = await confirmRes.json();
        if (!confirmRes.ok || !confirmData.success) {
          throw new Error(confirmData.error || "Payment didn’t go through. Try again.");
        }

        setStepState("success");
        setStatusMessage("Live!");
        setLaunchReceipt({
          mintAddress: confirmData.mintAddress,
          poolAddress: confirmData.poolAddress,
          txHash: confirmData.txHash,
          pumpUrl: confirmData.meteoraUrl || `https://app.meteora.ag/dlmm/${confirmData.poolAddress}`,
          explorerUrl: confirmData.explorerUrl || `https://solscan.io/tx/${confirmData.txHash}`,
          venue: "meteora",
        });
      } catch (err: unknown) {
        console.error("Meteora launch failed:", err);
        setStepState("error");
        const msg = translateWalletError(err);
        setErrorMessage(msg);
      }
    }
  }

  return (
    <div className={`launch-container ${quickMode ? "launch-container--quick" : ""}`}>
      <section className="launch-intro" aria-labelledby="launch-title">
        <div className="launch-intro-top">
          <Link href={quickMode ? `/app/asset/${encodeURIComponent(initialSymbol)}` : "/app"} className="launch-back-link">
            <span aria-hidden="true">←</span> {quickMode ? `Back to ${initialSymbol}` : "Back to Market Desk"}
          </Link>
          <div className="launch-header-chips">
            <span className="launch-network-pill">
              <span className="launch-pulse-dot" /> Solana
            </span>
            <span className="launch-protocol-pill">
              {quickMode ? "One-tap stock pair" : "Stock-Paired Token Studio"}
            </span>
          </div>
        </div>

        <div className="launch-intro-body">
          <span className="launch-studio-kicker">
            <span className="launch-pulse-dot" /> {quickMode ? "ONE-TAP LAUNCH" : "TOKEN × STOCK STUDIO"}
          </span>
          <h1 id="launch-title" className="launch-intro-title">
            YOUR TOKEN × <span className="launch-accent-symbol">{selectedPair?.symbol || initialSymbol}</span>
          </h1>
          <p className="launch-intro-desc">
            {quickMode
              ? `Name it, confirm, and launch against ${selectedPair?.symbol || initialSymbol}. Quote is the stock — not SOL or USDC.`
              : `Deploy an on-chain token paired directly against ${selectedPair?.name?.replace(/ xStock$/, "") || "Apple"} tokenized equity liquidity.`}
          </p>
        </div>
      </section>

      {quickMode ? (
        <section className="launch-quick-panel" aria-label="One-tap launch">
          <div className="launch-quick-pair">
            <StockLogo symbol={selectedPair?.symbol || initialSymbol} logo={selectedPair?.imageUrl ?? undefined} size={40} />
            <div>
              <strong>{selectedPair?.symbol || initialSymbol}</strong>
              <span>Quote locked · {selectedVenue === "meteora" ? "Meteora DBC" : "Pump.fun"} · {(creatorFeeBps / 100).toFixed(1)}% fee in stock</span>
            </div>
          </div>
          <div className="launch-quick-fields">
            <label>
              Token name
              <input
                value={tokenName}
                maxLength={32}
                placeholder="e.g. Compute Bull"
                onChange={(e) => setTokenName(e.target.value)}
              />
            </label>
            <label>
              Ticker
              <input
                value={tokenSymbol}
                maxLength={10}
                placeholder="COMPUTE"
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              />
            </label>
          </div>
          {!ready || !address ? (
            <button type="button" className="button button--gradient" onClick={() => setShowWalletModal(true)} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Wallet to launch"}
            </button>
          ) : (
            <button
              type="button"
              className="button button--gradient"
              disabled={stepState === "quoting" || stepState === "paying" || stepState === "confirming"}
              onClick={() => void handleLaunch()}
            >
              {stepState === "idle" || stepState === "error" || stepState === "success"
                ? `Launch ${tokenSymbol || "TOKEN"} × ${selectedPair?.symbol || initialSymbol}`
                : statusMessage || "Launching…"}
            </button>
          )}
          {errorMessage ? <p className="launch-quick-error" role="alert">{errorMessage}</p> : null}
          <p className="launch-quick-note">
            Working path: Pump.fun against {selectedPair?.symbol || "xStock"} · 1.5% creator fee · 1B supply.
            Meteora DBC unlocks after one PoolConfig is set.{" "}
            <Link href={`/launch?symbol=${encodeURIComponent(initialSymbol)}`}>Open full studio</Link>
          </p>
        </section>
      ) : null}

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

      {quickMode && launchReceipt ? (
        <section className="launch-quick-success" aria-live="polite">
          <h2>Launched {tokenSymbol} × {selectedPair?.symbol}</h2>
          <p>Mint <code>{launchReceipt.mintAddress}</code></p>
          <div className="launch-quick-success-actions">
            <a className="button button--gradient" href={launchReceipt.explorerUrl} target="_blank" rel="noreferrer">View tx</a>
            <Link className="button button--light" href={`/app/community?mint=${encodeURIComponent(launchReceipt.mintAddress)}`}>Open on desk</Link>
            <button type="button" className="button button--light" onClick={() => setShowShareModal(true)}>Share to X</button>
          </div>
        </section>
      ) : null}

      {/* Two-Column Studio Layout — full config (hidden in one-tap mode) */}
      {!quickMode ? (
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
              const change = pairStats.change24h;
              const isUp = change === null || change === undefined ? true : change >= 0;
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
                    <span className={`launch-selected-pair-stat ${change === null || change === undefined ? "" : isUp ? "is-up" : "is-down"}`}>
                      {change === null || change === undefined ? "24h —" : `${isUp ? "+" : ""}${change.toFixed(2)}% (24h)`}
                    </span>
                    <span className="launch-selected-pair-badge">
                      <span className="launch-pulse-dot" /> Verified stock
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Pair availability against the selected xStock */}
            {selectedPair && (
              <div className="launch-badge-section">
                {quoteBadgeStatus === "checking" ? (
                  <div className="launch-badge-checking">
                    <span className="launch-pulse-dot" /> Checking pair availability...
                  </div>
                ) : quoteBadgeStatus === "badged" ? (
                  <div className="launch-badge-card is-verified">
                    <span className="launch-badge-pill is-verified">
                      ✓ Ready to pair
                    </span>
                    <span className="launch-badge-note">
                      {selectedPair.symbol} is ready for pair creation on Pump.fun and Meteora DBC.
                    </span>
                  </div>
                ) : (
                  <div className="launch-badge-card is-unbadged">
                    <div className="launch-badge-row">
                      <span className="launch-badge-pill is-unbadged">
                        {selectedPair.symbol} is not badged on Meteora DBC yet
                      </span>
                    </div>
                    <p className="launch-badge-note">
                      Launch against this stock on Pump.fun, or pick a badged xStock for Meteora. OpenStock does not pair against SOL or USDC.
                    </p>
                    <button
                      type="button"
                      className="launch-badge-reset-btn"
                      onClick={() => setSelectedVenue("pumpfun")}
                    >
                      Launch {selectedPair.symbol} on Pump.fun
                    </button>
                  </div>
                )}
              </div>
            )}

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
                    const change = stats.change24h;
                    const isUp = change === null || change === undefined ? true : change >= 0;
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
                            <span className={`launch-pair-stat-tag ${change === null || change === undefined ? "" : isUp ? "is-up" : "is-down"}`}>
                              {change === null || change === undefined ? "—" : `${isUp ? "+" : ""}${change.toFixed(1)}%`}
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
                  {/* Pump Venue Option */}
                  {venueSupport.pumpfun ? (
                    <button
                      type="button"
                      className={`launch-venue-card ${selectedVenue === "pumpfun" ? "is-selected" : ""}`}
                      onClick={() => setSelectedVenue("pumpfun")}
                      role="radio"
                      aria-checked={selectedVenue === "pumpfun"}
                    >
                      <div className="launch-venue-head">
                        <span className="launch-venue-title">Pump</span>
                        <span className="launch-venue-badge">Instant</span>
                      </div>
                      <p className="launch-venue-desc">
                        Pairs against {selectedPair?.symbol || "xStock"}. Moves to full pool upon reaching target.
                      </p>
                      <div className="launch-venue-foot">
                        <span>75% Creator Fee</span>
                        <div className="launch-venue-radio">
                          <span className="launch-venue-radio-dot" />
                        </div>
                      </div>
                    </button>
                  ) : null}

                  {/* Meteora — selectable only when badge + PoolConfig ready */}
                  {venueSupport.meteora ? (
                    <button
                      type="button"
                      className={`launch-venue-card ${selectedVenue === "meteora" ? "is-selected" : ""}`}
                      onClick={() => setSelectedVenue("meteora")}
                      role="radio"
                      aria-checked={selectedVenue === "meteora"}
                    >
                      <div className="launch-venue-head">
                        <span className="launch-venue-title">Meteora curve</span>
                        <span className="launch-venue-badge" style={{ color: "var(--solana-cyan, #03e1ff)", borderColor: "rgba(3, 225, 255, 0.3)" }}>
                          Full Pool Target
                        </span>
                      </div>
                      <p className="launch-venue-desc">
                        Bonding curve with automatic move to full trading pool upon graduation.
                      </p>
                      <div className="launch-venue-foot">
                        <span>Move to full pool</span>
                        <div className="launch-venue-radio">
                          <span className="launch-venue-radio-dot" />
                        </div>
                      </div>
                    </button>
                  ) : venueSupport.meteoraBadged ? (
                    <div className="launch-venue-card is-disabled" aria-disabled="true">
                      <div className="launch-venue-head">
                        <span className="launch-venue-title">Meteora curve</span>
                        <span className="launch-venue-badge">Needs PoolConfig</span>
                      </div>
                      <p className="launch-venue-desc">
                        This xStock is badged on Meteora, but <code>METEORA_DBC_CONFIG</code> is empty.
                        Use Pump.fun for live launches until you add one Equity Standard PoolConfig (xStock quote).
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Curve Preset Selector - Visible ONLY when selectedVenue === "meteora" */}
                {selectedVenue === "meteora" && (
                  <div className="launch-curve-box">
                    <div className="launch-curve-head">
                      <label className="launch-curve-label">
                        Curve style
                      </label>
                      <span className="launch-curve-badge">
                        Options
                      </span>
                    </div>
                    <div className="launch-curve-cards" role="radiogroup" aria-label="Curve Preset">
                      {(Object.keys(METEORA_DBC_CURVE_PRESETS) as DbcCurvePresetKey[]).map((presetKey) => {
                        const preset = METEORA_DBC_CURVE_PRESETS[presetKey];
                        const isChosen = selectedCurvePreset === presetKey;
                        return (
                          <button
                            type="button"
                            key={presetKey}
                            className={`launch-curve-card ${isChosen ? "is-selected" : ""}`}
                            onClick={() => setSelectedCurvePreset(presetKey)}
                            role="radio"
                            aria-checked={isChosen}
                          >
                            <div className="launch-curve-card-top">
                              <span className="launch-curve-name">{preset.name}</span>
                              <span className="launch-curve-pill">{preset.curveType}</span>
                            </div>
                            <span className="launch-curve-subtitle">{preset.subtitle}</span>
                            <p className="launch-curve-desc">{preset.description}</p>
                            <div className="launch-curve-meta">
                              <span>Fee: {(preset.baseFeeBps / 100).toFixed(1)}%</span>
                              <span>Target: {preset.targetMarketCap}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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

            {/* Step 04: Deployer Initial Buy (Dev Buy) */}
            {selectedVenue === "pumpfun" && (
              <section className="launch-devbuy-container" aria-label="Deployer Initial Buy">
                <div className="launch-devbuy-header">
                  <div className="launch-step-pill">04</div>
                  <div>
                    <h2>Deployer Initial Buy</h2>
                    <p>Buy a percentage of your token in the same genesis transaction — before anyone else can snipe.</p>
                  </div>
                  {devBuyPercent > 0 && (
                    <span className="launch-devbuy-antilabel">
                      🛡️ Sniper-proof
                    </span>
                  )}
                </div>

                {/* Percent Preset Buttons */}
                <div className="launch-devbuy-presets">
                  {[0, 1, 2, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`launch-devbuy-preset-btn ${devBuyPercent === pct ? "is-active" : ""}`}
                      onClick={() => handleDevBuyPercentSelect(pct)}
                    >
                      {pct === 0 ? "Skip" : `${pct}%`}
                    </button>
                  ))}
                </div>

                {/* SOL Input + Live Readout */}
                <div className="launch-devbuy-inputs-grid">
                  <div className="launch-devbuy-input-wrap">
                    <label htmlFor="dev-buy-sol" className="launch-devbuy-input-label">Genesis buy (SOL gas, not quote)</label>
                    <div className="launch-input-with-suffix">
                      <input
                        id="dev-buy-sol"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={devBuySolInput === "0" ? "" : devBuySolInput}
                        onChange={(e) => handleDevBuySolChange(e.target.value)}
                        className="launch-devbuy-sol-input"
                      />
                      <span className="launch-input-suffix">SOL</span>
                    </div>
                  </div>

                  <div className="launch-devbuy-input-wrap">
                    <label className="launch-devbuy-input-label">Supply %</label>
                    <div className="launch-input-with-suffix">
                      <input
                        type="number"
                        readOnly
                        value={devBuyPercent > 0 ? devBuyPercent.toFixed(2) : ""}
                        placeholder="0.00"
                        className="launch-devbuy-pct-input"
                      />
                      <span className="launch-input-suffix">%</span>
                    </div>
                  </div>
                </div>

                {/* Summary Card */}
                {devBuyPercent > 0 && (
                  <div className="launch-devbuy-summary-card">
                    <div className="launch-devbuy-summary-row">
                      <span>You receive</span>
                      <strong>≈ {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(estimateTokensForSol(Number(devBuySolInput)))} {tokenSymbol || "TOKEN"}</strong>
                    </div>
                    <div className="launch-devbuy-summary-row">
                      <span>Supply share</span>
                      <strong>{devBuyPercent.toFixed(2)}% of {new Intl.NumberFormat("en-US", { notation: "compact" }).format(tokenSupply)}</strong>
                    </div>
                    <div className="launch-devbuy-summary-row">
                      <span>Extra SOL cost</span>
                      <strong>+{Number(devBuySolInput).toFixed(3)} SOL</strong>
                    </div>
                    <p className="launch-devbuy-note">
                      Atomic genesis buy — tokens sent directly to your wallet in the same block as token creation.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Launch Execution Console (Naturally placed at the bottom of the multi-step form) */}
            <div className="launch-action-bar">
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

              {/* Priority Speed Selector */}
              <div className="launch-priority-box">
                <div className="launch-priority-head">
                  <span className="launch-priority-title">
                    <span>⚡</span> Transaction Speed
                  </span>
                  <span className="launch-priority-badge">
                    Auto-tuned
                  </span>
                </div>
                <div className="launch-priority-pills" role="radiogroup" aria-label="Transaction Speed">
                  {[
                    { id: "standard" as const, label: "Normal", desc: "Standard", note: "Standard speed" },
                    { id: "fast" as const, label: "Fast", desc: "High priority", note: "Fast confirmation" },
                    { id: "turbo" as const, label: "Instant", desc: "Maximum priority", note: "Instant confirmation" },
                  ].map((tier) => (
                    <button
                      type="button"
                      key={tier.id}
                      className={`launch-priority-pill ${priorityTier === tier.id ? "is-active" : ""}`}
                      onClick={() => setPriorityTier(tier.id)}
                      role="radio"
                      aria-checked={priorityTier === tier.id}
                    >
                      <strong>{tier.label}</strong>
                      <span>{tier.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch CTA Button */}
              <button
                type="button"
                className="launch-execute-btn"
                disabled={
                  stepState === "quoting" ||
                  stepState === "paying" ||
                  stepState === "confirming" ||
                  (selectedVenue === "meteora" && quoteBadgeStatus === "unbadged")
                }
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
                ) : selectedVenue === "meteora" && quoteBadgeStatus === "unbadged" ? (
                  "This xStock is not on Meteora DBC yet"
                ) : (
                  <>
                    Launch {tokenSymbol || "TOKEN"} × {effectiveQuoteSymbol || "xStock"}
                  </>
                )}
              </button>

              <p className="launch-checkout-disclaimer">
                Estimated cost: ~0.02 SOL platform fee
                {devBuyPercent > 0 && selectedVenue === "pumpfun" ? (
                  <> + {Number(devBuySolInput).toFixed(3)} SOL initial buy = <strong>{(0.02 + Number(devBuySolInput)).toFixed(3)} SOL total</strong></>
                ) : (
                  <> · Wallet signs and pays directly on OpenStock</>
                )}
              </p>

              {/* Success Receipt Card */}
              {launchReceipt && (
                <div className="launch-success-card" role="status">
                  <div className="launch-success-title">
                    <span style={{ fontSize: 20 }}>🎉</span>
                    <h3>{tokenName || "Token"} is Live!</h3>
                  </div>
                  <p>
                    Your token is live and trading against {selectedPair?.symbol} on {launchReceipt.venue === "pumpfun" ? "Pump" : "Meteora curve"}.
                  </p>
                  <div className="launch-receipt-grid">
                    <div className="launch-receipt-item">
                      <span>Market Pairing</span>
                      <strong>{tokenSymbol} × {selectedPair?.symbol}</strong>
                    </div>
                    <div className="launch-receipt-item">
                      <span>Status</span>
                      <strong style={{ color: "var(--solana-green, #14f195)" }}>
                        Live
                      </strong>
                    </div>
                  </div>
                  <div className="launch-success-actions">
                    <a href={launchReceipt.explorerUrl} target="_blank" rel="noreferrer" className="launch-btn-solscan">
                      View transaction ↗
                    </a>
                    <Link href={`/app/asset/${selectedPair?.symbol}`} className="launch-btn-market">
                      View market ↗
                    </Link>
                    <button
                      type="button"
                      className="launch-btn-share-x"
                      onClick={() => setShowShareModal(true)}
                    >
                      <span>Share</span>
                      <span>🚀</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Sticky 3D Holographic Token Simulator (Clean, Focused & Perfectly Sized) */}
        <div className="launch-stage-column">
          <div className="launch-stage-sticky">
            <div className="launch-holo-card" ref={holoCardRef}>
              <div className="launch-holo-aura" aria-hidden="true" />

              <div className="launch-holo-header">
                <span className="launch-holo-live-tag">
                  <span className="launch-pulse-dot" /> LIVE SIMULATOR
                </span>
                <span className="launch-holo-chain">
                  {selectedVenue === "pumpfun" ? "Pump curve" : "Meteora curve"}
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
                  <span className="launch-holo-stock-symbol">{effectiveQuoteSymbol || selectedPair?.symbol || "xStock"}</span>
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
                    {selectedVenue === "pumpfun" ? "Pump" : "Meteora curve"}
                  </strong>
                </div>
                {selectedVenue === "meteora" && (
                  <div className="launch-holo-spec-row">
                    <span>Curve Preset</span>
                    <strong style={{ color: "var(--solana-green, #14f195)" }}>
                      {METEORA_DBC_CURVE_PRESETS[selectedCurvePreset]?.name || "Standard"}
                    </strong>
                  </div>
                )}
                <div className="launch-holo-spec-row">
                  <span>Total Supply</span>
                  <strong className="launch-holo-highlight">
                    {new Intl.NumberFormat("en-US").format(tokenSupply)}
                  </strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Quote Asset</span>
                  <strong>
                    {selectedPair
                      ? `${selectedPair.name.replace(/ xStock$/, "")} (${selectedPair.symbol})`
                      : "Stock"}
                  </strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Creator Royalty</span>
                  <strong className="launch-holo-highlight">
                    {(creatorFeeBps / 100).toFixed(1)}% in {effectiveQuoteSymbol || selectedPair?.symbol}
                  </strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Liquidity Target</span>
                  <strong>Full Trading Pool</strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Settlement</span>
                  <strong>Instant on Solana</strong>
                </div>
                {selectedVenue === "pumpfun" && devBuyPercent > 0 && (
                  <div className="launch-holo-spec-row" style={{ borderTop: "1px solid rgba(153,69,255,0.25)", marginTop: 4, paddingTop: 8 }}>
                    <span>Deployer Buy</span>
                    <strong className="launch-holo-highlight" style={{ color: "var(--solana-green, #14f195)" }}>
                      {devBuyPercent.toFixed(1)}% · {Number(devBuySolInput).toFixed(3)} SOL
                    </strong>
                  </div>
                )}
              </div>

              <div className="launch-holo-footer-note">
                Direct liquidity settled in {effectiveQuoteSymbol || selectedPair?.symbol || "AAPLx"} on Solana
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {/* Feature #3: Viral Share to X Modal */}
      {showShareModal && launchReceipt && (
        <ShareToXModal
          token={{
            name: tokenName || "Community Token",
            symbol: tokenSymbol || "TOKEN",
            pairedStockSymbol: selectedPair?.symbol || "AAPLx",
            creatorFeeBps,
            venue: launchReceipt.venue,
            mintAddress: launchReceipt.mintAddress,
            txHash: launchReceipt.txHash,
            imageUrl,
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}
      <WalletSelectModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </div>
  );
}
