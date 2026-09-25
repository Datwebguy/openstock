// Real market stats helper connecting directly to Solana on-chain dex sources (Jupiter v3 + DexScreener)
import curated25Data from "@/lib/solana-curated-25.json";
import { fetchJupiterPrices } from "@/lib/jupiter-price";

export type AssetMarketStats = {
  price: number;
  change24h: number | null;
  volume24h: string;
  liquidity: string;
  rawVolume24h?: number;
  rawLiquidity?: number;
  hasPool?: boolean;
  marketCap: string;
  holders: string;
  high24h: number | null;
  low24h: number | null;
};

const DEXSCREENER_URL = "https://api.dexscreener.com/tokens/v1/solana";

const curated25: Record<string, { symbol: string; name: string; mint: string; decimals: number; logo: string }> = curated25Data;

function formatDollars(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "—";
  }
  if (value === 0) {
    return "$0";
  }
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// In-memory cache for batch stats (30-second TTL)
let batchCache: {
  stats: Record<string, AssetMarketStats>;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 30_000;

export async function getAllAssetMarketStats(): Promise<Record<string, AssetMarketStats>> {
  const now = Date.now();
  if (batchCache && now - batchCache.timestamp < CACHE_TTL_MS) {
    return batchCache.stats;
  }

  const mints = Object.values(curated25).map((c) => c.mint);
  const mintToSymbol: Record<string, string> = {};
  for (const [sym, meta] of Object.entries(curated25)) {
    mintToSymbol[meta.mint] = sym;
  }

  try {
    // DexScreener supports up to 30 addresses per request; chunk to ensure all 32 curated tokens are queried
    const chunkSize = 20;
    const dexChunkPromises: Promise<Response>[] = [];
    for (let i = 0; i < mints.length; i += chunkSize) {
      const chunk = mints.slice(i, i + chunkSize);
      dexChunkPromises.push(
        fetch(`${DEXSCREENER_URL}/${chunk.join(",")}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        })
      );
    }

    const [jupRes, ...dexResponses] = await Promise.allSettled([
      fetchJupiterPrices(mints, 8000),
      ...dexChunkPromises,
    ]);

    const jupData: Record<string, any> = jupRes.status === "fulfilled" ? jupRes.value : {};

    const dexPairs: any[] = [];
    for (const res of dexResponses as PromiseSettledResult<Response>[]) {
      if (res.status === "fulfilled" && res.value.ok) {
        try {
          const data = await res.value.json();
          if (Array.isArray(data)) {
            dexPairs.push(...data);
          }
        } catch {
          // ignore chunk parse error
        }
      }
    }

    const dexVolByMint: Record<string, number> = {};
    const dexLiqByMint: Record<string, number> = {};
    const dexChangeByMint: Record<string, number> = {};
    const dexHasPoolByMint: Record<string, boolean> = {};

    for (const pair of dexPairs) {
      const baseMint = pair.baseToken?.address;
      if (baseMint) {
        dexHasPoolByMint[baseMint] = true;
        if (typeof pair.volume?.h24 === "number") {
          dexVolByMint[baseMint] = (dexVolByMint[baseMint] || 0) + pair.volume.h24;
        }
        if (typeof pair.liquidity?.usd === "number") {
          dexLiqByMint[baseMint] = Math.max(dexLiqByMint[baseMint] || 0, pair.liquidity.usd);
        }
        if (pair.priceChange?.h24 !== undefined && dexChangeByMint[baseMint] === undefined) {
          dexChangeByMint[baseMint] = Number(pair.priceChange.h24);
        }
      }
    }

    const statsMap: Record<string, AssetMarketStats> = {};

    for (const [sym, meta] of Object.entries(curated25)) {
      const j = jupData[meta.mint] || jupData.data?.[meta.mint];
      const hasPool = dexHasPoolByMint[meta.mint] === true;
      const vol = dexVolByMint[meta.mint] || 0;
      const liq = typeof j?.liquidity === "number" ? j.liquidity : dexLiqByMint[meta.mint] || 0;

      // Extract genuine real-world price (prefer stockData if available, fallback to usdPrice)
      const stockPrice = typeof j?.stockData?.price === "number" && j.stockData.price > 0 ? j.stockData.price : null;
      const rawUsdPrice = typeof j?.usdPrice === "number" && j.usdPrice > 0 ? j.usdPrice : null;
      let price = 0;
      if (stockPrice && rawUsdPrice) {
        // Protect against dust pools skewing usdPrice (e.g. PYPLx)
        if (rawUsdPrice > stockPrice * 2.5 || rawUsdPrice < stockPrice * 0.4) {
          price = stockPrice;
        } else {
          price = rawUsdPrice;
        }
      } else {
        price = stockPrice ?? rawUsdPrice ?? 0;
      }

      let change: number | null = null;
      if (typeof j?.priceChange24h === "number" && Number.isFinite(j.priceChange24h)) {
        change = Number(j.priceChange24h.toFixed(2));
      } else if (typeof dexChangeByMint[meta.mint] === "number" && Number.isFinite(dexChangeByMint[meta.mint])) {
        change = Number(dexChangeByMint[meta.mint].toFixed(2));
      }

      const mcap = j?.stockData?.mcap ? formatDollars(j.stockData.mcap) : "—";

      statsMap[sym] = {
        price,
        change24h: change,
        volume24h: hasPool ? formatDollars(vol) : "$0",
        liquidity: hasPool ? formatDollars(liq) : "Pre-Pool",
        rawVolume24h: vol,
        rawLiquidity: liq,
        hasPool,
        marketCap: mcap,
        holders: "—",
        high24h: null,
        low24h: null,
      };
    }

    batchCache = { stats: statsMap, timestamp: now };
    return statsMap;
  } catch (err) {
    console.error("Failed to load batch market stats:", err);
    if (batchCache) return batchCache.stats;
    return {};
  }
}

export async function getAssetMarketStats(symbol: string, currentPrice?: number | null): Promise<AssetMarketStats> {
  const fallbackPrice = typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : 0;

  // Check batch cache first
  const allStats = await getAllAssetMarketStats();
  if (allStats[symbol]) {
    const stat = allStats[symbol];
    return {
      ...stat,
      price: stat.price > 0 ? stat.price : fallbackPrice,
    };
  }

  // Fallback single asset lookup if symbol is outside curated list
  const meta = curated25[symbol];
  const mint = meta?.mint;

  if (mint) {
    try {
      const [jupRes, dexRes] = await Promise.allSettled([
        fetchJupiterPrices([mint], 5000),
        fetch(`${DEXSCREENER_URL}/${mint}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        }),
      ]);

      const jupData: Record<string, any> = jupRes.status === "fulfilled" ? jupRes.value : {};
      const tokenData = jupData[mint] || jupData.data?.[mint];
      const dexPairs = dexRes.status === "fulfilled" && dexRes.value.ok ? await dexRes.value.json() : [];
      const dexPair = Array.isArray(dexPairs) && dexPairs.length > 0 ? dexPairs[0] : null;

      const jupPrice = typeof tokenData?.usdPrice === "number" ? tokenData.usdPrice : null;
      const jupLiq = typeof tokenData?.liquidity === "number" ? tokenData.liquidity : null;
      const dexVol = typeof dexPair?.volume?.h24 === "number" ? dexPair.volume.h24 : null;
      const dexLiq = typeof dexPair?.liquidity?.usd === "number" ? dexPair.liquidity.usd : null;

      let change: number | null = null;
      if (typeof tokenData?.priceChange24h === "number" && Number.isFinite(tokenData.priceChange24h)) {
        change = Number(tokenData.priceChange24h.toFixed(2));
      } else if (typeof dexPair?.priceChange?.h24 === "number") {
        change = Number(dexPair.priceChange.h24.toFixed(2));
      }

      const hasPool = dexPair !== null;
      const stockPrice = typeof tokenData?.stockData?.price === "number" && tokenData.stockData.price > 0 ? tokenData.stockData.price : null;
      const rawUsdPrice = typeof tokenData?.usdPrice === "number" && tokenData.usdPrice > 0 ? tokenData.usdPrice : null;
      let price = stockPrice ?? rawUsdPrice ?? fallbackPrice;

      return {
        price: price > 0 ? price : fallbackPrice,
        change24h: change,
        volume24h: hasPool ? formatDollars(dexVol) : "$0",
        liquidity: hasPool ? formatDollars(jupLiq || dexLiq) : "Pre-Pool",
        rawVolume24h: dexVol || 0,
        rawLiquidity: dexLiq || jupLiq || 0,
        hasPool,
        marketCap: tokenData?.stockData?.mcap ? formatDollars(tokenData.stockData.mcap) : "—",
        holders: "—",
        high24h: null,
        low24h: null,
      };
    } catch {
      // Return fallback
    }
  }

  return {
    price: fallbackPrice,
    change24h: null,
    volume24h: "$0",
    liquidity: "Pre-Pool",
    rawVolume24h: 0,
    rawLiquidity: 0,
    hasPool: false,
    marketCap: "—",
    holders: "—",
    high24h: null,
    low24h: null,
  };
}
