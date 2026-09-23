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

export function getAssetMarketStats(symbol: string, currentPrice?: number | null): AssetMarketStats {
  void symbol;
  const price = typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : 0;

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
