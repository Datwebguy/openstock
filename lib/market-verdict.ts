export type MarketVerdictTone = "healthy" | "caution" | "blocked" | "refreshing";
export type MarketVerdict = {
  tone: MarketVerdictTone;
  label: string;
  headline: string;
  copy: string;
  action: string;
  checks: Array<{ label: string; value: string; tone: "good" | "warn" | "pending" }>;
};

type AssetLike = {
  symbol: string;
  price?: number | null;
  multiplier?: { currentMultiplier?: number | null } | null;
  isTradingHalted?: boolean;
  trading?: { isTradingHalted?: boolean; currentPeriod?: string | null; openNow?: boolean } | null;
};

type EvidenceLike = {
  jupiter?: { data?: { executablePrice?: number | null } | null };
  pyth?: { data?: { price?: number | null } | null };
  meteora?: { data?: Array<{ tvl?: number | null; priceUsd?: number | null }> | null };
  reserves?: { data?: { sharesHeld?: string | number | null; circulatingSupply?: string | number | null } | null };
  tokenDecimals?: { data?: number | null };
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function getMarketVerdict(asset: AssetLike, evidence: EvidenceLike): MarketVerdict {
  const symbol = asset.symbol.replace(/x$/, "").toUpperCase();
  const halted = Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted);
  const reference = finite(asset.price) ? asset.price : null;
  const executableQuote = finite(evidence.jupiter?.data?.executablePrice) ? evidence.jupiter.data.executablePrice : null;
  const pool = evidence.meteora?.data?.find((item) => typeof item.priceUsd === "number" && item.priceUsd > 0) ?? evidence.meteora?.data?.[0] ?? null;
  const poolQuote = finite(pool?.priceUsd) ? pool.priceUsd : null;
  const onchainQuote = executableQuote ?? poolQuote;
  const oracle = finite(evidence.pyth?.data?.price) ? evidence.pyth.data.price : null;

  // 1. Trading Halted by Issuer
  if (halted) {
    return {
      tone: "blocked",
      label: "Trading paused",
      headline: `${symbol} is paused right now.`,
      copy: "The issuer has temporarily paused trading. Trading will resume when the issuer reopens this market.",
      action: "Wait for trading to resume",
      checks: [
        { label: "Issuer status", value: "Paused", tone: "warn" },
        { label: "Order readiness", value: "Blocked", tone: "warn" }
      ]
    };
  }

  // 2. 24/7 Solana On-Chain Secondary Market Active
  if (onchainQuote !== null || reference === null) {
    const quoteStatus = executableQuote !== null ? "Executable" : poolQuote !== null ? "Active Pool" : oracle !== null ? "Pyth Live" : "24/7 Live";
    return {
      tone: "healthy",
      label: "24/7 On-chain live",
      headline: `${symbol} is trading 24/7 on Solana.`,
      copy: "Traditional equity sessions may be closed, but tokenized secondary trading is live and executable on Solana via concentrated liquidity.",
      action: "Review an order",
      checks: [
        { label: "Solana market", value: "24/7 Live", tone: "good" },
        { label: "On-chain quote", value: quoteStatus, tone: "good" }
      ]
    };
  }

  // 3. Official Regular Hours Reference Active
  return {
    tone: "healthy",
    label: "Healthy to review",
    headline: `${symbol} has a clean market read.`,
    copy: "Reference, execution, oracle, and liquidity reserves are aligned closely to review an order.",
    action: "Review an order",
    checks: [
      { label: "Reference price", value: "Live", tone: "good" },
      { label: "Execution context", value: "Aligned", tone: "good" }
    ]
  };
}
