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
  platformFeeBps?: number; // Platform surcharge fee
  totalFeeBps?: number; // Total fee (creator + platform)
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
  platformTreasury?: string; // Treasury wallet that receives platform fees
  isStale?: boolean;
  marketStatus?: "live" | "stale" | "unlisted";
};

export { formatTokenPrice, formatTokenVolume } from "./community-token-utils";

import curatedPairs from "./solana-curated-25.json";

// Real on-chain Solana tokens paired against tokenized equities (xStocks)
export const SEED_COMMUNITY_TOKENS: CommunityToken[] = [
  {
    mint: "8dJpCw1JurBZQGNeYwqVJkqs3DTjtYW5wcFXzCpmpump",
    name: "Uber Eats",
    symbol: "EATS",
    description: "Community token paired directly against Uber xStock (UBERx) on Solana via Pump.fun.",
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/UBERx.png",
    pairedStockSymbol: "UBERx",
    pairedStockName: "Uber Technologies",
    creatorWallet: "7neX...fBbA",
    supply: 1_000_000_000,
    creatorFeeBps: 100, // 1%
    priceSol: 0.0000000547,
    priceUsd: 0,
    marketCapUsd: 0,
    volume24hUsd: 0,
    change24h: 0,
    bondingCurveProgress: 0.5,
    status: "new",
    holdersCount: 1,
    txSignature: "7neXyY8xuQ3NBqkYzRtXPxR7PQXE7sq6jYKRoRFTfBbA",
    pumpUrl: "https://pump.fun/coin/8dJpCw1JurBZQGNeYwqVJkqs3DTjtYW5wcFXzCpmpump",
    explorerUrl: "https://solscan.io/token/8dJpCw1JurBZQGNeYwqVJkqs3DTjtYW5wcFXzCpmpump",
    poolAddress: "7neXyY8xuQ3NBqkYzRtXPxR7PQXE7sq6jYKRoRFTfBbA",
    venue: "pumpfun",
    createdAt: "2026-09-09T22:33:23.000Z",
  },
];

type CommunityTokenStore = {
  version: 1;
  tokens: CommunityToken[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "community-tokens.json");

const MOCK_MINTS = new Set([
  "A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
  "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb",
  "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp",
  "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
  "BgCeigJo2iY3dJhqS2z9w4pjjufFd4F9oKS3FrkMbmbJ",
  "ByCds9p6tXfF5HEg6aJDdrEypCWTi7Jui5nLs7QbyYuw",
  "6oxWqT3Pkt97NEVDvthztC59vTGxSwSmsTL6eFFLoBGu",
  "3JUj6ZdRreqNH5gkdL2dZWn477kB97NxdkqSv2GeXWG9",
]);

async function readStore(): Promise<CommunityTokenStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as Partial<CommunityTokenStore>;
    if (Array.isArray(data.tokens) && data.tokens.length > 0) {
      // Purge legacy mock/demo tokens so only authentic on-chain tokens are stored
      const realTokens = data.tokens.filter(
        (t) =>
          !MOCK_MINTS.has(t.mint) &&
          !t.mint.startsWith("Compute7b") &&
          !t.mint.startsWith("CyberXs")
      );
      if (realTokens.length > 0) {
        return { version: 1, tokens: realTokens };
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
            quoteToken?: { address?: string };
            priceUsd?: string;
            priceNative?: string;
            volume?: { h24?: number };
            priceChange?: { h24?: number };
            marketCap?: number;
            fdv?: number;
          };
          const pairs: DexScreenerPair[] = Array.isArray(json?.pairs) ? json.pairs : [];

          const stockMintsSet = new Set(
            Object.values(curatedPairs).map((c: any) => c.mint)
          );

          for (const pair of pairs) {
            const baseAddress = pair.baseToken?.address;
            const quoteAddress = pair.quoteToken?.address;
            if (!baseAddress) continue;

            // Only count pair volume if the pool is directly paired against a tokenized equity
            const isStockPaired = stockMintsSet.has(quoteAddress ?? "") || stockMintsSet.has(baseAddress);
            const pUsd = parseFloat(pair.priceUsd ?? "") || 0;
            const pSol = parseFloat(pair.priceNative ?? "") || 0;
            const vol = isStockPaired && typeof pair.volume?.h24 === "number" ? Math.round(pair.volume.h24) : 0;
            const chg = typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : 0;
            const mcap = pair.marketCap || pair.fdv || 0;

            const existing = lastGoodLiveCache.get(baseAddress);
            if (!existing || vol >= existing.volume24hUsd) {
              lastGoodLiveCache.set(baseAddress, {
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
    const stockEntries = Object.values(curatedPairs) as { symbol: string; name: string; mint: string }[];
    const stockMap = new Map<string, { symbol: string; name: string }>();
    for (const entry of stockEntries) {
      if (entry?.mint) {
        stockMap.set(entry.mint, { symbol: entry.symbol, name: entry.name });
      }
    }

    const commonMints = new Set([
      "So11111111111111111111111111111111111111112", // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
      "USDXv8nTu9GsrU4y5q7gJzZk8C9R7f7Yk3G4r2z8L4w", // USDX
      "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
      "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // WBTC
      "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", // cbBTC
    ]);

    // Active stock mints to query for paired community tokens
    const queryMints = [
      stockMap.get("XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg") ? "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg" : "", // HOODx
      stockMap.get("XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1") ? "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1" : "", // CRCLx
      stockMap.get("Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re") ? "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re" : "", // GLDx
      stockMap.get("XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo") ? "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo" : "", // AVGOx
      stockMap.get("XsAsZLF4MmsvS1sDxRMrUz7REjHfwbC9UAMXSRBqgEB") ? "XsAsZLF4MmsvS1sDxRMrUz7REjHfwbC9UAMXSRBqgEB" : "", // UBERx
      stockMap.get("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh") ? "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" : "", // NVDAx
      stockMap.get("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp") ? "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" : "", // AAPLx
    ].filter(Boolean);

    const allPairs: any[] = [];
    await Promise.all(
      queryMints.map(async (mint) => {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.pairs)) {
              allPairs.push(...data.pairs);
            }
          }
        } catch {
          // ignore individual timeout
        }
      })
    );

    const tokens: CommunityToken[] = [];
    const seenMints = new Set<string>();

    for (const pair of allPairs) {
      if (pair.chainId !== "solana") continue;
      const baseAddr = pair.baseToken?.address;
      const quoteAddr = pair.quoteToken?.address;
      if (!baseAddr || !quoteAddr) continue;

      let stockMeta: { symbol: string; name: string } | null = null;
      let memeToken: any = null;

      if (stockMap.has(quoteAddr) && !stockMap.has(baseAddr) && !commonMints.has(baseAddr)) {
        stockMeta = stockMap.get(quoteAddr)!;
        memeToken = pair.baseToken;
      } else if (stockMap.has(baseAddr) && !stockMap.has(quoteAddr) && !commonMints.has(quoteAddr)) {
        stockMeta = stockMap.get(baseAddr)!;
        memeToken = pair.quoteToken;
      }

      if (!stockMeta || !memeToken || seenMints.has(memeToken.address)) continue;
      seenMints.add(memeToken.address);

      const venue = pair.dexId === "meteora" ? ("meteora" as const) : ("pumpfun" as const);
      const pUsd = parseFloat(pair.priceUsd || "0");
      const pSol = parseFloat(pair.priceNative || "0");
      const vol = typeof pair.volume?.h24 === "number" ? Math.round(pair.volume.h24) : 0;
      const mcap = pair.marketCap || pair.fdv || 0;

      tokens.push({
        mint: memeToken.address,
        name: memeToken.name || memeToken.symbol || "Community Token",
        symbol: memeToken.symbol || "MEME",
        description: `Community token paired against ${stockMeta.symbol} on ${venue === "meteora" ? "Meteora DLMM" : "Pump.fun"}.`,
        imageUrl: pair.info?.imageUrl || "",
        pairedStockSymbol: stockMeta.symbol,
        pairedStockName: stockMeta.name,
        creatorWallet: memeToken.address.slice(0, 8) + "..." + memeToken.address.slice(-4),
        supply: pair.fdv && pUsd > 0 ? Math.round(pair.fdv / pUsd) : 1_000_000_000,
        creatorFeeBps: 100,
        priceSol: pSol,
        priceUsd: pUsd,
        marketCapUsd: mcap,
        volume24hUsd: vol,
        change24h: typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : 0,
        bondingCurveProgress: 100,
        status: "graduated" as const,
        holdersCount: 0,
        txSignature: pair.pairAddress || "",
        pumpUrl: pair.url || `https://solscan.io/token/${memeToken.address}`,
        explorerUrl: `https://solscan.io/token/${memeToken.address}`,
        poolAddress: pair.pairAddress,
        meteoraUrl: pair.dexId === "meteora" ? pair.url : undefined,
        venue,
        createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date().toISOString(),
      });
    }

    return tokens;
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
