import { readJson, writeJson } from "@/lib/json-store";
import { queryOnChainDbcProgress } from "@/lib/meteora-dbc";
import curatedPairs from "./solana-curated-25.json";

export type CommunityToken = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  pairedStockSymbol: string; // e.g. "AAPLx", "NVDAx", "CRCLx"
  pairedStockName: string;
  /** Launch wallet for OpenStock launches. Empty for discovered pools (creator unknown). */
  creatorWallet: string;
  supply: number;
  creatorFeeBps: number;
  priceSol: number;
  /** Price of one token denominated in the paired xStock (0 when unknown). */
  priceInPairedStock?: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24h: number;
  /** 0–100. Only meaningful when progressKnown is true. */
  bondingCurveProgress: number;
  progressKnown?: boolean;
  status: "new" | "graduating" | "graduated";
  /** 0 when not measured. */
  holdersCount: number;
  txSignature: string;
  pumpUrl: string;
  explorerUrl: string;
  createdAt: string;
  poolAddress?: string;
  meteoraUrl?: string;
  venue?: "pumpfun" | "meteora" | "other";
  /** DexScreener dex id of the tracked pool (pumpfun, pumpswap, meteora, raydium, …). */
  dexId?: string;
  /** "openstock" = launched through OpenStock; "discovered" = an existing pool found on DexScreener. */
  source?: "openstock" | "discovered";
  isStale?: boolean;
  marketStatus?: "live" | "stale" | "unlisted";
};

export { formatTokenPrice, formatTokenVolume, isLookalikeTicker } from "./community-token-utils";

type CommunityTokenStore = { version: 2; tokens: CommunityToken[] };

type CuratedPair = { symbol: string; name: string; mint: string };
const STOCKS = new Map<string, CuratedPair>(
  (Object.values(curatedPairs) as CuratedPair[]).filter((entry) => entry?.mint).map((entry) => [entry.mint, entry])
);

/** Entries older builds wrote as seed/demo data. They were never launched through OpenStock. */
const LEGACY_NON_LAUNCH_MINTS = new Set([
  "8dJpCw1JurBZQGNeYwqVJkqs3DTjtYW5wcFXzCpmpump", // hardcoded "EATS" seed
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
  const data = await readJson<CommunityTokenStore>("community-tokens");
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
  return {
    version: 2,
    tokens: tokens.filter(
      (t) => t?.mint && !LEGACY_NON_LAUNCH_MINTS.has(t.mint) && !t.mint.startsWith("Compute7b") && !t.mint.startsWith("CyberXs")
    ),
  };
}

async function readStoreSafe(): Promise<CommunityTokenStore> {
  try {
    return await readStore();
  } catch (err) {
    console.warn("Community token registry unavailable:", err instanceof Error ? err.message : err);
    return { version: 2, tokens: [] };
  }
}

// ---------------------------------------------------------------------------
// DexScreener
// ---------------------------------------------------------------------------

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  labels?: string[];
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceNative?: string;
  priceUsd?: string;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
};

const DEXSCREENER_BATCH = 30; // documented max addresses per /tokens request

async function fetchPairsForMints(mints: string[]): Promise<DexPair[]> {
  const pairs: DexPair[] = [];
  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += DEXSCREENER_BATCH) batches.push(mints.slice(i, i + DEXSCREENER_BATCH));
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(6000),
          next: { revalidate: 30 },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { pairs?: DexPair[] };
        if (Array.isArray(data.pairs)) pairs.push(...data.pairs.filter((pair) => pair.chainId === "solana"));
      } catch {
        // A failed batch leaves those tokens unlisted — never invented.
      }
    })
  );
  return pairs;
}

/** Quote/base assets that form the stock's own markets — never a "community token". */
const BASE_ASSETS = new Set([
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
  "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB", // USD1
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // WBTC
  "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", // cbBTC
]);

/** Which side of a DexScreener pair is the token, and which is its xStock. */
function orient(pair: DexPair, tokenMint?: string) {
  const base = pair.baseToken?.address;
  const quote = pair.quoteToken?.address;
  if (!base || !quote) return null;
  if (BASE_ASSETS.has(base) || BASE_ASSETS.has(quote)) return null;
  if (STOCKS.has(quote) && !STOCKS.has(base) && (!tokenMint || tokenMint === base)) {
    return { token: pair.baseToken!, stock: STOCKS.get(quote)!, tokenIsBase: true };
  }
  if (STOCKS.has(base) && !STOCKS.has(quote) && (!tokenMint || tokenMint === quote)) {
    return { token: pair.quoteToken!, stock: STOCKS.get(base)!, tokenIsBase: false };
  }
  return null;
}

/** DexScreener prices the BASE token. Convert to the token's own price when the token is the quote side. */
function tokenPrices(pair: DexPair, tokenIsBase: boolean) {
  const baseUsd = parseFloat(pair.priceUsd ?? "") || 0;
  const baseInQuote = parseFloat(pair.priceNative ?? "") || 0;
  if (tokenIsBase) return { priceUsd: baseUsd, priceInStock: baseInQuote };
  if (baseUsd <= 0 || baseInQuote <= 0) return { priceUsd: 0, priceInStock: 0 };
  return { priceUsd: baseUsd / baseInQuote, priceInStock: 1 / baseInQuote };
}

function isCurvePool(pair: DexPair) {
  return pair.dexId === "pumpfun" || (pair.labels ?? []).some((label) => /dbc|bonding/i.test(label));
}

function venueFor(dexId?: string): CommunityToken["venue"] {
  if (dexId === "pumpfun" || dexId === "pumpswap") return "pumpfun";
  if (dexId === "meteora") return "meteora";
  return "other";
}

const DISCOVERY_STOCKS = [
  "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", // HOODx
  "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", // CRCLx
  "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", // GLDx
  "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo", // AVGOx
  "XsAsZLF4MmsvS1sDxRMrUz7REjHfwbC9UAMXSRBqgEB", // UBERx
  "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", // NVDAx
  "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", // AAPLx
].filter((mint) => STOCKS.has(mint));

/** Existing pools on DexScreener where some token trades directly against an xStock. Not OpenStock launches. */
async function discoverStockPairedPools(): Promise<CommunityToken[]> {
  // One request per stock: DexScreener caps each /tokens response at 30 pairs in total, not per address.
  const pairs = (await Promise.all(DISCOVERY_STOCKS.map((mint) => fetchPairsForMints([mint])))).flat();
  const tokens: CommunityToken[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const side = orient(pair);
    if (!side?.token.address || seen.has(side.token.address)) continue;
    seen.add(side.token.address);
    const { priceUsd, priceInStock } = tokenPrices(pair, side.tokenIsBase);
    const onCurve = isCurvePool(pair);
    tokens.push({
      mint: side.token.address,
      name: side.token.name || side.token.symbol || "Unknown token",
      symbol: side.token.symbol || "?",
      description: `Existing ${pair.dexId ?? "DEX"} pool trading against ${side.stock.symbol}. Discovered on DexScreener.`,
      imageUrl: side.tokenIsBase ? pair.info?.imageUrl || "" : "",
      pairedStockSymbol: side.stock.symbol,
      pairedStockName: side.stock.name.replace(/ xStock$/, ""),
      creatorWallet: "",
      supply: 0,
      creatorFeeBps: 0,
      priceSol: 0,
      priceInPairedStock: priceInStock,
      priceUsd,
      marketCapUsd: side.tokenIsBase ? pair.marketCap || pair.fdv || 0 : 0,
      volume24hUsd: typeof pair.volume?.h24 === "number" ? Math.round(pair.volume.h24) : 0,
      change24h: side.tokenIsBase && typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : 0,
      bondingCurveProgress: onCurve ? 0 : 100,
      progressKnown: !onCurve,
      status: onCurve ? "new" : "graduated",
      holdersCount: 0,
      txSignature: "",
      pumpUrl: pair.url || `https://dexscreener.com/solana/${pair.pairAddress}`,
      explorerUrl: `https://solscan.io/token/${side.token.address}`,
      poolAddress: pair.pairAddress,
      meteoraUrl: pair.dexId === "meteora" ? pair.url : undefined,
      venue: venueFor(pair.dexId),
      dexId: pair.dexId,
      source: "discovered",
      marketStatus: "live",
      createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date(0).toISOString(),
    });
  }
  return tokens;
}

/** Live price/volume for OpenStock-launched tokens, taken only from pools paired against their own xStock. */
async function enrichLaunchedTokens(tokens: CommunityToken[]): Promise<CommunityToken[]> {
  if (tokens.length === 0) return tokens;
  const pairs = await fetchPairsForMints(tokens.map((token) => token.mint));
  return tokens.map((token) => {
    const matches = pairs
      .map((pair) => ({ pair, side: orient(pair, token.mint) }))
      .filter((entry) => entry.side && entry.side.stock.symbol === token.pairedStockSymbol)
      .sort((a, b) => (b.pair.volume?.h24 ?? 0) - (a.pair.volume?.h24 ?? 0));
    const best = matches[0];
    if (!best?.side) return { ...token, volume24hUsd: 0, change24h: 0, marketStatus: "unlisted" as const };
    const { priceUsd, priceInStock } = tokenPrices(best.pair, best.side.tokenIsBase);
    const graduated = !isCurvePool(best.pair);
    return {
      ...token,
      priceUsd: priceUsd || token.priceUsd,
      priceInPairedStock: priceInStock || token.priceInPairedStock,
      volume24hUsd: matches.reduce((sum, entry) => sum + (entry.pair.volume?.h24 ?? 0), 0),
      change24h: best.side.tokenIsBase ? best.pair.priceChange?.h24 ?? 0 : token.change24h,
      marketCapUsd: best.side.tokenIsBase ? best.pair.marketCap || best.pair.fdv || 0 : token.marketCapUsd,
      status: graduated ? "graduated" : token.status,
      bondingCurveProgress: graduated ? 100 : token.bondingCurveProgress,
      progressKnown: graduated ? true : token.progressKnown,
      dexId: best.pair.dexId,
      marketStatus: "live" as const,
    };
  });
}

let listCache: { at: number; tokens: CommunityToken[] } | null = null;
const LIST_TTL_MS = 20_000;

/** On-chain curve progress for OpenStock Meteora DBC launches that have not migrated yet. */
async function measureDbcProgress(tokens: CommunityToken[]): Promise<CommunityToken[]> {
  return Promise.all(
    tokens.map(async (token) => {
      if (token.venue !== "meteora" || token.status === "graduated" || !token.poolAddress) return token;
      const progress = await queryOnChainDbcProgress(token.poolAddress);
      if (progress === null) return token;
      const pct = Math.max(0, Math.min(100, progress));
      return { ...token, bondingCurveProgress: pct, progressKnown: true, status: pct >= 70 ? ("graduating" as const) : token.status };
    })
  );
}

export async function getCommunityTokens(): Promise<CommunityToken[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.tokens;
  const store = await readStoreSafe();
  const launched = store.tokens.map((token) => ({ ...token, source: "openstock" as const }));
  const [enrichedLaunched, discovered] = await Promise.all([
    enrichLaunchedTokens(launched).then(measureDbcProgress).catch(() => launched),
    discoverStockPairedPools().catch(() => [] as CommunityToken[]),
  ]);
  const launchedMints = new Set(enrichedLaunched.map((token) => token.mint));
  const byNewest = (a: CommunityToken, b: CommunityToken) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const tokens = [
    ...enrichedLaunched.sort(byNewest),
    ...discovered.filter((token) => !launchedMints.has(token.mint)).sort(byNewest),
  ];
  listCache = { at: Date.now(), tokens };
  return tokens;
}

/** Throws StoreUnavailableError when the registry cannot be written — callers must surface that. */
export async function addCommunityToken(token: CommunityToken): Promise<CommunityToken> {
  const store = await readStore();
  const record = { ...token, source: "openstock" as const };
  const existingIdx = store.tokens.findIndex((t) => t.mint === token.mint);
  if (existingIdx >= 0) store.tokens[existingIdx] = record;
  else store.tokens.unshift(record);
  await writeJson("community-tokens", store);
  listCache = null;
  return record;
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
    token.progressKnown = true;
  }
  if (poolAddress) token.poolAddress = poolAddress;
  if (meteoraUrl) token.meteoraUrl = meteoraUrl;
  await writeJson("community-tokens", store);
  listCache = null;
  return token;
}

export async function getCommunityMarketKPIs() {
  const tokens = await getCommunityTokens();
  const launched = tokens.filter((t) => t.source === "openstock");
  const totalVolumeUsd = tokens.reduce((acc, t) => acc + t.volume24hUsd, 0);
  return {
    launchedCount: launched.length,
    discoveredCount: tokens.length - launched.length,
    totalPools: tokens.length,
    totalVolumeUsd,
    totalVolumeFormatted:
      totalVolumeUsd >= 1_000_000 ? `$${(totalVolumeUsd / 1_000_000).toFixed(2)}M` : `$${(totalVolumeUsd / 1_000).toFixed(1)}K`,
    ammPoolCount: tokens.filter((t) => t.status === "graduated").length,
    newCount: tokens.filter((t) => Date.now() - new Date(t.createdAt).getTime() <= 24 * 3600_000).length,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getCommunityTokenByMint(mint: string): Promise<CommunityToken | null> {
  if (!mint) return null;
  const tokens = await getCommunityTokens();
  const cleanMint = mint.trim();
  return tokens.find((t) => t.mint === cleanMint) ?? null;
}
