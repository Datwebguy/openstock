"use client";

import { PublicKey, VersionedTransaction, type Connection } from "@solana/web3.js";
import { browserConnection, waitForSignature } from "@/lib/client-rpc";

const JUPITER_LITE = "https://lite-api.jup.ag/swap/v1";

type JupiterQuote = { inAmount: string; outAmount: string; otherAmountThreshold: string; error?: string };

export type CommunitySwapResult = {
  signature: string;
  inputUi: number;
  expectedOutUi: number;
  minOutUi: number;
};

export class NoRouteError extends Error {}

const decimalsCache = new Map<string, number>();

/** Mint decimals read from chain — xStocks are 8, pump tokens 6; never assumed. */
async function mintDecimals(connection: Connection, mint: string): Promise<number> {
  const cached = decimalsCache.get(mint);
  if (cached !== undefined) return cached;
  const info = await connection.getParsedAccountInfo(new PublicKey(mint));
  const parsed = info.value?.data as { parsed?: { info?: { decimals?: number } } } | undefined;
  const decimals = parsed?.parsed?.info?.decimals;
  if (typeof decimals !== "number") throw new Error("Could not read token decimals from Solana.");
  decimalsCache.set(mint, decimals);
  return decimals;
}

function toBase64(value: Uint8Array) {
  let binary = "";
  for (let i = 0; i < value.length; i += 0x8000) binary += String.fromCharCode(...value.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

/** Live Jupiter estimate for the amount typed, without building a transaction. */
export async function quoteCommunitySwap(params: { inputMint: string; outputMint: string; uiAmount: number; slippageBps: number; signal?: AbortSignal }): Promise<{ expectedOutUi: number; minOutUi: number }> {
  const connection = browserConnection();
  const [inputDecimals, outputDecimals] = await Promise.all([mintDecimals(connection, params.inputMint), mintDecimals(connection, params.outputMint)]);
  const raw = Math.floor(params.uiAmount * 10 ** inputDecimals);
  if (!Number.isSafeInteger(raw) || raw <= 0) throw new Error("Enter a valid amount.");
  const res = await fetch(`${JUPITER_LITE}/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${raw}&slippageBps=${params.slippageBps}`, { headers: { Accept: "application/json" }, signal: params.signal ?? AbortSignal.timeout(10_000) });
  const quote = (await res.json().catch(() => ({}))) as JupiterQuote;
  if (!res.ok || quote.error || !quote.outAmount) throw new NoRouteError(quote.error || "No Jupiter route for this pair yet.");
  return { expectedOutUi: Number(quote.outAmount) / 10 ** outputDecimals, minOutUi: Number(quote.otherAmountThreshold) / 10 ** outputDecimals };
}

/**
 * Quote on Jupiter, sign with the connected wallet, broadcast through the OpenStock RPC relay and wait for
 * confirmation. The amount typed by the user is converted with the input mint's real decimals.
 */
export async function executeCommunitySwap(params: {
  inputMint: string;
  outputMint: string;
  uiAmount: number;
  slippageBps: number;
  wallet: string;
  sign: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  onStatus?: (message: string) => void;
}): Promise<CommunitySwapResult> {
  const connection = browserConnection();
  const [inputDecimals, outputDecimals] = await Promise.all([
    mintDecimals(connection, params.inputMint),
    mintDecimals(connection, params.outputMint),
  ]);
  const raw = Math.floor(params.uiAmount * 10 ** inputDecimals);
  if (!Number.isSafeInteger(raw) || raw <= 0) throw new Error("Enter a valid amount.");

  params.onStatus?.("Getting a Jupiter quote...");
  const quoteRes = await fetch(
    `${JUPITER_LITE}/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${raw}&slippageBps=${params.slippageBps}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) }
  );
  const quote = (await quoteRes.json().catch(() => ({}))) as JupiterQuote;
  if (!quoteRes.ok || quote.error || !quote.outAmount) throw new NoRouteError(quote.error || "No Jupiter route for this pair yet.");

  const expectedOutUi = Number(quote.outAmount) / 10 ** outputDecimals;
  const minOutUi = Number(quote.otherAmountThreshold) / 10 ** outputDecimals;

  params.onStatus?.("Building the swap transaction...");
  const swapRes = await fetch(`${JUPITER_LITE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: params.wallet, wrapAndUnwrapSol: false, dynamicComputeUnitLimit: true }),
    signal: AbortSignal.timeout(12_000),
  });
  const swapData = (await swapRes.json().catch(() => ({}))) as { swapTransaction?: string; lastValidBlockHeight?: number };
  if (!swapRes.ok || !swapData.swapTransaction) throw new Error("Jupiter could not build the swap transaction.");

  params.onStatus?.(`Approve in your wallet · receive ≈ ${expectedOutUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}`);
  const signed = await params.sign(VersionedTransaction.deserialize(fromBase64(swapData.swapTransaction)));

  params.onStatus?.("Submitting to Solana...");
  const signature = await connection.sendEncodedTransaction(toBase64(signed.serialize()), { skipPreflight: false, maxRetries: 3 });
  params.onStatus?.("Confirming...");
  await waitForSignature(connection, signature, { lastValidBlockHeight: swapData.lastValidBlockHeight });

  return { signature, inputUi: params.uiAmount, expectedOutUi, minOutUi };
}
