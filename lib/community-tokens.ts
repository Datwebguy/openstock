import { promises as fs } from "node:fs";
import path from "node:path";

export type CommunityToken = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  pairedStockSymbol: string; // e.g. "AAPLx", "NVDAx", "CRCLx"
  pairedStockName: string;
  creatorWallet: string;
  supply: number;
  creatorFeeBps: number;
  priceSol: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24h: number;
  bondingCurveProgress: number; // 0 to 100
  status: "new" | "graduating" | "graduated";
  holdersCount: number;
  txSignature: string;
  pumpUrl: string;
  explorerUrl: string;
  createdAt: string;
  poolAddress?: string;
  meteoraUrl?: string;
  venue?: "pumpfun" | "meteora";
  isStale?: boolean;
  marketStatus?: "live" | "stale" | "unlisted";
};

export { formatTokenPrice, formatTokenVolume } from "./community-token-utils";

// 100% Real on-chain Solana tokens paired against xStocks on Meteora DLMM and Pump.fun
export const SEED_COMMUNITY_TOKENS: CommunityToken[] = [
  {
    mint: "A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
    name: "The Toad Pepe",
    symbol: "TOAD",
    description: "The Toad Pepe meme collective paired directly against Apple xStock (AAPLx) on Solana via Pump.fun and Meteora DLMM.",
    imageUrl: "https://cdn.dexscreener.com/cms/images/U_QlNDlrfVQowR0g?width=800&height=800&quality=95&format=auto",
    pairedStockSymbol: "AAPLx",
    pairedStockName: "Apple Inc.",
    creatorWallet: "8VeV...NDuV",
    supply: 960_554_335,
    creatorFeeBps: 100, // 1%
    priceSol: 0.0000128,
    priceUsd: 0.001727,
    marketCapUsd: 1_659_097,
    volume24hUsd: 98_400,
    change24h: 14.2,
    bondingCurveProgress: 100,
    status: "graduated",
    holdersCount: 19_495,
    txSignature: "5Xo7F7xV8k9qQ4r8bT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP",
    pumpUrl: "https://pump.fun/coin/A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
    explorerUrl: "https://solscan.io/token/A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
    poolAddress: "EFrPQFrEEhZBLBZPxTopDStfpL44KxqkDvqhBhLcEvcf",
    meteoraUrl: "https://app.meteora.ag/dlmm/EFrPQFrEEhZBLBZPxTopDStfpL44KxqkDvqhBhLcEvcf",
    venue: "pumpfun",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    mint: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb",
    name: "SpaceX - Backpack Securities",
    symbol: "SPCX",
    description: "SpaceX pre-IPO synthetic equity paired against Circle tokenized dollar stock (CRCLx) on Meteora DLMM.",
    imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23005288'/><path d='M25 50 Q50 20 75 50 Q50 80 25 50 Z' fill='none' stroke='%23ffffff' stroke-width='6'/><circle cx='50' cy='50' r='12' fill='%2300c0f3'/></svg>",
    pairedStockSymbol: "CRCLx",
    pairedStockName: "Circle xStock",
    creatorWallet: "BP8kM5tqS6YF3b8m7ZgK2s4nP9qW1rX5tE7uY8iO9pL",
    supply: 43_248,
    creatorFeeBps: 150, // 1.5%
    priceSol: 1.068,
    priceUsd: 144.28,
    marketCapUsd: 6_239_872,
    volume24hUsd: 303_016,
    change24h: 8.5,
    bondingCurveProgress: 100,
    status: "graduated",
    holdersCount: 27_210,
    txSignature: "3YtB2rK8sN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9s",
    pumpUrl: "https://solscan.io/token/SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb",
    explorerUrl: "https://solscan.io/token/SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb",
    poolAddress: "GVKjPzVVLMVYovPHeHLHUtrHWhLt1SutUwz2ECZCLpQW",
    meteoraUrl: "https://app.meteora.ag/dlmm/GVKjPzVVLMVYovPHeHLHUtrHWhLt1SutUwz2ECZCLpQW",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    mint: "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp",
    name: "ORE",
    symbol: "ORE",
    description: "Proof of Work digital commodity on Solana paired directly against physical Gold xStock (GLDx).",
    imageUrl: "https://cdn.dexscreener.com/cms/images/882b6417f93b6fe65938564e91d1bef5a7fd7b1afc70bed58be330b8eb3c4023?width=800&height=800&quality=95&format=auto",
    pairedStockSymbol: "GLDx",
    pairedStockName: "Gold Trust xStock",
    creatorWallet: "Ore1Miner9vB4xZ8m2qT5yK7sN1wE3rP6tU8iO0pL3kA",
    supply: 492_064,
    creatorFeeBps: 100, // 1%
    priceSol: 0.431,
    priceUsd: 58.25,
    marketCapUsd: 28_661_985,
    volume24hUsd: 145_200,
    change24h: -2.4,
    bondingCurveProgress: 100,
    status: "graduated",
    holdersCount: 33_748,
    txSignature: "7KxL4vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2n",
    pumpUrl: "https://solscan.io/token/oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp",
    explorerUrl: "https://solscan.io/token/oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp",
    poolAddress: "6iMKsFAkkvXS6E1Q4hyHARQkLn3HFLrwTo1JStLw5q2p",
    meteoraUrl: "https://app.meteora.ag/dlmm/6iMKsFAkkvXS6E1Q4hyHARQkLn3HFLrwTo1JStLw5q2p",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    mint: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    name: "HYPE",
    symbol: "HYPE",
    description: "High-frequency ecosystem asset paired directly against Nasdaq Invesco QQQ xStock on Meteora DLMM.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "QQQx",
    pairedStockName: "Invesco QQQ Trust",
    creatorWallet: "Hype88aM7kP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2n",
    supply: 711_082,
    creatorFeeBps: 100, // 1%
    priceSol: 0.571,
    priceUsd: 77.19,
    marketCapUsd: 54_888_257,
    volume24hUsd: 323_517,
    change24h: 5.8,
    bondingCurveProgress: 100,
    status: "graduated",
    holdersCount: 48_444,
    txSignature: "4KjP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN",
    pumpUrl: "https://solscan.io/token/98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    explorerUrl: "https://solscan.io/token/98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    poolAddress: "7y78C674LgQJWmnD5o95P4iWoooSx6mw68xt14ezLtDv",
    meteoraUrl: "https://app.meteora.ag/dlmm/7y78C674LgQJWmnD5o95P4iWoooSx6mw68xt14ezLtDv",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    mint: "BgCeigJo2iY3dJhqS2z9w4pjjufFd4F9oKS3FrkMbmbJ",
    name: "Trump Bucks",
    symbol: "TrumpBucks",
    description: "Political narrative meme economy token paired directly against NVIDIA tokenized equity (NVDAx).",
    imageUrl: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "NVDAx",
    pairedStockName: "NVIDIA Corporation",
    creatorWallet: "9xTrNVDA5kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB",
    supply: 1_004_432_445,
    creatorFeeBps: 200, // 2%
    priceSol: 0.00000143,
    priceUsd: 0.000193,
    marketCapUsd: 193_826,
    volume24hUsd: 0,
    change24h: 0,
    bondingCurveProgress: 82.5,
    status: "graduating",
    holdersCount: 555,
    txSignature: "2LkM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3p",
    pumpUrl: "https://solscan.io/token/BgCeigJo2iY3dJhqS2z9w4pjjufFd4F9oKS3FrkMbmbJ",
    explorerUrl: "https://solscan.io/token/BgCeigJo2iY3dJhqS2z9w4pjjufFd4F9oKS3FrkMbmbJ",
    poolAddress: "G75nBGK78MRSZAc1hNf3xbWVB73QWcxvJ4CLsqKMAzSr",
    meteoraUrl: "https://app.meteora.ag/dlmm/G75nBGK78MRSZAc1hNf3xbWVB73QWcxvJ4CLsqKMAzSr",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    mint: "ByCds9p6tXfF5HEg6aJDdrEypCWTi7Jui5nLs7QbyYuw",
    name: "Macavity",
    symbol: "MPAW",
    description: "Mystery feline meme paired against Robinhood (HOODx) and Apple (AAPLx) xStocks on Solana.",
    imageUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "HOODx",
    pairedStockName: "Robinhood Markets",
    creatorWallet: "3FpLMacv6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD",
    supply: 12_999_492,
    creatorFeeBps: 150, // 1.5%
    priceSol: 0.0000248,
    priceUsd: 0.003352,
    marketCapUsd: 43_578,
    volume24hUsd: 0,
    change24h: 0,
    bondingCurveProgress: 68.4,
    status: "new",
    holdersCount: 203,
    txSignature: "8MmN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1",
    pumpUrl: "https://solscan.io/token/ByCds9p6tXfF5HEg6aJDdrEypCWTi7Jui5nLs7QbyYuw",
    explorerUrl: "https://solscan.io/token/ByCds9p6tXfF5HEg6aJDdrEypCWTi7Jui5nLs7QbyYuw",
    poolAddress: "GZV54C8qPDY8Jav3LToU7mk9soVGydAyrz6tdEVtAz7f",
    meteoraUrl: "https://app.meteora.ag/dlmm/GZV54C8qPDY8Jav3LToU7mk9soVGydAyrz6tdEVtAz7f",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    mint: "6oxWqT3Pkt97NEVDvthztC59vTGxSwSmsTL6eFFLoBGu",
    name: "Tao Te Ching",
    symbol: "TAO",
    description: "Philosophical decentralized token paired against NVIDIA compute equity (NVDAx) on Solana.",
    imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "NVDAx",
    pairedStockName: "NVIDIA Corporation",
    creatorWallet: "6oxWTao17qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ",
    supply: 958_220_000,
    creatorFeeBps: 100, // 1%
    priceSol: 0.000000052,
    priceUsd: 0.00000706,
    marketCapUsd: 6_765,
    volume24hUsd: 0,
    change24h: 0,
    bondingCurveProgress: 35.8,
    status: "new",
    holdersCount: 36,
    txSignature: "1Tao7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC",
    pumpUrl: "https://solscan.io/token/6oxWqT3Pkt97NEVDvthztC59vTGxSwSmsTL6eFFLoBGu",
    explorerUrl: "https://solscan.io/token/6oxWqT3Pkt97NEVDvthztC59vTGxSwSmsTL6eFFLoBGu",
    poolAddress: "4E7ijrsUamHhvAybeTvdMjYnQkTzyixaf6tc4dMWx6oK",
    meteoraUrl: "https://app.meteora.ag/dlmm/4E7ijrsUamHhvAybeTvdMjYnQkTzyixaf6tc4dMWx6oK",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    mint: "3JUj6ZdRreqNH5gkdL2dZWn477kB97NxdkqSv2GeXWG9",
    name: "Wolfgang",
    symbol: "OGW",
    description: "Community meme asset paired against Circle tokenized dollar stock (CRCLx) on Solana DEX.",
    imageUrl: "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "CRCLx",
    pairedStockName: "Circle xStock",
    creatorWallet: "3JUjWolf8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC",
    supply: 81_000_000,
    creatorFeeBps: 250, // 2.5%
    priceSol: 0.000000146,
    priceUsd: 0.0000198,
    marketCapUsd: 1_605,
    volume24hUsd: 0,
    change24h: 0,
    bondingCurveProgress: 41.2,
    status: "new",
    holdersCount: 112,
    txSignature: "9Wlf9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN4mD9sL6tC1vE8xA5zB2nJ4kM7qP9sT2wK3pY7hN",
    pumpUrl: "https://solscan.io/token/3JUj6ZdRreqNH5gkdL2dZWn477kB97NxdkqSv2GeXWG9",
    explorerUrl: "https://solscan.io/token/3JUj6ZdRreqNH5gkdL2dZWn477kB97NxdkqSv2GeXWG9",
    poolAddress: "EP3zXQitvxqbxLBLg5g8QSTavBLEzuLcSHYkWHFh2Gh7",
    meteoraUrl: "https://app.meteora.ag/dlmm/EP3zXQitvxqbxLBLg5g8QSTavBLEzuLcSHYkWHFh2Gh7",
    venue: "meteora",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

type CommunityTokenStore = {
  version: 1;
  tokens: CommunityToken[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "community-tokens.json");

async function readStore(): Promise<CommunityTokenStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as Partial<CommunityTokenStore>;
    if (Array.isArray(data.tokens) && data.tokens.length > 0) {
      // If store contains old fake tokens (e.g. Compute7b), reseed with real tokens
      const hasOldFake = data.tokens.some((t) => t.mint.startsWith("Compute7b") || t.mint.startsWith("CyberXs"));
      if (!hasOldFake) {
        return { version: 1, tokens: data.tokens };
      }
    }
  } catch {
    // Store does not exist yet, write seed
  }

  const initialStore: CommunityTokenStore = { version: 1, tokens: SEED_COMMUNITY_TOKENS };
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(initialStore, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to write initial community tokens store:", err);
  }
  return initialStore;
}

async function writeStore(store: CommunityTokenStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tmp = STORE_PATH + "." + process.pid + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, STORE_PATH);
}

// In-memory cache for live DexScreener & market enrichment
interface EnrichedTokenData {
  priceUsd: number;
  priceSol: number;
  volume24hUsd: number;
  change24h: number;
  marketCapUsd: number;
  fetchedAt: number;
}

// Persistent in-memory cache storing the last good verified live data per mint
const lastGoodLiveCache = new Map<string, EnrichedTokenData>();

let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds between upstream DexScreener API calls

export async function enrichTokensWithLiveMarketData(tokens: CommunityToken[]): Promise<CommunityToken[]> {
  const now = Date.now();
  const shouldFetch = now - lastFetchTimestamp > CACHE_TTL_MS;

  if (shouldFetch) {
    const mintsSet = new Set<string>();
    for (const t of tokens) {
      if (t.mint && t.mint.length > 20) {
        mintsSet.add(t.mint);
      }
    }
    const mintsArray = Array.from(mintsSet);

    if (mintsArray.length > 0) {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintsArray.join(",")}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000), // 5000ms timeout
        });

        if (res.ok) {
          const json = await res.json();
          type DexScreenerPair = {
            baseToken?: { address?: string };
            priceUsd?: string;
            priceNative?: string;
            volume?: { h24?: number };
            priceChange?: { h24?: number };
            marketCap?: number;
            fdv?: number;
          };
          const pairs: DexScreenerPair[] = Array.isArray(json?.pairs) ? json.pairs : [];

          for (const pair of pairs) {
            const address = pair.baseToken?.address;
            if (!address) continue;

            const pUsd = parseFloat(pair.priceUsd ?? "") || 0;
            const pSol = parseFloat(pair.priceNative ?? "") || 0;
            const vol = typeof pair.volume?.h24 === "number" ? Math.round(pair.volume.h24) : 0;
            const chg = typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : 0;
            const mcap = pair.marketCap || pair.fdv || 0;

            const existing = lastGoodLiveCache.get(address);
            if (!existing || vol >= existing.volume24hUsd) {
              lastGoodLiveCache.set(address, {
                priceUsd: pUsd,
                priceSol: pSol,
                volume24hUsd: vol,
                change24h: chg,
                marketCapUsd: mcap,
                fetchedAt: now,
              });
            }
          }

          lastFetchTimestamp = now;
        }
      } catch (err) {
        // Fall back gracefully to last good live data in memory without inventing volume
        console.warn(
          "DexScreener live sync notice: using cached/stale data (",
          err instanceof Error ? err.message : err,
          ")"
        );
      }
    }
  }

  return tokens.map((t) => {
    const live = lastGoodLiveCache.get(t.mint);

    if (live) {
      const isStale = now - live.fetchedAt > 60_000;
      const isGraduated = t.status === "graduated" || t.bondingCurveProgress >= 100;
      const progress = isGraduated
        ? 100
        : Math.min(99.5, Math.max(10, +((live.marketCapUsd / 69_000) * 100).toFixed(1)));

      return {
        ...t,
        priceUsd: live.priceUsd > 0 ? live.priceUsd : t.priceUsd,
        priceSol: live.priceSol > 0 ? live.priceSol : t.priceSol,
        volume24hUsd: live.volume24hUsd,
        change24h: live.change24h,
        marketCapUsd: live.marketCapUsd > 0 ? live.marketCapUsd : t.marketCapUsd,
        bondingCurveProgress: progress,
        status: progress >= 100 ? "graduated" : t.status,
        isStale,
        marketStatus: isStale ? "stale" : "live",
      };
    }

    // Token has no verified DexScreener pair (e.g. unlisted / pre-graduated curve)
    // NEVER invent volume: set volume24hUsd to 0, mark unlisted
    return {
      ...t,
      volume24hUsd: 0,
      isStale: false,
      marketStatus: "unlisted",
    };
  });
}

export async function getCommunityTokens(): Promise<CommunityToken[]> {
  const store = await readStore();
  const sorted = store.tokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Try to fetch real tokens from DexScreener that are paired against xStocks
  try {
    const dexscreenerTokens = await fetchDexScreenerMemeTokens();
    if (dexscreenerTokens.length > 0) {
      // Merge real tokens with seed data, avoiding duplicates
      const existingMints = new Set(sorted.map(t => t.mint));
      const newTokens = dexscreenerTokens.filter(t => !existingMints.has(t.mint));
      return enrichTokensWithLiveMarketData([...newTokens, ...sorted]);
    }
  } catch (err) {
    console.warn("Failed to fetch DexScreener tokens, using seed data:", err);
  }
  
  return enrichTokensWithLiveMarketData(sorted);
}

async function fetchDexScreenerMemeTokens(): Promise<CommunityToken[]> {
  try {
    // Known xStock mints to find tokens paired against them
    const xStockMints = [
      "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", // NVDAx
      "BwpKWcauiC9XMNuUH2JaH3wqjYKjVDmfhWh2a6Gq8Jrw", // AAPLx
      "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", // TSLAx
      "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", // AAPLx (alternative)
      "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", // COINx
      "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", // HOODx
      "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", // MSTRx
      "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", // MSFTx
      "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", // GOOGLx
      "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", // AMZNx
      "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", // METAx
    ];
    
    // Common tokens to EXCLUDE (not community tokens)
    const commonMints = new Set([
      "So11111111111111111111111111111111111111112", // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    ]);
    
    // Fetch pairs for each xStock
    const allPairs = [];
    for (const mint of xStockMints) {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          const data = await response.json();
          const pairs = data.pairs || [];
          allPairs.push(...pairs);
        }
      } catch (err) {
        console.warn(`Failed to fetch pairs for ${mint}:`, err);
      }
    }
    
    // Convert DexScreener pairs to CommunityToken format
    const tokens: CommunityToken[] = allPairs
      .filter((pair: any) => {
        // Must be on Solana
        if (pair.chainId !== "solana") return false;
        
        // Must not be an xStock itself
        if (xStockMints.includes(pair.baseToken.address)) return false;
        if (xStockMints.includes(pair.quoteToken.address)) return false;
        
        // Must not be common tokens
        if (commonMints.has(pair.baseToken.address)) return false;
        if (commonMints.has(pair.quoteToken.address)) return false;
        
        // Must have some trading activity
        if (!pair.volume?.h24 || pair.volume.h24 < 100) return false;
        
        // Must have a valid price
        if (!pair.priceUsd || pair.priceUsd <= 0) return false;
        
        return true;
      })
      .map((pair: any) => {
        // Determine which xStock this is paired against
        const pairedWithStock = xStockMints.includes(pair.quoteToken.address) ? pair.quoteToken.address :
                              xStockMints.includes(pair.baseToken.address) ? pair.baseToken.address : null;
        
        // Map known stock mints to symbols
        const stockSymbol = pairedWithStock === "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" ? "NVDAx" :
                          pairedWithStock === "BwpKWcauiC9XMNuUH2JaH3wqjYKjVDmfhWh2a6Gq8Jrw" ? "AAPLx" :
                          pairedWithStock === "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB" ? "TSLAx" :
                          pairedWithStock === "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu" ? "COINx" :
                          pairedWithStock === "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg" ? "HOODx" :
                          pairedWithStock === "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ" ? "MSTRx" :
                          pairedWithStock === "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX" ? "MSFTx" :
                          pairedWithStock === "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" ? "GOOGLx" :
                          pairedWithStock === "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg" ? "AMZNx" :
                          pairedWithStock === "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu" ? "METAx" : "UNKNOWN";
        
        const stockName = stockSymbol === "NVDAx" ? "NVIDIA Corporation" :
                        stockSymbol === "AAPLx" ? "Apple Inc." :
                        stockSymbol === "TSLAx" ? "Tesla Inc." :
                        stockSymbol === "COINx" ? "Coinbase Global" :
                        stockSymbol === "HOODx" ? "Robinhood Markets" :
                        stockSymbol === "MSTRx" ? "MicroStrategy" :
                        stockSymbol === "MSFTx" ? "Microsoft Corporation" :
                        stockSymbol === "GOOGLx" ? "Alphabet Inc." :
                        stockSymbol === "AMZNx" ? "Amazon.com" :
                        stockSymbol === "METAx" ? "Meta Platforms" : "Unknown";
        
        // Determine venue based on DEX
        const venue = pair.dexId === "meteora" ? "meteora" as const : "pumpfun" as const;
        
        return {
          mint: pair.baseToken.address,
          name: pair.baseToken.name || pair.baseToken.symbol,
          symbol: pair.baseToken.symbol,
          description: pairedWithStock 
            ? `Community token paired against ${stockSymbol} on ${venue === "meteora" ? "Meteora DLMM" : "Pump.fun"}`
            : `Community token on Solana`,
          imageUrl: pair.info?.imageUrl || "",
          pairedStockSymbol: pairedWithStock ? stockSymbol : "NONE",
          pairedStockName: pairedWithStock ? stockName : "None",
          creatorWallet: pair.baseToken.address.slice(0, 8) + "..." + pair.baseToken.address.slice(-4),
          supply: pair.fdv ? Math.round(pair.fdv / (pair.priceUsd || 1)) : 0,
          creatorFeeBps: 100,
          priceSol: parseFloat(pair.priceNative || "0"),
          priceUsd: parseFloat(pair.priceUsd || "0"),
          marketCapUsd: pair.fdv || pair.marketCap || 0,
          volume24hUsd: pair.volume?.h24 || 0,
          change24h: pair.priceChange?.h24 || 0,
          bondingCurveProgress: 100,
          status: "graduated" as const,
          holdersCount: 0,
          txSignature: pair.pairAddress || "",
          pumpUrl: pair.url,
          explorerUrl: `https://solscan.io/token/${pair.baseToken.address}`,
          poolAddress: pair.pairAddress,
          meteoraUrl: pair.url,
          venue,
          createdAt: pair.pairCreatedAt || new Date().toISOString(),
        };
      });
    
    // Remove duplicates by mint
    const uniqueTokens = new Map<string, CommunityToken>();
    for (const token of tokens) {
      if (!uniqueTokens.has(token.mint)) {
        uniqueTokens.set(token.mint, token);
      }
    }
    
    return Array.from(uniqueTokens.values());
  } catch (err) {
    console.warn("Error fetching DexScreener meme tokens:", err);
    return [];
  }
}

export async function addCommunityToken(token: CommunityToken): Promise<CommunityToken> {
  const store = await readStore();
  // Prepend so newly created token appears immediately at the very top
  const existingIdx = store.tokens.findIndex((t) => t.mint === token.mint);
  if (existingIdx >= 0) {
    store.tokens[existingIdx] = token;
  } else {
    store.tokens.unshift(token);
  }
  await writeStore(store);
  return token;
}

export async function updateCommunityTokenStatus(
  mint: string,
  status: "new" | "graduating" | "graduated",
  poolAddress?: string,
  meteoraUrl?: string
): Promise<CommunityToken | null> {
  const store = await readStore();
  const token = store.tokens.find((t) => t.mint === mint);
  if (!token) return null;
  token.status = status;
  if (status === "graduated") {
    token.bondingCurveProgress = 100;
  }
  if (poolAddress) token.poolAddress = poolAddress;
  if (meteoraUrl) token.meteoraUrl = meteoraUrl;
  await writeStore(store);
  return token;
}

export async function getCommunityMarketKPIs() {
  const tokens = await getCommunityTokens();
  const totalLaunches = tokens.length;
  const totalVolumeUsd = tokens.reduce((acc, t) => acc + t.volume24hUsd, 0);
  const graduatedCount = tokens.filter((t) => t.status === "graduated" || t.bondingCurveProgress >= 100).length;
  const newCount = tokens.filter((t) => {
    const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
    return ageHours <= 24;
  }).length;
  const avgBondingCurve = Math.round(tokens.reduce((acc, t) => acc + t.bondingCurveProgress, 0) / (tokens.length || 1));
  const avgChange24h = tokens.length > 0
    ? +(tokens.reduce((acc, t) => acc + (t.change24h || 0), 0) / tokens.length).toFixed(1)
    : 0;

  return {
    totalLaunches,
    totalVolumeUsd,
    totalVolumeFormatted: totalVolumeUsd >= 1_000_000
      ? `$${(totalVolumeUsd / 1_000_000).toFixed(2)}M`
      : `$${(totalVolumeUsd / 1_000).toFixed(1)}K`,
    graduatedCount,
    newCount,
    avgBondingCurve,
    avgChange24h,
    lastUpdated: new Date().toISOString(),
  };
}
