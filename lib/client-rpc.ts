"use client";

import { Connection, type Commitment } from "@solana/web3.js";

/** Absolute URL of the same-origin RPC relay (see app/api/rpc). */
export function rpcRelayUrl(): string {
  if (typeof window === "undefined") return "http://localhost:3000/api/rpc";
  return `${window.location.origin}/api/rpc`;
}

export function browserConnection(commitment: Commitment = "confirmed"): Connection {
  return new Connection(rpcRelayUrl(), { commitment });
}

/**
 * Polls signature status over HTTP. Connection.confirmTransaction needs a websocket,
 * which neither the relay nor serverless hosting provides.
 */
export async function waitForSignature(
  connection: Connection,
  signature: string,
  opts: { lastValidBlockHeight?: number; timeoutMs?: number } = {}
): Promise<void> {
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error("The transaction failed on Solana.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (opts.lastValidBlockHeight !== undefined) {
      const height = await connection.getBlockHeight("confirmed");
      if (height > opts.lastValidBlockHeight) throw new Error("The transaction expired before it landed. Nothing was charged — try again.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Still waiting for Solana to confirm. Check the transaction in your wallet before retrying.");
}
