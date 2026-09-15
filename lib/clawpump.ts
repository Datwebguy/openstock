/**
 * ClawPump API Integration for Solana Token Launches against xStocks
 * Official Base URL: https://clawpump.tech/api/v1 (Never use agents.clawpump.tech)
 * Documentation: https://clawpump.tech/developers
 */

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
  {
    symbol: "AAPLx",
    name: "Apple xStock",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/AAPLx.png",
    underlyingStock: "AAPL",
  },
  {
    symbol: "NVDAx",
    name: "NVIDIA xStock",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/NVDAx.png",
    underlyingStock: "NVDA",
  },
  {
    symbol: "TSLAx",
    name: "Tesla xStock",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/TSLAx.png",
    underlyingStock: "TSLA",
  },
  {
    symbol: "MSFTx",
    name: "Microsoft xStock",
    mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/MSFTx.png",
    underlyingStock: "MSFT",
  },
  {
    symbol: "AMZNx",
    name: "Amazon.com xStock",
    mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/AMZNx.png",
    underlyingStock: "AMZN",
  },
  {
    symbol: "GOOGLx",
    name: "Alphabet Google xStock",
    mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/GOOGLx.png",
    underlyingStock: "GOOGL",
  },
  {
    symbol: "METAx",
    name: "Meta Platforms xStock",
    mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/METAx.png",
    underlyingStock: "META",
  },
  {
    symbol: "COINx",
    name: "Coinbase Global xStock",
    mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/COINx.png",
    underlyingStock: "COIN",
  },
  {
    symbol: "MSTRx",
    name: "MicroStrategy xStock",
    mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/MSTRx.png",
    underlyingStock: "MSTR",
  },
  {
    symbol: "INTCx",
    name: "Intel xStock",
    mint: "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/INTCx.png",
    underlyingStock: "INTC",
  },
  {
    symbol: "SPYx",
    name: "S&P 500 Index xStock",
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    decimals: 6,
    imageUrl: "https://xstocks-metadata.backed.fi/logos/tokens/SPYx.png",
    underlyingStock: "SPY",
  },
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
          return {
            assets: data.assets,
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
    // Return mock agent for dev evaluation
    return {
      id: `agt_eval_${Math.random().toString(36).slice(2, 10)}`,
      name: `${tokenName} Launcher`,
    };
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
  const agent = await getOrCreateLauncherAgent(payload.name);

  if (!apiKey) {
    // Development / evaluation mode: simulate live quote
    const simulatedLamports = 7510000; // ~0.00751 SOL typical account rent & launch cost
    return {
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      payment: {
        method: "sol",
        amountLamports: simulatedLamports,
        amountSol: simulatedLamports / 1e9,
        payTo: "49CfXAr58cCTGJnYsbm16fEsE5JRpdR8QQP8E1ZinGCq",
        devBuySol: 0,
      },
      retryWith: {
        preflightToken: `pfl_token_${Math.random().toString(36).slice(2, 14)}`,
      },
      meta: { mode: "evaluation" },
    };
  }

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
    // Development evaluation simulated launch
    const fakeMint = `Xs${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    return {
      success: true,
      mintAddress: fakeMint,
      txHash: payload.txSignature,
      pumpUrl: `https://pump.fun/coin/${fakeMint}`,
      explorerUrl: `https://solscan.io/tx/${payload.txSignature}`,
      meta: { mode: "evaluation" },
    };
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
