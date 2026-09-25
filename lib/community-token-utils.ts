import curatedPairs from "./solana-curated-25.json";

export function formatTokenPrice(price: number): string {
  if (!price || Number.isNaN(price) || price <= 0) return "—";
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }
  if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  }
  // Sub-micro tokens (e.g. 0.0000198 or 0.00000273)
  const str = price.toFixed(8);
  const trimmed = str.replace(/0+$/, "").replace(/\.$/, "");
  return `$${trimmed}`;
}

export function formatTokenVolume(volume: number): string {
  if (!volume || Number.isNaN(volume) || volume <= 0) return "$0";
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(volume).toLocaleString()}`;
}


/** Market cap, or an em dash when DexScreener does not report one (never "$0.0K"). */
export function formatMarketCap(value: number): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

type TokenLike = {
  status: string;
  bondingCurveProgress: number;
  progressKnown?: boolean;
  dexId?: string;
  venue?: string;
  source?: string;
};

export function isOnAmmPool(token: TokenLike): boolean {
  return token.status === "graduated";
}

/** Human status of where the token trades — only states a percentage when it was actually measured. */
export function curveStatusLabel(token: TokenLike): string {
  if (isOnAmmPool(token)) return `On ${dexLabel(token)} pool`;
  if (token.progressKnown) return `${token.bondingCurveProgress.toFixed(1)}% of curve`;
  return `On ${dexLabel(token)} curve`;
}

export function dexLabel(token: TokenLike): string {
  switch (token.dexId) {
    case "pumpfun":
      return "Pump.fun";
    case "pumpswap":
      return "PumpSwap";
    case "meteora":
      return "Meteora";
    case "raydium":
      return "Raydium";
    case "orca":
      return "Orca";
    default:
      return token.venue === "meteora" ? "Meteora" : token.venue === "pumpfun" ? "Pump.fun" : token.dexId || "DEX";
  }
}

const LOOKALIKE_TICKERS = new Set(["USDC", "USDT", "SOL", "WSOL", "BTC", "ETH", "JUP", "BONK"]);
const STOCK_TICKERS = new Set(
  Object.values(curatedPairs as Record<string, { symbol: string }>).flatMap((pair) => [
    pair.symbol.toUpperCase(),
    pair.symbol.replace(/x$/i, "").toUpperCase(),
  ])
);

/** Tickers that impersonate majors, stablecoins or the stocks themselves — shown with a warning, never hidden. */
export function isLookalikeTicker(symbol: string): boolean {
  const upper = symbol.toUpperCase().replace(/^\$/, "");
  return LOOKALIKE_TICKERS.has(upper) || STOCK_TICKERS.has(upper);
}
