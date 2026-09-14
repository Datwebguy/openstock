export type MarketVerdictTone = "healthy" | "caution" | "blocked" | "refreshing";
export type MarketVerdict = { tone: MarketVerdictTone; label: string; headline: string; copy: string; action: string; checks: Array<{ label: string; value: string; tone: "good" | "warn" | "pending" }> };

type AssetLike = { symbol: string; price?: number | null; multiplier?: { currentMultiplier?: number | null } | null; isTradingHalted?: boolean; trading?: { isTradingHalted?: boolean; currentPeriod?: string | null; openNow?: boolean } | null };
type EvidenceLike = { jupiter?: { data?: { executablePrice?: number | null } | null }; pyth?: { data?: { price?: number | null } | null }; meteora?: { data?: Array<{ tvl?: number | null; priceUsd?: number | null }> | null }; reserves?: { data?: { sharesHeld?: string | number | null; circulatingSupply?: string | number | null } | null }; tokenDecimals?: { data?: number | null } };

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function percent(value: number) { return value.toFixed(2) + "%"; }
function coverageOf(evidence: EvidenceLike) { const held = Number(evidence.reserves?.data?.sharesHeld), circulating = Number(evidence.reserves?.data?.circulatingSupply); return Number.isFinite(held) && Number.isFinite(circulating) && circulating > 0 ? held / circulating : null; }

export function getMarketVerdict(asset: AssetLike, evidence: EvidenceLike): MarketVerdict {
  const symbol = asset.symbol.replace(/x$/, "").toUpperCase();
  const halted = Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted);
  const marketClosed = asset.trading?.currentPeriod === "closed" || asset.trading?.openNow === false;
  const reference = finite(asset.price) ? asset.price : null;
  const executableQuote = finite(evidence.jupiter?.data?.executablePrice) ? evidence.jupiter.data.executablePrice : null;
  const poolQuote = finite(evidence.meteora?.data?.[0]?.priceUsd) ? evidence.meteora.data[0].priceUsd : null;
  const onchainQuote = executableQuote ?? poolQuote;
  const oracle = finite(evidence.pyth?.data?.price) ? evidence.pyth.data.price : null;
  const liquidity = finite(evidence.meteora?.data?.[0]?.tvl) ? evidence.meteora.data[0].tvl : null;
  const coverage = coverageOf(evidence);
  const multiplierReady = finite(asset.multiplier?.currentMultiplier) && finite(evidence.tokenDecimals?.data);

  if (halted) return { tone: "blocked", label: "Trading paused", headline: symbol + " is paused right now.", copy: "The issuer has paused trading. Trading can resume when the issuer reopens this market.", action: "Wait for trading to resume", checks: [{ label: "Issuer status", value: "Paused", tone: "warn" }, { label: "Order readiness", value: "Blocked", tone: "warn" }] };

  if (reference === null && marketClosed && onchainQuote !== null) return { tone: "caution", label: "After-hours context", headline: symbol + " is live on Solana after the close.", copy: "The official issuer reference is paused, but Solana has an " + (executableQuote !== null ? "executable" : "indicative") + " quote. Check liquidity and price impact before confirming.", action: "Review onchain execution", checks: [{ label: "Issuer reference", value: "Paused", tone: "warn" }, { label: "Onchain quote", value: executableQuote !== null ? "Executable" : "Indicative", tone: "good" }] };

  if (reference === null && marketClosed) return { tone: "caution", label: "Issuer session closed", headline: symbol + " has no live secondary quote right now.", copy: "The official issuer reference is paused and a current Solana quote was not found. No estimate is shown from an old price.", action: "Wait for an onchain quote", checks: [{ label: "Issuer reference", value: "Paused", tone: "warn" }, { label: "Onchain quote", value: "Not found", tone: "pending" }] };

  if (reference === null) return { tone: "refreshing", label: "Refreshing", headline: symbol + " reference is still loading.", copy: "The official issuer price has not arrived yet. No estimate is shown from an old or missing price.", action: "Wait for live reference", checks: [{ label: "Reference price", value: "Fetching", tone: "pending" }, { label: "Order readiness", value: "Waiting", tone: "pending" }] };

  const quoteGap = executableQuote === null ? null : Math.abs((executableQuote - reference) / reference) * 100;
  const oracleGap = oracle === null ? null : Math.abs((oracle - reference) / reference) * 100;
  const warnings: string[] = [];
  if (quoteGap !== null && quoteGap > 2.5) warnings.push("the executable quote is " + percent(quoteGap) + " from reference");
  if (oracleGap !== null && oracleGap > 2.5) warnings.push("the oracle is " + percent(oracleGap) + " from reference");
  if (liquidity !== null && liquidity < 10000) warnings.push("pool depth is thin");
  if (coverage !== null && coverage < 1) warnings.push("reserves are below circulating shares");

  const missing: string[] = [];
  if (executableQuote === null) missing.push("an executable quote");
  if (oracle === null) missing.push("an oracle cross-check");
  if (liquidity === null) missing.push("pool depth");
  if (coverage === null) missing.push("reserve coverage");
  if (!multiplierReady) missing.push("share adjustment");
  if (missing.length > 0) return { tone: "caution", label: "Check before trading", headline: symbol + " has an incomplete market picture.", copy: "The official reference is live. Still loading: " + missing.join(", ") + ".", action: "Review the missing checks", checks: [{ label: "Reference price", value: "Live", tone: "good" }, { label: "Evidence", value: missing.length + " checks pending", tone: "pending" }] };
  if (warnings.length > 0) return { tone: "caution", label: "Use care", headline: symbol + " needs a closer look.", copy: "Market checks found " + warnings.join(" and ") + ". Check the route and size before confirming an order.", action: "Review execution details", checks: [{ label: "Reference price", value: "Live", tone: "good" }, { label: "Market conditions", value: "Caution", tone: "warn" }] };
  return { tone: "healthy", label: "Healthy to review", headline: symbol + " has a clean market read.", copy: "Reference, execution, oracle, liquidity, reserves, and share adjustment are aligned closely enough to review an order.", action: "Review an order", checks: [{ label: "Reference price", value: "Live", tone: "good" }, { label: "Execution context", value: "Aligned", tone: "good" }] };
}
