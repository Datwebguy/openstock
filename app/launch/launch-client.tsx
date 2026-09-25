"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
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
import { browserConnection, waitForSignature } from "@/lib/client-rpc";

type DbcConfigSummary = {
  quoteDecimals: number;
  migrationThresholdUi: number;
  baseFeeBps: number;
  dynamicFee: boolean;
  creatorTradingFeePercent: number;
  migrationTarget: string;
};

/** A Pump.fun payment that landed but whose launch step has not completed — retried without paying again. */
type PendingPumpLaunch = {
  txSignature: string;
  preflightToken: string;
  agentId: string;
  agentName: string;
  body: Record<string, unknown>;
  savedAt: string;
};
const PENDING_KEY = "openstock:pending-pump-launch";

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

  const { address, ready, connecting, canSign, signAnyTransaction } = useWallet();
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

  // Stocks with a Meteora DBC PoolConfig on this deployment (from /api/launch/pairs), and the selected stock's on-chain config.
  const [meteoraReadySymbols, setMeteoraReadySymbols] = useState<Set<string>>(new Set());
  const isMeteoraCompatibleStock = (symbol: string) => meteoraReadySymbols.has(symbol);
  const [dbcConfig, setDbcConfig] = useState<DbcConfigSummary | null>(null);
  const [pumpFeeRange, setPumpFeeRange] = useState({ min: 100, max: 300, default: 100 });
  const [pumpAvailable, setPumpAvailable] = useState(true);
  const [pendingPump, setPendingPump] = useState<PendingPumpLaunch | null>(null);
  const agentRef = useRef<{ id: string; name: string; forName: string } | null>(null);

  // Token-2022 Badge State — launches pair against the selected xStock only
  const [stockBadgeStatus, setStockBadgeStatus] = useState<"checking" | "badged" | "unbadged">("checking");
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

  // Supply & Fee Economics (Fee strictly 0.5%–5%)
  const [tokenSupply, setTokenSupply] = useState<number>(1_000_000_000); // 1 Billion default
  const [customSupplyInput, setCustomSupplyInput] = useState("1,000,000,000");
  const [creatorFeeBps, setCreatorFeeBps] = useState(100); // Pump.fun only; bounds come from ClawPump
  // Meteora creator share is fixed on-chain: base fee × creator percentage of the PoolConfig.
  const meteoraCreatorFeeBps = dbcConfig ? Math.round((dbcConfig.baseFeeBps * dbcConfig.creatorTradingFeePercent) / 100) : null;

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
    registered: boolean;
    registryError?: string | null;
  } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Stats cache for pair cards
  const [pairStatsCache, setPairStatsCache] = useState<Record<string, Awaited<ReturnType<typeof getAssetMarketStats>>>>({});

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
        setMeteoraReadySymbols(new Set<string>(data.meteoraReady ?? []));
        setPumpAvailable(data.source === "clawpump");

        const wanted = initialSymbol.toLowerCase();
        const matched =
          assetList.find((p) => p.symbol.toLowerCase() === wanted || p.underlyingStock?.toLowerCase() === wanted) ||
          assetList[0];
        setSelectedPair(matched || null);

        // Fetch stats for all pairs
        const statsPromises = assetList.map(async (asset) => {
          const stats = await getAssetMarketStats(asset.symbol);
          return { symbol: asset.symbol, stats };
        });
        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, Awaited<ReturnType<typeof getAssetMarketStats>>> = {};
        statsResults.forEach(({ symbol, stats }) => {
          statsMap[symbol] = stats;
        });
        setPairStatsCache(statsMap);
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
      const wanted = initialSymbol.toLowerCase();
      const matched = pairs.find((p) => p.symbol.toLowerCase() === wanted || p.underlyingStock?.toLowerCase() === wanted);
      if (matched) setSelectedPair(matched);
    }
  }, [initialSymbol, pairs]);

  // If Meteora venue is active and selected pair does not support Meteora, fall back to pumpfun
  useEffect(() => {
    if (selectedVenue === "meteora" && pairs.length > 0 && selectedPair) {
      if (!isMeteoraCompatibleStock(selectedPair.symbol)) {
        setSelectedVenue("pumpfun");
      }
    }
  }, [selectedPair, pairs, selectedVenue]);

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
        const res = await fetch(`/api/launch/venues?symbol=${encodeURIComponent(pairSymbol)}&mint=${encodeURIComponent(pairMint)}`);
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
          setDbcConfig(mSupported ? (data.dbcConfig as DbcConfigSummary) : null);
          const range = data.venues?.pumpfun?.creatorFeeRange;
          if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
            setPumpFeeRange(range);
            setCreatorFeeBps((current) => Math.min(range.max, Math.max(range.min, current)));
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
    if (file.size > 1024 * 1024) {
      setErrorMessage("Image file must be under 1MB.");
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setImageUrl(data.url);
      } else {
        // A local data: preview is not a public URL — launch venues need a hosted image.
        setImageUrl("");
        setErrorMessage(data.error || "Artwork upload failed. Try again or paste an https image URL.");
      }
    } catch (err) {
      console.warn("Artwork upload failed:", err);
      setImageUrl("");
      setErrorMessage("Artwork upload failed. Try again or paste an https image URL.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  // Filtered list of pairs based on category tabs, search, and venue support
  const visiblePairs = pairs.filter((p) => {
    // Filter by venue support FIRST (before category and search)
    if (selectedVenue === "meteora") {
      // In Meteora mode, ONLY show stocks that support Meteora DBC (NVDA and Apple)
      if (!isMeteoraCompatibleStock(p.symbol)) return false;
      // If user typed a search query, filter within compatible Meteora stocks; otherwise show both
      if (!pairFilter.trim()) return true;
      const q = pairFilter.toLowerCase();
      return p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    }

    // In Pump mode, apply category tabs and search
    const matchesCat = matchesCategory(p.symbol, selectedCategory);
    if (!matchesCat) return false;
    
    if (!pairFilter.trim()) return true;
    const q = pairFilter.toLowerCase();
    return p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  // Available stocks for current venue (before user category/search filters)
  const availableStocksForVenue = selectedVenue === "meteora"
    ? pairs.filter((p) => isMeteoraCompatibleStock(p.symbol))
    : pairs;
  const isFewStocks = availableStocksForVenue.length < 8 && availableStocksForVenue.length > 0;

  const isMeteoraAvailable = Boolean(selectedPair && isMeteoraCompatibleStock(selectedPair.symbol));

  const cleanTokenSymbol = tokenSymbol.trim()
    ? tokenSymbol.trim().startsWith("$")
      ? tokenSymbol.trim().slice(1).toUpperCase()
      : tokenSymbol.trim().toUpperCase()
    : tokenName.trim()
    ? tokenName.trim().slice(0, 6).toUpperCase()
    : "PAIR";

  const displayStockSymbol = selectedPair?.symbol
    ? selectedPair.symbol.toUpperCase().replace(/X$/, "")
    : "STOCK";

  const speedLabel =
    priorityTier === "turbo"
      ? "Instant speed"
      : priorityTier === "fast"
      ? "Fast speed"
      : "Normal speed";

  // Restore a Pump.fun payment that landed but never finished launching (tab closed, ClawPump error, …).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) setPendingPump(JSON.parse(raw) as PendingPumpLaunch);
    } catch {
      /* ignore */
    }
  }, []);

  function savePending(value: PendingPumpLaunch | null) {
    setPendingPump(value);
    try {
      if (value) localStorage.setItem(PENDING_KEY, JSON.stringify(value));
      else localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  }

  async function finishPumpLaunch(pending: PendingPumpLaunch) {
    setStepState("confirming");
    setErrorMessage("");
    setStatusMessage(`Creating the Pump.fun market against ${String(pending.body.pairedSymbol ?? "the stock")}...`);
    try {
      const confirmRes = await fetch("/api/launch/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pending.body,
          agentId: pending.agentId,
          agentName: pending.agentName,
          txSignature: pending.txSignature,
          preflightToken: pending.preflightToken,
        }),
      });
      const confirmData = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.error || "The launch step failed. Your payment is saved — retry to finish.");
      }
      savePending(null);
      setStepState("success");
      setStatusMessage("Launch successful!");
      setLaunchReceipt({
        mintAddress: confirmData.mintAddress,
        txHash: confirmData.txHash,
        pumpUrl: confirmData.pumpUrl,
        explorerUrl: confirmData.explorerUrl,
        venue: "pumpfun",
        registered: Boolean(confirmData.registered),
        registryError: confirmData.registryError ?? null,
      });
    } catch (err) {
      setStepState("error");
      setErrorMessage(err instanceof Error ? err.message : "The launch step failed. Retry to finish without paying again.");
    }
  }

  async function handleLaunch() {
    if (!address || !canSign) {
      setShowWalletModal(true);
      if (address && !canSign) setErrorMessage("Email and Google sessions cannot sign. Connect a Solana wallet to launch.");
      return;
    }
    if (pendingPump) {
      await finishPumpLaunch(pendingPump);
      return;
    }
    if (!selectedPair || !effectiveQuoteMint) {
      setErrorMessage("Please select a supported xStock market pair.");
      return;
    }
    if (selectedVenue === "meteora" && !venueSupport.meteora) {
      setErrorMessage(`Meteora DBC is not available for ${selectedPair.symbol}. Launch on Pump.fun instead.`);
      return;
    }
    if (selectedVenue === "pumpfun" && !venueSupport.pumpfun) {
      setErrorMessage(`Pump.fun launches against ${selectedPair.symbol} are not available right now.`);
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
    if (!imageUrl.trim() || imageUrl.startsWith("data:")) {
      setErrorMessage("Upload token artwork or paste an https image URL.");
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
    if (selectedVenue === "pumpfun" && (creatorFeeBps < pumpFeeRange.min || creatorFeeBps > pumpFeeRange.max)) {
      setErrorMessage(`Creator fee must be between ${(pumpFeeRange.min / 100).toFixed(1)}% and ${(pumpFeeRange.max / 100).toFixed(1)}%.`);
      return;
    }

    setErrorMessage("");
    const connection = browserConnection();

    if (selectedVenue === "pumpfun") {
      setStepState("quoting");
      setStatusMessage("Getting a launch quote from ClawPump...");

      const launchBody = {
        name: tokenName.trim(),
        symbol: tokenSymbol.trim().toUpperCase(),
        description: resolvedDescription,
        imageUrl: imageUrl.trim(),
        pumpQuoteMint: selectedPair.mint,
        pumpCreatorFeeBps: creatorFeeBps,
        walletAddress: address,
        devBuySol: Number(devBuySolInput) > 0 ? Number(devBuySolInput) : 0,
      };

      try {
        // Reuse the launcher agent from an earlier quote for the same token instead of creating another.
        const reuse = agentRef.current && agentRef.current.forName === launchBody.name ? agentRef.current : null;
        const preflightRes = await fetch("/api/launch/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...launchBody, agentId: reuse?.id, agentName: reuse?.name }),
        });
        const preflightData = await preflightRes.json().catch(() => ({}));
        if (!preflightRes.ok || !preflightData.payment) {
          throw new Error(preflightData.error || "Could not get a launch quote. Try again.");
        }
        const { payment, retryWith, agentId, agentName } = preflightData;
        agentRef.current = { id: agentId, name: agentName, forName: launchBody.name };

        setStepState("paying");
        setStatusMessage(`Preparing payment of ${Number(payment.amountSol).toFixed(4)} SOL to ClawPump...`);

        const fromPubkey = new PublicKey(address);
        const tx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey, toPubkey: new PublicKey(payment.payTo), lamports: payment.amountLamports })
        );
        const microLamports = await getDynamicPriorityFee(connection, priorityTier);
        applyComputeBudget(tx, 160_000, microLamports);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        setStatusMessage("Checking transaction...");
        const sim = await preflightSimulate(connection, tx, fromPubkey);
        if (!sim.success) throw new Error(sim.humanMessage || sim.error || "The payment would fail. Check your SOL balance.");
        if (sim.unitsConsumed) setSimulatedUnits(sim.unitsConsumed);

        setStatusMessage(`Approve the ${Number(payment.amountSol).toFixed(4)} SOL payment in your wallet...`);
        const signed = await signAnyTransaction(tx);
        setStatusMessage("Submitting payment...");
        const txSignature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 3 });

        setStatusMessage("Confirming payment...");
        await waitForSignature(connection, txSignature, { lastValidBlockHeight });

        // Payment landed: persist everything needed to finish the launch without paying twice.
        const pending: PendingPumpLaunch = {
          txSignature,
          preflightToken: retryWith.preflightToken,
          agentId,
          agentName,
          body: { ...launchBody, pairedSymbol: selectedPair.symbol },
          savedAt: new Date().toISOString(),
        };
        savePending(pending);
        await finishPumpLaunch(pending);
      } catch (err: unknown) {
        console.error("Pump.fun launch failed:", err);
        setStepState("error");
        setErrorMessage(translateWalletError(err));
      }
      return;
    }

    // Meteora Dynamic Bonding Curve
    setStepState("quoting");
    setStatusMessage("Building the pool transaction...");
    try {
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
        }),
      });
      const prepareData = await prepareRes.json().catch(() => ({}));
      if (!prepareRes.ok || !prepareData.transactionBase64) {
        throw new Error(prepareData.error || "Failed to prepare the pool. Please try again.");
      }
      const { transactionBase64, mintAddress, poolAddress } = prepareData;

      setStepState("paying");
      setStatusMessage("Checking transaction...");
      const tx = Transaction.from(base64ToUint8Array(transactionBase64));
      const sim = await preflightSimulate(connection, tx, new PublicKey(address));
      if (!sim.success) throw new Error(sim.humanMessage || sim.error || "The pool transaction would fail on-chain.");
      if (sim.unitsConsumed) setSimulatedUnits(sim.unitsConsumed);

      setStatusMessage("Approve the pool creation in your wallet...");
      const signed = await signAnyTransaction(tx);
      setStatusMessage("Submitting transaction...");
      const txSignature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      setStatusMessage("Confirming on Solana...");
      await waitForSignature(connection, txSignature);

      setStepState("confirming");
      setStatusMessage(`Verifying the pool against ${effectiveQuoteSymbol}...`);
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
          txSignature,
          mintAddress,
          poolAddress,
        }),
      });
      const confirmData = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.error || `Pool transaction ${txSignature.slice(0, 8)}… landed but could not be verified yet.`);
      }

      setStepState("success");
      setStatusMessage("Live!");
      setLaunchReceipt({
        mintAddress: confirmData.mintAddress,
        poolAddress: confirmData.poolAddress,
        txHash: confirmData.txHash,
        pumpUrl: confirmData.poolUrl,
        explorerUrl: confirmData.explorerUrl,
        venue: "meteora",
        registered: Boolean(confirmData.registered),
        registryError: confirmData.registryError ?? null,
      });
    } catch (err: unknown) {
      console.error("Meteora launch failed:", err);
      setStepState("error");
      setErrorMessage(translateWalletError(err));
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
              <span>Quote locked · {selectedVenue === "meteora" ? "Meteora DBC" : "Pump.fun"} · {selectedVenue === "meteora" ? (meteoraCreatorFeeBps !== null ? `${(meteoraCreatorFeeBps / 100).toFixed(2)}% creator share (set on-chain)` : "creator share set on-chain") : `${(creatorFeeBps / 100).toFixed(1)}% creator fee`}</span>
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
          {!ready || !address || !canSign ? (
            <button type="button" className="button button--gradient" onClick={() => setShowWalletModal(true)} disabled={connecting}>
              {connecting ? "Connecting…" : address ? "Connect a signing wallet" : "Connect Wallet to launch"}
            </button>
          ) : (
            <button
              type="button"
              className="button button--gradient"
              disabled={stepState === "quoting" || stepState === "paying" || stepState === "confirming"}
              onClick={() => void handleLaunch()}
            >
              {stepState === "idle" || stepState === "error" || stepState === "success"
                ? pendingPump
                  ? "Finish paid launch"
                  : `Launch ${tokenSymbol || "TOKEN"} × ${selectedPair?.symbol || initialSymbol}`
                : statusMessage || "Launching…"}
            </button>
          )}
          {errorMessage ? <p className="launch-quick-error" role="alert">{errorMessage}</p> : null}
          <p className="launch-quick-note">
            {selectedVenue === "meteora" ? "Meteora DBC" : "Pump.fun"} against {selectedPair?.symbol || "xStock"} · {selectedVenue === "meteora" ? (meteoraCreatorFeeBps !== null ? `${(meteoraCreatorFeeBps / 100).toFixed(2)}% creator share (set on-chain)` : "creator share set on-chain") : `${(creatorFeeBps / 100).toFixed(1)}% creator fee`}.
            {pendingPump ? " A paid launch is waiting to finish — press Launch to complete it without paying again." : ""}{" "}
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
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: "none" }}
      />

      {quickMode && launchReceipt ? (
        <section className="launch-quick-success" aria-live="polite">
          <h2>Launched {tokenSymbol} × {selectedPair?.symbol}</h2>
          <p>Mint <code>{launchReceipt.mintAddress}</code></p>
          {!launchReceipt.registered ? <p className="launch-quick-error" role="status">{launchReceipt.registryError || "Live on Solana, but not yet listed on the OpenStock desk."}</p> : null}
          <div className="launch-quick-success-actions">
            <a className="button button--gradient" href={launchReceipt.explorerUrl} target="_blank" rel="noreferrer">View tx</a>
            {launchReceipt.registered ? (
              <Link className="button button--light" href={`/token/${encodeURIComponent(launchReceipt.mintAddress)}`}>Open on desk</Link>
            ) : (
              <a className="button button--light" href={launchReceipt.pumpUrl} target="_blank" rel="noreferrer">Open pool</a>
            )}
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

            {/* Pair availability warning if incompatible stock is selected */}
            {selectedPair && selectedVenue === "meteora" && !isMeteoraCompatibleStock(selectedPair.symbol) && (
              <div className="launch-badge-section">
                <div className="launch-badge-card is-unbadged">
                  <div className="launch-badge-row">
                    <span className="launch-badge-pill is-unbadged">
                      {selectedPair.symbol} not available on Meteora DBC
                    </span>
                  </div>
                  <p className="launch-badge-note">
                    Meteora DBC currently supports NVDA and Apple. Switch to Pump to pair against {selectedPair.symbol}, or select NVDA / Apple below.
                  </p>
                  <button
                    type="button"
                    className="launch-badge-reset-btn"
                    onClick={() => setSelectedVenue("pumpfun")}
                  >
                    Launch {selectedPair.symbol} on Pump
                  </button>
                </div>
              </div>
            )}

            {/* Unified Section Header Row */}
            <div className="launch-curve-header-row">
              <div className="launch-curve-header-left">
                <h3 className="launch-curve-header-title">
                  {selectedVenue === "meteora" ? "Meteora Curve" : "Pump.fun Curve"}
                </h3>
                <p className="launch-curve-header-desc">
                  {selectedVenue === "meteora"
                    ? "Dynamic bonding curve pairing exclusively against verified equities."
                    : "Classic bonding curve pairing natively against verified equities."}
                </p>
              </div>

              {isFewStocks && (
                <div className="launch-curve-segmented-toggle" role="radiogroup" aria-label="Stock quick selector">
                  {availableStocksForVenue.map((stock) => {
                    const isCur = selectedPair?.mint === stock.mint || (Boolean(selectedPair?.symbol) && selectedPair?.symbol.toUpperCase() === stock.symbol.toUpperCase());
                    return (
                      <button
                        key={stock.mint}
                        type="button"
                        role="radio"
                        aria-checked={isCur}
                        className={`launch-curve-segmented-btn ${isCur ? "is-selected" : ""}`}
                        onClick={() => {
                          startTransition(() => {
                            setSelectedPair(stock);
                          });
                        }}
                      >
                        {isCur && <span className="launch-curve-segmented-check" aria-hidden="true">✓</span>}
                        <span>{stock.symbol}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Filter Tabs & Search Toolbar (Auto-hidden when < 8 stocks) */}
            {!isFewStocks && (
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
                    <svg className="launch-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.5" y2="16.5" />
                    </svg>
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
                    {selectedVenue === "meteora"
                      ? `${visiblePairs.length} Meteora stocks (NVDA & Apple)`
                      : `${visiblePairs.length} / ${pairs.length} pairs`}
                  </span>
                </div>
              </div>
            )}

            {/* Two-Column CSS Grid Filling Full Container Width */}
            <div className={`launch-pairs-container ${isFewStocks ? "is-few-stocks" : ""}`}>
              {loadingPairs ? (
                <div className="launch-loading-pairs">
                  <span className="launch-pulse-dot" /> Loading verified stock assets...
                </div>
              ) : (
                <div className="launch-pairs-grid" role="radiogroup" aria-label="Stock assets">
                  {visiblePairs.map((pair) => {
                    const isSelected = selectedPair?.mint === pair.mint || (Boolean(selectedPair?.symbol) && selectedPair?.symbol.toUpperCase() === pair.symbol.toUpperCase());
                    const stats = pairStatsCache[pair.symbol];
                    const change = stats?.change24h;
                    const hasRealChange = typeof change === "number" && Number.isFinite(change);
                    const isUp = hasRealChange ? change >= 0 : true;
                    const priceUsd = stats?.price;
                    const hasRealPrice = typeof priceUsd === "number" && Number.isFinite(priceUsd) && priceUsd > 0;

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
                          <StockLogo symbol={pair.symbol} logo={pair.imageUrl ?? undefined} size={40} />
                          {isSelected ? (
                            <span className="launch-pair-active-dot">
                              <span className="launch-pulse-dot" /> Active
                            </span>
                          ) : hasRealChange ? (
                            <span className={`launch-pair-stat-tag ${isUp ? "is-up" : "is-down"}`}>
                              {isUp ? "+" : ""}{change.toFixed(1)}%
                            </span>
                          ) : hasRealPrice ? (
                            <span className="launch-pair-stat-tag">
                              ${priceUsd < 1 ? priceUsd.toFixed(4) : priceUsd.toFixed(2)}
                            </span>
                          ) : null}
                        </div>

                        <div className="launch-pair-card-bottom">
                          <div className="launch-pair-details">
                            <strong>{pair.symbol}</strong>
                            <span>{pair.name.replace(/ xStock$/, "")}</span>
                          </div>
                          {isSelected ? (
                            <div className="launch-pair-check-icon" aria-hidden="true">✓</div>
                          ) : (
                            <span className="launch-pair-select-btn">Select</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Step 03: Venue & Economics (Single Column, Unified Spacing & Selection) */}
          <section className="launch-panel launch-step-3-panel" aria-labelledby="step-3-heading">
            <div className="launch-step-header-clean">
              <div className="launch-step-pill">03</div>
              <div className="launch-step-title-group">
                <h2 id="step-3-heading">Venue &amp; Economics</h2>
                <p>Select your execution venue and configure supply &amp; creator fee.</p>
              </div>
            </div>

            <div className="launch-step-3-single-col">
              {/* 1. Execution Venue */}
              <div className="launch-section">
                <div className="launch-section-header">
                  <label className="launch-section-label">
                    Execution Venue {loadingVenues ? "(Verifying...)" : ""}
                  </label>
                  <span className="launch-section-hint">Choose where your token bonding curve launches</span>
                </div>

                <div className="launch-venue-grid-2col" role="radiogroup" aria-label="Execution Venue">
                  {/* Pump Venue Option */}
                  <button
                    type="button"
                    className={`launch-venue-card ${selectedVenue === "pumpfun" ? "is-selected" : ""} ${!venueSupport.pumpfun ? "is-disabled" : ""}`}
                    disabled={!venueSupport.pumpfun}
                    aria-disabled={!venueSupport.pumpfun}
                    onClick={() => {
                      if (!venueSupport.pumpfun) return;
                      setSelectedVenue("pumpfun");
                      setSelectedCategory("all");
                    }}
                    role="radio"
                    aria-checked={selectedVenue === "pumpfun"}
                  >
                    <div className="launch-venue-card-header">
                      <div className="launch-venue-card-title-wrap">
                        <span className="launch-venue-card-title">Pump</span>
                        <span className="launch-venue-card-badge">Instant</span>
                      </div>
                      {selectedVenue === "pumpfun" && (
                        <span className="launch-card-check" aria-hidden="true">✓</span>
                      )}
                    </div>
                    <p className="launch-venue-card-desc">
                      Pump.fun bonding curve quoted in the selected xStock, via ClawPump.
                    </p>
                    <div className="launch-venue-card-foot">
                      <span>
                        {!pumpAvailable
                          ? "ClawPump is unreachable right now"
                          : venueSupport.pumpfun
                          ? `Creator fee ${(pumpFeeRange.min / 100).toFixed(1)}%–${(pumpFeeRange.max / 100).toFixed(1)}%`
                          : `ClawPump does not list ${selectedPair?.symbol ?? "this stock"}`}
                      </span>
                    </div>
                  </button>

                  {/* Meteora Curve Venue Option */}
                  <button
                    type="button"
                    className={`launch-venue-card ${selectedVenue === "meteora" ? "is-selected" : ""} ${!isMeteoraAvailable ? "is-disabled" : ""}`}
                    disabled={!isMeteoraAvailable}
                    aria-disabled={!isMeteoraAvailable}
                    onClick={() => {
                      if (!isMeteoraAvailable) return;
                      setSelectedVenue("meteora");
                      setSelectedCategory("all");
                      setPairFilter("");
                    }}
                    role="radio"
                    aria-checked={selectedVenue === "meteora"}
                  >
                    <div className="launch-venue-card-header">
                      <div className="launch-venue-card-title-wrap">
                        <span className="launch-venue-card-title">Meteora curve</span>
                        <span className="launch-venue-card-badge">Dynamic Curve</span>
                      </div>
                      {selectedVenue === "meteora" && (
                        <span className="launch-card-check" aria-hidden="true">✓</span>
                      )}
                    </div>
                    <p className="launch-venue-card-desc">
                      Meteora Dynamic Bonding Curve quoted in the selected xStock; migrates to a Meteora pool when filled.
                    </p>
                    <div className="launch-venue-card-foot">
                      {isMeteoraAvailable ? (
                        <span>
                          {dbcConfig
                            ? `Migrates after ${dbcConfig.migrationThresholdUi} ${selectedPair?.symbol} raised`
                            : "Reading on-chain config…"}
                        </span>
                      ) : (
                        <span className="launch-venue-card-note">
                          Available for {[...meteoraReadySymbols].join(", ") || "no stocks yet"} on this deployment.
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. On-chain curve terms (Meteora only) — read from the PoolConfig account, not chosen here */}
              {selectedVenue === "meteora" && (
                <div className="launch-section">
                  <div className="launch-section-header">
                    <label className="launch-section-label">Curve terms (on-chain)</label>
                    <span className="launch-section-hint">Fixed by the Meteora PoolConfig for {selectedPair?.symbol}</span>
                  </div>
                  {dbcConfig ? (
                    <div className="launch-fee-live-banner">
                      Curve fee: <strong>{(dbcConfig.baseFeeBps / 100).toFixed(2)}%{dbcConfig.dynamicFee ? " + dynamic" : ""}</strong>
                      <span className="launch-fee-live-sep">·</span>
                      <span>Creator share: <strong>{dbcConfig.creatorTradingFeePercent}% of fees</strong></span>
                      <span className="launch-fee-live-sep">·</span>
                      <span>Migrates to {dbcConfig.migrationTarget} after <strong>{dbcConfig.migrationThresholdUi} {selectedPair?.symbol}</strong> is raised</span>
                    </div>
                  ) : (
                    <div className="launch-fee-live-banner">Reading the pool config from Solana…</div>
                  )}
                </div>
              )}

              {/* 3. Total Supply (Pump only — Meteora supply is defined by the PoolConfig) */}
              {selectedVenue === "pumpfun" && (
              <div className="launch-section">
                <div className="launch-section-header">
                  <label htmlFor="token-supply" className="launch-section-label">Total Supply</label>
                  <span className="launch-section-hint">Total mint quantity created at genesis</span>
                </div>

                <div className="launch-supply-controls">
                  <div className="launch-preset-chips" role="group" aria-label="Supply presets">
                    {[
                      { label: "100M", val: 100_000_000 },
                      { label: "500M", val: 500_000_000 },
                      { label: "1B", val: 1_000_000_000 },
                      { label: "10B", val: 10_000_000_000 },
                    ].map((tier) => {
                      const isTierSelected = tokenSupply === tier.val;
                      return (
                        <button
                          type="button"
                          key={tier.val}
                          className={`launch-preset-chip ${isTierSelected ? "is-selected" : ""}`}
                          onClick={() => handleSupplySelect(tier.val)}
                        >
                          <span>{tier.label}</span>
                          {isTierSelected && <span className="launch-chip-check" aria-hidden="true">✓</span>}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    id="token-supply"
                    type="text"
                    placeholder="1,000,000,000"
                    value={customSupplyInput}
                    onChange={(e) => handleCustomSupplyChange(e.target.value)}
                    className="launch-supply-input-formatted"
                  />
                </div>
              </div>

              )}

              {/* 4. Creator Fee (Pump only — Meteora's creator share is fixed on-chain) */}
              {selectedVenue === "pumpfun" && (
              <div className="launch-section">
                <div className="launch-section-header">
                  <label className="launch-section-label">
                    Creator Fee
                  </label>
                  <span className="launch-section-hint">Per-trade royalty on secondary market volume</span>
                </div>

                <div className="launch-fee-live-banner">
                  Creator fee: <strong>{(creatorFeeBps / 100).toFixed(2)}% per trade</strong>
                  <span className="launch-fee-live-sep">·</span>
                  <span>Pump.fun protocol fees apply on top</span>
                </div>

                <div className="launch-fee-chips" role="radiogroup" aria-label="Creator fee presets">
                  {[50, 100, 150, 200, 250, 300, 400, 500]
                    .filter((bps) => bps >= pumpFeeRange.min && bps <= pumpFeeRange.max)
                    .map((bps) => ({ label: `${(bps / 100).toFixed(1)}%`, bps }))
                    .map((tier) => {
                    const isFeeActive = creatorFeeBps === tier.bps;
                    return (
                      <button
                        type="button"
                        key={tier.bps}
                        className={`launch-fee-chip ${isFeeActive ? "is-selected" : ""}`}
                        onClick={() => setCreatorFeeBps(tier.bps)}
                        role="radio"
                        aria-checked={isFeeActive}
                      >
                        <span>{tier.label}</span>
                        {isFeeActive && <span className="launch-chip-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {/* 5. Deployer Initial Buy (Dev Buy, Pump Only) */}
              {selectedVenue === "pumpfun" && (
                <div className="launch-section launch-devbuy-section">
                  <div className="launch-section-header">
                    <div className="launch-section-title-wrap">
                      <label className="launch-section-label">Deployer Initial Buy</label>
                      <span className="launch-devbuy-badge">Anti-Snipe Protection</span>
                    </div>
                    <span className="launch-section-hint">
                      Buy a percentage of your token in the same genesis transaction before anyone else
                    </span>
                  </div>

                  <div className="launch-preset-chips" role="group" aria-label="Genesis buy preset">
                    {[0, 1, 2, 5, 10, 15, 20].map((pct) => {
                      const isPctActive = devBuyPercent === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          className={`launch-preset-chip ${isPctActive ? "is-selected" : ""}`}
                          onClick={() => handleDevBuyPercentSelect(pct)}
                        >
                          <span>{pct === 0 ? "Skip" : `${pct}%`}</span>
                          {isPctActive && <span className="launch-chip-check" aria-hidden="true">✓</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="launch-devbuy-inputs-grid">
                    <div className="launch-devbuy-input-wrap">
                      <label htmlFor="dev-buy-sol" className="launch-devbuy-input-label">
                        Genesis buy (SOL gas, not quote)
                      </label>
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

                  {devBuyPercent > 0 && (
                    <div className="launch-devbuy-summary-card">
                      <div className="launch-devbuy-summary-row">
                        <span>You receive</span>
                        <strong>
                          ≈ {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(estimateTokensForSol(Number(devBuySolInput)))} ${cleanTokenSymbol}
                        </strong>
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
                </div>
              )}

              {/* 6. Advanced Settings (Transaction Speed) */}
              <div className="launch-section">
                <button
                  type="button"
                  className="launch-advanced-toggle-btn"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  aria-expanded={showAdvanced}
                >
                  <span className="launch-advanced-toggle-text">Advanced: {speedLabel}</span>
                  <svg
                    className={`launch-advanced-toggle-icon ${showAdvanced ? "is-open" : ""}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showAdvanced && (
                  <div className="launch-advanced-panel">
                    <div className="launch-section-header" style={{ marginBottom: 12 }}>
                      <label className="launch-section-label">Transaction Speed</label>
                      <span className="launch-section-hint">Priority fee tier for rapid Solana block confirmation</span>
                    </div>

                    <div className="launch-priority-pills" role="radiogroup" aria-label="Transaction Speed">
                      {[
                        { id: "standard" as const, label: "Normal", desc: "Standard priority" },
                        { id: "fast" as const, label: "Fast", desc: "High priority" },
                        { id: "turbo" as const, label: "Instant", desc: "Maximum priority" },
                      ].map((tier) => {
                        const isTierActive = priorityTier === tier.id;
                        return (
                          <button
                            type="button"
                            key={tier.id}
                            className={`launch-priority-pill ${isTierActive ? "is-active" : ""}`}
                            onClick={() => setPriorityTier(tier.id)}
                            role="radio"
                            aria-checked={isTierActive}
                          >
                            <div className="launch-priority-pill-copy">
                              <strong>{tier.label}</strong>
                              <span>{tier.desc}</span>
                            </div>
                            {isTierActive && <span className="launch-chip-check" aria-hidden="true">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. Summary & Launch Action */}
              <div className="launch-section launch-action-section">
                {/* Summary Card */}
                <div className="launch-summary-card" aria-label="Launch Summary">
                  <div className="launch-summary-row">
                    <span>Pair</span>
                    <strong>${cleanTokenSymbol} × {displayStockSymbol}</strong>
                  </div>
                  <div className="launch-summary-row">
                    <span>Venue</span>
                    <strong>{selectedVenue === "pumpfun" ? "Pump" : "Meteora curve"}</strong>
                  </div>
                  {selectedVenue === "pumpfun" && (
                    <div className="launch-summary-row">
                      <span>Total supply</span>
                      <strong>{new Intl.NumberFormat("en-US").format(tokenSupply)}</strong>
                    </div>
                  )}
                  <div className="launch-summary-row">
                    <span>Creator fee</span>
                    <strong>{selectedVenue === "meteora" ? (meteoraCreatorFeeBps !== null ? `${(meteoraCreatorFeeBps / 100).toFixed(2)}% creator share (set on-chain)` : "creator share set on-chain") : `${(creatorFeeBps / 100).toFixed(1)}% creator fee`}</strong>
                  </div>
                  <div className="launch-summary-row">
                    <span>You pay</span>
                    <strong>
                      {selectedVenue === "pumpfun" ? "ClawPump launch quote (shown before you sign)" : "Network fees + account rent"}
                      {devBuyPercent > 0 && selectedVenue === "pumpfun" ? (
                        <> + {Number(devBuySolInput).toFixed(3)} SOL dev buy</>
                      ) : null}
                    </strong>
                  </div>
                  <div className="launch-summary-row">
                    <span>Signing wallet</span>
                    <strong>{address ? shortWallet(address) : "Wallet not connected"}</strong>
                  </div>
                </div>

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

                {/* Launch CTA Button */}
                <button
                  type="button"
                  className="launch-execute-btn"
                  disabled={
                    stepState === "quoting" ||
                    stepState === "paying" ||
                    stepState === "confirming" ||
                    (selectedVenue === "meteora" && !venueSupport.meteora) ||
                    (selectedVenue === "pumpfun" && !venueSupport.pumpfun)
                  }
                  onClick={handleLaunch}
                >
                  {!address ? (
                    "Connect Wallet to Launch"
                  ) : !canSign ? (
                    "Connect a signing wallet"
                  ) : pendingPump && stepState !== "quoting" && stepState !== "paying" && stepState !== "confirming" ? (
                    "Finish paid launch"
                  ) : stepState === "quoting" ? (
                    "Calculating Terms..."
                  ) : stepState === "paying" ? (
                    "Approve in Wallet..."
                  ) : stepState === "confirming" ? (
                    "Creating Market on Solana..."
                  ) : selectedVenue === "meteora" && !venueSupport.meteora ? (
                    `Meteora DBC is not available for ${selectedPair?.symbol ?? "this stock"}`
                  ) : selectedVenue === "pumpfun" && !venueSupport.pumpfun ? (
                    `Pump.fun is not available for ${selectedPair?.symbol ?? "this stock"}`
                  ) : (
                    `Launch $${cleanTokenSymbol} × ${displayStockSymbol}`
                  )}
                </button>

                <p className="launch-checkout-disclaimer">
                  Wallet signs and pays directly on OpenStock
                </p>

                {/* Success Receipt Card */}
                {launchReceipt && (
                  <div className="launch-success-card" role="status">
                    <div className="launch-success-title">
                      <span className="launch-success-badge-icon" aria-hidden="true">✓</span>
                      <h3>{tokenName || "Token"} is Live!</h3>
                    </div>
                    <p>
                      Your token is live and trading against {selectedPair?.symbol} on {launchReceipt.venue === "pumpfun" ? "Pump.fun" : "Meteora DBC"}.
                    </p>
                    {!launchReceipt.registered ? (
                      <p role="status">{launchReceipt.registryError || "It is not listed on the OpenStock desk yet."}</p>
                    ) : null}
                    <div className="launch-receipt-grid">
                      <div className="launch-receipt-item">
                        <span>Market Pairing</span>
                        <strong>${cleanTokenSymbol} × {selectedPair?.symbol}</strong>
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
                      {launchReceipt.registered ? (
                        <Link href={`/token/${encodeURIComponent(launchReceipt.mintAddress)}`} className="launch-btn-market">
                          Open on desk ↗
                        </Link>
                      ) : (
                        <a href={launchReceipt.pumpUrl} target="_blank" rel="noreferrer" className="launch-btn-market">
                          Open pool ↗
                        </a>
                      )}
                      <button
                        type="button"
                        className="launch-btn-share-x"
                        onClick={() => setShowShareModal(true)}
                      >
                        <span>Share to X</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                    {selectedVenue === "meteora" ? (meteoraCreatorFeeBps !== null ? `${(meteoraCreatorFeeBps / 100).toFixed(2)}%` : "On-chain") : `${(creatorFeeBps / 100).toFixed(1)}%`} in {effectiveQuoteSymbol || selectedPair?.symbol}
                  </strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Graduation</span>
                  <strong>{selectedVenue === "meteora" ? (dbcConfig ? `${dbcConfig.migrationThresholdUi} ${selectedPair?.symbol} raised` : "On-chain") : "Pump.fun curve completes"}</strong>
                </div>
                <div className="launch-holo-spec-row">
                  <span>Settlement</span>
                  <strong>Solana mainnet</strong>
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
            creatorFeeBps: launchReceipt.venue === "meteora" ? meteoraCreatorFeeBps ?? 0 : creatorFeeBps,
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
