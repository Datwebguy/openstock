import { getAllAssetMarketStats } from "@/lib/market-stats";
import { getPrice } from "@/lib/xstocks";

export type LandingQuote = {
  symbol: string;
  /** Backed/xStocks issuer reference price. */
  issuerPrice: number | null;
  /** Solana DEX price from Jupiter Price v3. */
  dexPrice: number | null;
  change24h: number | null;
  liquidity: string;
  volume24h: string;
};

export const LANDING_SYMBOLS = ["NVDAx", "AAPLx", "TSLAx", "MSFTx"] as const;

/** Live quotes for the marketing page. Every missing value stays null — the page renders "—", never a sample number. */
export async function getLandingQuotes(): Promise<Record<string, LandingQuote>> {
  const [stats, issuer] = await Promise.all([
    getAllAssetMarketStats().catch(() => ({} as Awaited<ReturnType<typeof getAllAssetMarketStats>>)),
    Promise.all(
      LANDING_SYMBOLS.map((symbol) =>
        getPrice(symbol)
          .then((value) => (typeof value.quote === "number" && value.quote > 0 ? value.quote : null))
          .catch(() => null)
      )
    ),
  ]);
  const quotes: Record<string, LandingQuote> = {};
  LANDING_SYMBOLS.forEach((symbol, index) => {
    const stat = stats[symbol];
    quotes[symbol] = {
      symbol,
      issuerPrice: issuer[index],
      dexPrice: stat && stat.price > 0 ? stat.price : null,
      change24h: stat?.change24h ?? null,
      liquidity: stat?.liquidity ?? "—",
      volume24h: stat?.volume24h ?? "—",
    };
  });
  return quotes;
}

export function usd(value: number | null): string {
  return value === null ? "—" : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function spreadLabel(a: number | null, b: number | null): string {
  if (a === null || b === null || a <= 0) return "spread unavailable";
  const pct = ((b - a) / a) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% spread`;
}
