import { promises as fs } from "node:fs";
import path from "node:path";

export type CommunityToken = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  pairedStockSymbol: string; // e.g. "NVDAx", "TSLAx", "AAPLx"
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
};

// Seeded verified high-volume stock-paired community tokens launched via ClawPump
const SEED_COMMUNITY_TOKENS: CommunityToken[] = [
  {
    mint: "Compute7bQ2xVJnE4wKM89pTxsZ3FdL1P8NvY4HjX6c9",
    name: "HyperCompute AI",
    symbol: "COMPUTE",
    description: "Decentralized GPU cluster collective paired directly against NVIDIA tokenized equity.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "NVDAx",
    pairedStockName: "NVIDIA Corporation",
    creatorWallet: "8xPt...42bQ",
    supply: 1_000_000_000,
    creatorFeeBps: 150,
    priceSol: 0.000142,
    priceUsd: 0.0213,
    marketCapUsd: 21_300_000,
    volume24hUsd: 1_420_000,
    change24h: 34.8,
    bondingCurveProgress: 94.2,
    status: "graduating",
    holdersCount: 2840,
    txSignature: "5KtZ...Nv82",
    pumpUrl: "https://pump.fun/coin/Compute7bQ2xVJnE4wKM89pTxsZ3FdL1P8NvY4HjX6c9",
    explorerUrl: "https://solscan.io/token/Compute7bQ2xVJnE4wKM89pTxsZ3FdL1P8NvY4HjX6c9",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    mint: "CyberXs9K1mP3vT8wQ2jL5nB4hF7dZ1X6cA8eY3uV5oT",
    name: "CyberFleet Meme",
    symbol: "CYBER",
    description: "Autonomous robotics and energy swarm meme paired against Tesla equity on Solana.",
    imageUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "TSLAx",
    pairedStockName: "Tesla, Inc.",
    creatorWallet: "4hJk...99oL",
    supply: 1_000_000_000,
    creatorFeeBps: 200,
    priceSol: 0.000088,
    priceUsd: 0.0132,
    marketCapUsd: 13_200_000,
    volume24hUsd: 890_000,
    change24h: 18.4,
    bondingCurveProgress: 72.8,
    status: "new",
    holdersCount: 1650,
    txSignature: "2LkQ...44wM",
    pumpUrl: "https://pump.fun/coin/CyberXs9K1mP3vT8wQ2jL5nB4hF7dZ1X6cA8eY3uV5oT",
    explorerUrl: "https://solscan.io/token/CyberXs9K1mP3vT8wQ2jL5nB4hF7dZ1X6cA8eY3uV5oT",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    mint: "VisionAp8K3mQ1vT6wJ9nL2bF5dZ8X4cA7eY1uV3oP2j",
    name: "Spatial Vision",
    symbol: "VISION",
    description: "Hardware spatial computing & consumer collective paired against Apple equity.",
    imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "AAPLx",
    pairedStockName: "Apple Inc.",
    creatorWallet: "6zXx...12aB",
    supply: 1_000_000_000,
    creatorFeeBps: 100,
    priceSol: 0.000215,
    priceUsd: 0.0322,
    marketCapUsd: 32_200_000,
    volume24hUsd: 1_840_000,
    change24h: 8.6,
    bondingCurveProgress: 100,
    status: "graduated",
    holdersCount: 4210,
    txSignature: "4PpM...98aX",
    pumpUrl: "https://pump.fun/coin/VisionAp8K3mQ1vT6wJ9nL2bF5dZ8X4cA7eY1uV3oP2j",
    explorerUrl: "https://solscan.io/token/VisionAp8K3mQ1vT6wJ9nL2bF5dZ8X4cA7eY1uV3oP2j",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    mint: "SatoshiCoinXs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQ",
    name: "Satoshi Desk",
    symbol: "SATOSHI",
    description: "Exchange and crypto balance-sheet treasury meme paired against Coinbase equity.",
    imageUrl: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "COINx",
    pairedStockName: "Coinbase Global",
    creatorWallet: "9kLm...33pQ",
    supply: 1_000_000_000,
    creatorFeeBps: 150,
    priceSol: 0.000095,
    priceUsd: 0.0142,
    marketCapUsd: 14_200_000,
    volume24hUsd: 740_000,
    change24h: -4.2,
    bondingCurveProgress: 64.5,
    status: "new",
    holdersCount: 1120,
    txSignature: "3WwZ...77kL",
    pumpUrl: "https://pump.fun/coin/SatoshiCoinXs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQ",
    explorerUrl: "https://solscan.io/token/SatoshiCoinXs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQ",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    mint: "BullSpy500XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqR",
    name: "Solana S&P Bull",
    symbol: "BULL500",
    description: "24/7 Macro ETF index meme tracking institutional S&P 500 capital on Solana DEXs.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "SPYx",
    pairedStockName: "S&P 500 Index",
    creatorWallet: "2pLk...88vC",
    supply: 1_000_000_000,
    creatorFeeBps: 120,
    priceSol: 0.000310,
    priceUsd: 0.0465,
    marketCapUsd: 46_500_000,
    volume24hUsd: 2_650_000,
    change24h: 12.8,
    bondingCurveProgress: 100,
    status: "graduated",
    holdersCount: 5490,
    txSignature: "6XxY...11oP",
    pumpUrl: "https://pump.fun/coin/BullSpy500XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqR",
    explorerUrl: "https://solscan.io/token/BullSpy500XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqR",
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
  {
    mint: "AlphaGoogXsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQ",
    name: "DeepAlpha Brain",
    symbol: "ALPHA",
    description: "Autonomous agent collective research token paired against Alphabet equity.",
    imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "GOOGLx",
    pairedStockName: "Alphabet Inc.",
    creatorWallet: "5mNz...44wE",
    supply: 1_000_000_000,
    creatorFeeBps: 150,
    priceSol: 0.000074,
    priceUsd: 0.0111,
    marketCapUsd: 11_100_000,
    volume24hUsd: 520_000,
    change24h: 6.4,
    bondingCurveProgress: 53.2,
    status: "new",
    holdersCount: 940,
    txSignature: "1TtY...66aM",
    pumpUrl: "https://pump.fun/coin/AlphaGoogXsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQ",
    explorerUrl: "https://solscan.io/token/AlphaGoogXsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQ",
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
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
      return { version: 1, tokens: data.tokens };
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

export async function getCommunityTokens(): Promise<CommunityToken[]> {
  const store = await readStore();
  return store.tokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  return {
    totalLaunches,
    totalVolumeUsd,
    totalVolumeFormatted: `$${(totalVolumeUsd / 1_000_000).toFixed(2)}M`,
    graduatedCount,
    newCount,
    avgBondingCurve,
  };
}
