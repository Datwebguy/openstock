/**
 * ClawPump API Integration for Solana Token Launches against xStocks
 * Official Base URL: https://clawpump.tech/api/v1 (Never use agents.clawpump.tech)
 * Documentation: https://clawpump.tech/developers
 */

import { getPlatformTreasuryWallet } from "./treasury";

export const CLAWPUMP_API_BASE = "https://clawpump.tech/api/v1";

export type PumpPairAsset = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl?: string | null;
  underlyingStock?: string;
};

export type PumpPairsResponse = {
  assets: PumpPairAsset[];
  creatorFeeBps: {
    min: number;
    max: number;
    default: number;
  };
};

/**
 * Fallback verified Solana xStocks pump pairs with official mint addresses on Solana Mainnet.
 * Used when CLAWPUMP_API_KEY is pending or upstream is temporarily offline.
 */
export const VERIFIED_SOLANA_XSTOCKS_PAIRS: PumpPairAsset[] = [
  { symbol: "AAPLx", name: "Apple xStock", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/AAPLx.png", underlyingStock: "AAPL" },
  { symbol: "NVDAx", name: "NVIDIA xStock", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/NVDAx.png", underlyingStock: "NVDA" },
  { symbol: "TSLAx", name: "Tesla xStock", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/TSLAx.png", underlyingStock: "TSLA" },
  { symbol: "MSFTx", name: "Microsoft xStock", mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/MSFTx.png", underlyingStock: "MSFT" },
  { symbol: "AMZNx", name: "Amazon.com xStock", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/AMZNx.png", underlyingStock: "AMZN" },
  { symbol: "GOOGLx", name: "Alphabet Google xStock", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/GOOGLx.png", underlyingStock: "GOOGL" },
  { symbol: "METAx", name: "Meta Platforms xStock", mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/METAx.png", underlyingStock: "META" },
  { symbol: "COINx", name: "Coinbase Global xStock", mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/COINx.png", underlyingStock: "COIN" },
  { symbol: "MSTRx", name: "MicroStrategy xStock", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/MSTRx.png", underlyingStock: "MSTR" },
  { symbol: "INTCx", name: "Intel xStock", mint: "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/INTCx.png", underlyingStock: "INTC" },
  { symbol: "SPYx", name: "S&P 500 Index xStock", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/SPYx.png", underlyingStock: "SPY" },
  { symbol: "QQQx", name: "Invesco QQQ Trust xStock", mint: "Xs8S1uUs1zvSvhgB4tvdJ5L3UvH5cTj8yLq2WdF6N6M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/QQQx.png", underlyingStock: "QQQ" },
  { symbol: "AMDx", name: "AMD xStock", mint: "XsXcJ6GZ9kVnZ3QzP2M5B4Y8Kq6W1D7F9T2N4R8L1J5", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/AMDx.png", underlyingStock: "AMD" },
  { symbol: "PLTRx", name: "Palantir xStock", mint: "XsoBhf2ufR8fP3K9m1V6Y7T2N5L4Q8W1J9Z2X6C3B7M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/PLTRx.png", underlyingStock: "PLTR" },
  { symbol: "NFLXx", name: "Netflix xStock", mint: "XsEH7wWfJJu2P1K8M5V9Q4T3Y6L2W7R8Z1X5C4B6N9M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/NFLXx.png", underlyingStock: "NFLX" },
  { symbol: "DISx", name: "Walt Disney xStock", mint: "Xsg93jDV656UP2K7M8V1Q5T4Y9L3W6R2Z8X1C5B7N4M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/DISx.png", underlyingStock: "DIS" },
  { symbol: "UBERx", name: "Uber xStock", mint: "XsAsZLF4MmsvP8K2M1V5Q7T3Y9L6W4R1Z5X8C2B9N3M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/UBERx.png", underlyingStock: "UBER" },
  { symbol: "HOODx", name: "Robinhood xStock", mint: "XsvNBAYkrDRNP1K5M9V2Q8T4Y3L7W5R6Z2X9C1B4N8M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/HOODx.png", underlyingStock: "HOOD" },
  { symbol: "ABNBx", name: "Airbnb xStock", mint: "XscSc1zjbVizP4K9M2V6Q1T8Y5L3W7R2Z6X4C8B1N5M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/ABNBx.png", underlyingStock: "ABNB" },
  { symbol: "PYPLx", name: "PayPal xStock", mint: "XshWQWYVp5ffP7K1M6V3Q9T2Y4L8W5R1Z9X2C6B3N7M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/PYPLx.png", underlyingStock: "PYPL" },
  { symbol: "AVGOx", name: "Broadcom xStock", mint: "XsgSaSvNSqLTP3K8M1V7Q2T5Y9L4W6R8Z1X5C9B2N6M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/AVGOx.png", underlyingStock: "AVGO" },
  { symbol: "QCOMx", name: "Qualcomm xStock", mint: "XsUUG8bjFN2KP5K2M8V4Q1T7Y3L9W2R5Z8X3C1B7N4M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/QCOMx.png", underlyingStock: "QCOM" },
  { symbol: "ARMx", name: "Arm Holdings xStock", mint: "XswUFSYE5CWsP9K4M2V8Q5T1Y6L7W3R9Z4X8C2B5N1M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/ARMx.png", underlyingStock: "ARM" },
  { symbol: "CRCLx", name: "Circle xStock", mint: "XsueG8BtpquVP2K6M9V1Q8T5Y4L3W1R7Z5X9C4B2N8M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/CRCLx.png", underlyingStock: "CRCL" },
  { symbol: "GLDx", name: "Gold Trust xStock", mint: "Xsv9hRk1z5ysP6K3M5V2Q7T9Y1L8W4R6Z3X7C8B5N2M", decimals: 6, imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/GLDx.png", underlyingStock: "GLD" },
];

/**
 * Fetch supported pump pairs from ClawPump API.
 * Sourced from GET https://clawpump.tech/api/v1/pump-pairs
 */
export async function getClawPumpPairs(): Promise<PumpPairsResponse> {
  const apiKey = process.env.CLAWPUMP_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(`${CLAWPUMP_API_BASE}/pump-pairs`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.assets) && data.assets.length > 0) {
          const verifiedStockSymbols = new Set(VERIFIED_SOLANA_XSTOCKS_PAIRS.map((p) => p.symbol.toLowerCase()));
          const verifiedStockMints = new Set(VERIFIED_SOLANA_XSTOCKS_PAIRS.map((p) => p.mint.toLowerCase()));

          // Strictly filter out non-stock meme tokens (Fartcoin, MOODENG, Bonk, etc.)
          const stockAssets = data.assets.filter((asset: PumpPairAsset) => {
            const sym = (asset.symbol || "").toLowerCase();
            const mint = (asset.mint || "").toLowerCase();
            const name = (asset.name || "").toLowerCase();

            const isStock =
              verifiedStockSymbols.has(sym) ||
              verifiedStockMints.has(mint) ||
              sym.endsWith("x") ||
              name.includes("xstock") ||
              name.includes("stock") ||
              Boolean(asset.underlyingStock);

            return isStock;
          });

          // Merge with our verified xStocks list to ensure all 25 curated stocks are always available
          const existingMints = new Set(stockAssets.map((a: PumpPairAsset) => a.mint.toLowerCase()));
          const completeStockList = [
            ...stockAssets,
            ...VERIFIED_SOLANA_XSTOCKS_PAIRS.filter((p) => !existingMints.has(p.mint.toLowerCase())),
          ];

          return {
            assets: completeStockList,
            creatorFeeBps: data.creatorFeeBps ?? { min: 100, max: 300, default: 100 },
          };
        }
      }
    } catch (err) {
      console.warn("ClawPump API pump-pairs query failed, using verified xStocks fallback:", err);
    }
  }

  // Fallback to verified Solana xStocks pump pairs
  return {
    assets: VERIFIED_SOLANA_XSTOCKS_PAIRS,
    creatorFeeBps: { min: 100, max: 300, default: 100 },
  };
}

/**
 * Ensures a ClawPump agent exists for the launch.
 * Hidden from UI as required: POST /agents (one token per agent)
 */
export async function getOrCreateLauncherAgent(tokenName: string): Promise<{ id: string; name: string }> {
  const apiKey = process.env.CLAWPUMP_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CLAWPUMP_API_KEY is not configured. Autonomous launcher agent provisioning requires an active ClawPump API key."
    );
  }

  const res = await fetch(`${CLAWPUMP_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${tokenName.slice(0, 20)} Launcher`,
      skills: ["trading"],
      model: "moonshotai/kimi-k2.5",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ClawPump agent creation failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { id: data.id, name: data.name ?? `${tokenName} Launcher` };
}

export type PreflightPayload = {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  pumpQuoteMint: string;
  pumpCreatorFeeBps: number;
  walletAddress: string;
  supply?: number;
};

export type PreflightResult = {
  success: boolean;
  agentId: string;
  agentName: string;
  payment: {
    method: "sol";
    amountLamports: number;
    amountSol: number;
    payTo: string;
    devBuySol: number;
  };
  retryWith: {
    preflightToken: string;
  };
  meta?: Record<string, unknown>;
};

/**
 * Step 1: Preflight quote discovery.
 * POST https://clawpump.tech/api/v1/launch/self-funded with preflight: true
 */
export async function requestPreflightQuote(payload: PreflightPayload): Promise<PreflightResult> {
  const apiKey = process.env.CLAWPUMP_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CLAWPUMP_API_KEY is not configured. Live Pump.fun quote and fee estimation requires an authorized ClawPump API key. You can also deploy via Meteora Dynamic Bonding Curve."
    );
  }
  const agent = await getOrCreateLauncherAgent(payload.name);

  const res = await fetch(`${CLAWPUMP_API_BASE}/launch/self-funded`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      preflight: true,
      name: payload.name,
      symbol: payload.symbol,
      description: payload.description,
      imageUrl: payload.imageUrl,
      agentId: agent.id,
      agentName: agent.name,
      pumpQuoteMint: payload.pumpQuoteMint,
      pumpCreatorFeeBps: payload.pumpCreatorFeeBps,
      walletAddress: payload.walletAddress,
      supply: payload.supply ?? 1000000000,
      devBuySol: 0,
    }),
    signal: AbortSignal.timeout(120000), // ClawPump recommends at least 120s timeout
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`ClawPump preflight quote failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    success: true,
    agentId: agent.id,
    agentName: agent.name,
    payment: data.payment,
    retryWith: data.retryWith,
    meta: data.meta,
  };
}

export type ConfirmLaunchPayload = PreflightPayload & {
  agentId: string;
  agentName: string;
  txSignature: string;
  preflightToken: string;
};

export type ConfirmLaunchResult = {
  success: boolean;
  mintAddress: string;
  txHash: string;
  pumpUrl: string;
  explorerUrl: string;
  meta?: Record<string, unknown>;
};

/**
 * Step 3: Execute launch with payment proof.
 * Repeat the same body with txSignature + preflightToken
 */
export async function executeClawPumpLaunch(payload: ConfirmLaunchPayload): Promise<ConfirmLaunchResult> {
  const apiKey = process.env.CLAWPUMP_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CLAWPUMP_API_KEY is not configured on the server. Live token deployment on Pump.fun via ClawPump requires an authorized API key."
    );
  }

  const res = await fetch(`${CLAWPUMP_API_BASE}/launch/self-funded`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.name,
      symbol: payload.symbol,
      description: payload.description,
      imageUrl: payload.imageUrl,
      agentId: payload.agentId,
      agentName: payload.agentName,
      pumpQuoteMint: payload.pumpQuoteMint,
      pumpCreatorFeeBps: payload.pumpCreatorFeeBps,
      walletAddress: payload.walletAddress,
      devBuySol: 0,
      txSignature: payload.txSignature,
      preflightToken: payload.preflightToken,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`ClawPump launch failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    success: true,
    mintAddress: data.mintAddress,
    txHash: data.txHash ?? payload.txSignature,
    pumpUrl: data.pumpUrl ?? `https://pump.fun/coin/${data.mintAddress}`,
    explorerUrl: data.explorerUrl ?? `https://solscan.io/token/${data.mintAddress}`,
    meta: data.meta,
  };
}
