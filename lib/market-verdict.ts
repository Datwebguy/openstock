export type MarketVerdictTone = "healthy" | "caution" | "blocked" | "refreshing";
export type MarketVerdict = {
  tone: MarketVerdictTone;
  label: string;
  headline: string;
  copy: string;
  action: string;
  /** When true, order entry should refuse live/paper submit until resolved. */
  hardBlock: boolean;
  checks: Array<{ label: string; value: string; tone: "good" | "warn" | "pending" }>;
};

type AssetLike = {
  symbol: string;
  price?: number | null;
  multiplier?: { currentMultiplier?: number | null; newMultiplier?: number | null } | null;
  isTradingHalted?: boolean;
  trading?: { isTradingHalted?: boolean; currentPeriod?: string | null; openNow?: boolean } | null;
};

type EvidenceLike = {
  jupiter?: { data?: { executablePrice?: number | null; priceImpactPct?: number | null; fetchedAt?: string | null } | null; state?: string };
  pyth?: { data?: { price?: number | null; freshnessSeconds?: number | null; deviationPct?: number | null } | null; state?: string };
  meteora?: { data?: Array<{ tvl?: number | null; priceUsd?: number | null; volume24h?: number | null; feePct?: number | null; address?: string } | null> | null; state?: string };
  reserves?: { data?: { sharesHeld?: string | number | null; circulatingSupply?: string | number | null; timestamp?: string | null } | null; state?: string };
  tokenDecimals?: { data?: number | null; state?: string };
};

/** Soft caution when pool TVL is below this (USD). */
const THIN_TVL_USD = 10_000;
/** Hard block when oracle vs pool/executable disagree by more than this %. */
const DISAGREE_HARD_PCT = 5;
/** Soft warning when disagreement exceeds this %. */
const DISAGREE_SOFT_PCT = 2.5;
/** Soft warning when Pyth freshness older than this (seconds). */
const STALE_ORACLE_SOFT_SEC = 300;
/** Soft warning when Jupiter quote older than this (ms). */
const STALE_QUOTE_SOFT_MS = 60_000;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function pctDiff(a: number, b: number): number {
  const base = Math.max(a, b);
  if (base <= 0) return 0;
  return (Math.abs(a - b) / base) * 100;
}

export function getMarketVerdict(asset: AssetLike, evidence: EvidenceLike): MarketVerdict {
  const symbol = asset.symbol.replace(/x$/, "").toUpperCase();
  const halted = Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted);
  const reference = finite(asset.price) ? asset.price : null;
  const multiplier = asset.multiplier?.currentMultiplier;
  const hasMultiplier = finite(multiplier);
  const decimals = evidence.tokenDecimals?.data;
  const hasDecimals = typeof decimals === "number" && Number.isInteger(decimals) && decimals >= 0;
  const executableQuote = finite(evidence.jupiter?.data?.executablePrice) ? evidence.jupiter!.data!.executablePrice! : null;
  const pool = evidence.meteora?.data?.find((item) => item && finite(item.priceUsd)) ?? evidence.meteora?.data?.[0] ?? null;
  const poolQuote = pool && finite(pool.priceUsd) ? pool.priceUsd! : null;
  const onchainQuote = executableQuote ?? poolQuote;
  const oracle = finite(evidence.pyth?.data?.price) ? evidence.pyth!.data!.price! : null;
  const tvl = pool && finite(pool.tvl) ? pool.tvl! : null;
  const impact = finite(evidence.jupiter?.data?.priceImpactPct) ? evidence.jupiter!.data!.priceImpactPct! : null;
  const freshness = evidence.pyth?.data?.freshnessSeconds;
  const quoteFetchedAt = evidence.jupiter?.data?.fetchedAt ? Date.parse(evidence.jupiter.data.fetchedAt) : NaN;
  const quoteAgeMs = Number.isFinite(quoteFetchedAt) ? Date.now() - quoteFetchedAt : null;
  const issuerOpen = asset.trading?.openNow === true;
  const pendingMultiplier =
    finite(asset.multiplier?.newMultiplier) &&
    finite(asset.multiplier?.currentMultiplier) &&
    asset.multiplier!.newMultiplier !== asset.multiplier!.currentMultiplier;

  const checks: MarketVerdict["checks"] = [];

  // --- Hard blocks ---
  if (halted) {
    return {
      tone: "blocked",
      hardBlock: true,
      label: "Trading paused",
      headline: `${symbol} is paused right now.`,
      copy: "The issuer has temporarily paused trading. Orders stay blocked until the issuer reopens this market.",
      action: "Wait for trading to resume",
      checks: [
        { label: "Issuer status", value: "Paused", tone: "warn" },
        { label: "Order readiness", value: "Blocked", tone: "warn" },
      ],
    };
  }

  if (!hasMultiplier) {
    return {
      tone: "blocked",
      hardBlock: true,
      label: "Multiplier missing",
      headline: `${symbol} cannot size an order safely yet.`,
      copy: "UI shares require the active Token-2022 multiplier. Wait until multiplier data loads — do not invent 1×.",
      action: "Wait for multiplier",
      checks: [
        { label: "Multiplier", value: "Unavailable", tone: "warn" },
        { label: "Order readiness", value: "Blocked", tone: "warn" },
      ],
    };
  }

  if (!hasDecimals) {
    return {
      tone: "blocked",
      hardBlock: true,
      label: "Decimals missing",
      headline: `${symbol} mint decimals are not loaded.`,
      copy: "Raw Token-2022 amounts cannot be built without mint decimals.",
      action: "Refresh market context",
      checks: [
        { label: "Token decimals", value: "Unavailable", tone: "warn" },
        { label: "Order readiness", value: "Blocked", tone: "warn" },
      ],
    };
  }

  if (onchainQuote === null && oracle === null && reference === null) {
    return {
      tone: "blocked",
      hardBlock: true,
      label: "No live quote",
      headline: `${symbol} has no executable or reference price right now.`,
      copy: "Missing quotes stay unavailable — OpenStock will not invent a price to trade against.",
      action: "Wait for a live quote",
      checks: [
        { label: "On-chain quote", value: "Unavailable", tone: "warn" },
        { label: "Oracle", value: "Unavailable", tone: "warn" },
        { label: "Issuer reference", value: "Unavailable", tone: "warn" },
      ],
    };
  }

  // Price disagreement hard block (oracle vs pool / executable)
  const pairA = oracle ?? reference;
  const pairB = onchainQuote;
  if (finite(pairA) && finite(pairB)) {
    const disagree = pctDiff(pairA, pairB);
    if (disagree >= DISAGREE_HARD_PCT) {
      return {
        tone: "blocked",
        hardBlock: true,
        label: "Price disagreement",
        headline: `${symbol} sources disagree by ${disagree.toFixed(2)}%.`,
        copy: `Oracle/reference and on-chain quotes differ beyond the ${DISAGREE_HARD_PCT}% safety threshold. Orders stay blocked until sources reconverge.`,
        action: "Do not trade yet",
        checks: [
          { label: "Disagreement", value: `${disagree.toFixed(2)}%`, tone: "warn" },
          { label: "On-chain quote", value: onchainQuote !== null ? "Present" : "Unavailable", tone: onchainQuote !== null ? "good" : "warn" },
          { label: "Oracle / reference", value: pairA !== null ? "Present" : "Unavailable", tone: "warn" },
        ],
      };
    }
  }

  // --- Soft warnings accumulate ---
  let soft = false;
  checks.push({ label: "Solana market", value: "24/7", tone: "good" });
  checks.push({
    label: "On-chain quote",
    value: executableQuote !== null ? "Executable" : poolQuote !== null ? "Pool quote" : "None",
    tone: executableQuote !== null || poolQuote !== null ? "good" : "pending",
  });
  checks.push({
    label: "Multiplier",
    value: `${Number(multiplier).toFixed(4)}×`,
    tone: "good",
  });

  if (tvl !== null) {
    const thin = tvl < THIN_TVL_USD;
    if (thin) soft = true;
    checks.push({
      label: "Meteora TVL",
      value: thin ? `Thin · $${Math.round(tvl).toLocaleString()}` : `$${Math.round(tvl).toLocaleString()}`,
      tone: thin ? "warn" : "good",
    });
  } else {
    soft = true;
    checks.push({ label: "Meteora TVL", value: "Unavailable", tone: "pending" });
  }

  if (pool && finite(pool.feePct)) {
    checks.push({ label: "Pool fee", value: `${pool.feePct!.toFixed(2)}%`, tone: "good" });
  }

  if (finite(pairA) && finite(pairB)) {
    const disagree = pctDiff(pairA, pairB);
    if (disagree >= DISAGREE_SOFT_PCT) {
      soft = true;
      checks.push({ label: "Source spread", value: `${disagree.toFixed(2)}%`, tone: "warn" });
    } else {
      checks.push({ label: "Source spread", value: `${disagree.toFixed(2)}%`, tone: "good" });
    }
  }

  if (typeof freshness === "number" && Number.isFinite(freshness)) {
    if (freshness > STALE_ORACLE_SOFT_SEC) {
      soft = true;
      checks.push({ label: "Oracle freshness", value: `${Math.round(freshness)}s stale`, tone: "warn" });
    } else {
      checks.push({ label: "Oracle freshness", value: `${Math.round(freshness)}s`, tone: "good" });
    }
  }

  if (quoteAgeMs !== null && quoteAgeMs > STALE_QUOTE_SOFT_MS) {
    soft = true;
    checks.push({ label: "Route age", value: `${Math.round(quoteAgeMs / 1000)}s`, tone: "warn" });
  }

  if (impact !== null && impact > 1) {
    soft = true;
    checks.push({ label: "Route impact", value: `${impact.toFixed(2)}%`, tone: "warn" });
  }

  if (pendingMultiplier) {
    soft = true;
    checks.push({ label: "Share adjustment", value: "Pending", tone: "warn" });
  }

  if (!issuerOpen) {
    // Soft only — Solana remains 24/7; label issuer cash session honestly
    checks.push({ label: "Issuer cash session", value: "Closed · DEX live", tone: "pending" });
  } else {
    checks.push({ label: "Issuer cash session", value: "Open", tone: "good" });
  }

  if (evidence.reserves?.state === "unavailable" || !evidence.reserves?.data) {
    soft = true;
    checks.push({ label: "Reserves", value: "Unavailable", tone: "pending" });
  }

  if (onchainQuote === null && oracle !== null) {
    soft = true;
  }

  if (soft || onchainQuote === null) {
    return {
      tone: "caution",
      hardBlock: false,
      label: onchainQuote === null ? "24/7 — quote limited" : "Review with caution",
      headline:
        onchainQuote === null
          ? `${symbol} is open on Solana, but a firm executable quote is limited.`
          : `${symbol} has soft warnings in the evidence strip.`,
      copy: "Issuer cash-session hours do not close Solana. Soft warnings (thin liquidity, spread, freshness) do not invent prices — re-check before you sign.",
      action: onchainQuote !== null ? "Review carefully" : "Wait for a firmer quote",
      checks,
    };
  }

  return {
    tone: "healthy",
    hardBlock: false,
    label: "24/7 On-chain live",
    headline: `${symbol} is trading 24/7 on Solana.`,
    copy: "Reference, execution, oracle, and Meteora pool context are aligned closely enough to review an order.",
    action: "Review an order",
    checks,
  };
}
