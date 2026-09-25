/**
 * ClawPump API Integration for Solana Token Launches against xStocks
 * Official Base URL: https://clawpump.tech/api/v1 (Never use agents.clawpump.tech)
 * Documentation: https://clawpump.tech/developers
 */

import curatedSymbols from "./curated-symbols.json";
import curatedPairs from "./solana-curated-25.json";

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

type CuratedPair = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logo: string;
};

/**
 * Verified Solana xStocks pump pairs sourced from the curated mint registry.
 * Used when CLAWPUMP_API_KEY is pending or upstream is temporarily offline.
 */
export const VERIFIED_SOLANA_XSTOCKS_PAIRS: PumpPairAsset[] = (curatedSymbols as string[])
  .map((symbol) => (curatedPairs as Record<string, CuratedPair>)[symbol])
  .filter((pair): pair is CuratedPair => Boolean(pair?.mint))
  .map((pair) => ({
    symbol: pair.symbol,
    name: pair.name,
    mint: pair.mint,
    decimals: pair.decimals,
    imageUrl: pair.logo,
    underlyingStock: pair.symbol.replace(/x$/i, ""),
  }));

/** ClawPump's own creator-fee bounds, used until its API reports different ones. */
export const CLAWPUMP_DEFAULT_FEE_RANGE = { min: 100, max: 300, default: 100 };

/**
 * xStocks that can be launched against on Pump.fun via ClawPump.
 * Only curated xStock mints are ever returned (ClawPump also lists memecoins and non-xStock tickers).
 * Symbols/names come from the curated registry so deep links like ?symbol=NVDAx match.
 * source "clawpump" = confirmed by GET /pump-pairs; "registry" = ClawPump not reachable, launch will be unavailable.
 */
export async function getClawPumpPairs(): Promise<PumpPairsResponse & { source: "clawpump" | "registry" }> {
  const apiKey = process.env.CLAWPUMP_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`${CLAWPUMP_API_BASE}/pump-pairs`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as { assets?: PumpPairAsset[]; creatorFeeBps?: PumpPairsResponse["creatorFeeBps"] };
        const supportedMints = new Set((data.assets ?? []).map((asset) => asset.mint));
        return {
          assets: VERIFIED_SOLANA_XSTOCKS_PAIRS.filter((pair) => supportedMints.has(pair.mint)),
          creatorFeeBps: data.creatorFeeBps ?? CLAWPUMP_DEFAULT_FEE_RANGE,
          source: "clawpump",
        };
      }
      console.warn("ClawPump pump-pairs returned", res.status);
    } catch (err) {
      console.warn("ClawPump pump-pairs query failed:", err instanceof Error ? err.message : err);
    }
  }
  return { assets: VERIFIED_SOLANA_XSTOCKS_PAIRS, creatorFeeBps: CLAWPUMP_DEFAULT_FEE_RANGE, source: "registry" };
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
    console.error("ClawPump agent creation failed", res.status, errText.slice(0, 400));
    throw new Error("Launcher agent could not be created. Try again in a moment.");
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
  devBuySol?: number;
  /** Reuse the launcher agent from an earlier quote in the same launch attempt instead of creating another. */
  agentId?: string;
  agentName?: string;
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

/** Preflight and confirm must send an identical body to ClawPump, so both resolve the description here. */
export function resolveLaunchDescription(description: unknown, name: string, pairedStockSymbol: string): string {
  return typeof description === "string" && description.trim().length >= 3
    ? description.trim().slice(0, 500)
    : `${name.trim()} paired against ${pairedStockSymbol} on Solana via OpenStock`;
}

/**
 * Step 1: Preflight quote discovery.
 * POST https://clawpump.tech/api/v1/launch/self-funded with preflight: true
 */
export async function requestPreflightQuote(payload: PreflightPayload): Promise<PreflightResult> {
  const apiKey = process.env.CLAWPUMP_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Pump.fun launches are not configured on this deployment."
    );
  }
  const agent =
    payload.agentId && payload.agentName
      ? { id: payload.agentId, name: payload.agentName }
      : await getOrCreateLauncherAgent(payload.name);

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
      devBuySol: Number(payload.devBuySol || 0),
    }),
    signal: AbortSignal.timeout(120000), // ClawPump recommends at least 120s timeout
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("ClawPump preflight quote failed", res.status, errorBody.slice(0, 400));
    throw new Error("Live Pump.fun quote could not be generated. Try again in a moment.");
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
    throw new Error("Pump.fun launches are not configured on this deployment.");
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
      supply: payload.supply ?? 1000000000,
      devBuySol: Number(payload.devBuySol || 0),
      txSignature: payload.txSignature,
      preflightToken: payload.preflightToken,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("ClawPump launch failed", res.status, errorBody.slice(0, 400));
    throw new Error("Token launch could not be completed. Your payment is on-chain — retry to finish the launch with the same payment.");
  }

  const data = await res.json();
  if (typeof data.mintAddress !== "string" || data.mintAddress.length < 32) {
    throw new Error("ClawPump did not return a mint address. Retry to finish the launch with the same payment.");
  }
  return {
    success: true,
    mintAddress: data.mintAddress,
    txHash: data.txHash ?? payload.txSignature,
    pumpUrl: data.pumpUrl ?? `https://pump.fun/coin/${data.mintAddress}`,
    explorerUrl: data.explorerUrl ?? `https://solscan.io/token/${data.mintAddress}`,
    meta: data.meta,
  };
}
