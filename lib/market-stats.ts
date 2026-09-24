// Market stats helper. Use Jupiter and Solana data sources for market data.
export type AssetMarketStats = {
  price: number;
  change24h: number | null;
  volume24h: string;
  liquidity: string;
  marketCap: string;
  holders: string;
  high24h: number | null;
  low24h: number | null;
};

import { getMarketEvidence } from "@/lib/market-evidence";
import { getHydratedAsset } from "@/lib/xstocks";

const JUPITER_PRICE_URL = process.env.JUPITER_PRICE_URL ?? "https://api.jup.ag/price/v3";

export async function getAssetMarketStats(symbol: string, currentPrice?: number | null): Promise<AssetMarketStats> {
  const price = typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : 0;

  try {
    const asset = await getHydratedAsset(symbol);
    const evidence = await getMarketEvidence(asset);
    
    // Use Jupiter price data as primary source
    const jupiterPrice = evidence.jupiter.data?.executablePrice;
    
    // Try to get additional Jupiter data for volume/liquidity
    const mint = asset.solanaDeployment?.address;
    let jupiterVolume: number | null = null;
    let jupiterLiquidity: number | null = null;
    
    if (mint) {
      try {
        const response = await fetch(`${JUPITER_PRICE_URL}?ids=${mint}`, {
          headers: process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : undefined,
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json();
          const tokenData = data[mint] || data.data?.[mint];
          if (tokenData) {
            jupiterVolume = typeof tokenData.volume24h === "number" ? tokenData.volume24h : null;
            jupiterLiquidity = typeof tokenData.liquidity === "number" ? tokenData.liquidity : null;
          }
        }
      } catch {
        // Jupiter volume fetch failed, continue without it
      }
    }
    
    const formatDollars = (value: number | null | undefined) => {
      if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
        return "—";
      }
      if (value >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
      }
      if (value >= 1_000) {
        return `$${(value / 1_000).toFixed(2)}K`;
      }
      return `$${value.toFixed(2)}`;
    };
    
    return {
      price: jupiterPrice && jupiterPrice > 0 ? jupiterPrice : price,
      change24h: null,
      volume24h: formatDollars(jupiterVolume),
      liquidity: formatDollars(jupiterLiquidity),
      marketCap: "—",
      holders: "—",
      high24h: null,
      low24h: null,
    };
  } catch (error) {
    console.error(`Failed to fetch market stats for ${symbol}:`, error);
    // Fallback to current price if fetch fails
    return {
      price,
      change24h: null,
      volume24h: "—",
      liquidity: "—",
      marketCap: "—",
      holders: "—",
      high24h: null,
      low24h: null,
    };
  }
}
