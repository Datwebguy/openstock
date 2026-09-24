// Market stats helper. Prefer live price; never invent pool volume/liquidity.
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

export async function getAssetMarketStats(symbol: string, currentPrice?: number | null): Promise<AssetMarketStats> {
  const price = typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : 0;

  try {
    const { getMarketEvidence } = await import("@/lib/market-evidence");
    const { getHydratedAsset } = await import("@/lib/xstocks");
    
    const asset = await getHydratedAsset(symbol);
    const evidence = await getMarketEvidence(asset);
    
    const pool = evidence.meteora.data?.[0];
    const tvl = pool?.tvl;
    const volume24h = pool?.volume24h;
    
    const formatDollars = (value: number | null | undefined) => {
      if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
        return "Unavailable";
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
      price,
      change24h: null,
      volume24h: formatDollars(volume24h),
      liquidity: formatDollars(tvl),
      marketCap: "Unavailable",
      holders: "Unavailable",
      high24h: null,
      low24h: null,
    };
  } catch {
    // Fallback to hardcoded values if fetch fails
    return {
      price,
      change24h: null,
      volume24h: "Unavailable",
      liquidity: "Unavailable",
      marketCap: "Unavailable",
      holders: "Unavailable",
      high24h: null,
      low24h: null,
    };
  }
}
