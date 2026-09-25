import { NextRequest, NextResponse } from "next/server";

/**
 * Browser → Solana JSON-RPC relay.
 * Public mainnet RPC rejects browser origins (HTTP 403), and a keyed RPC URL must not ship in the client bundle.
 * Only the read/submit methods the app's client code needs are forwarded.
 */
const UPSTREAM = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const ALLOWED = new Set([
  "getLatestBlockhash",
  "getRecentPrioritizationFees",
  "simulateTransaction",
  "sendTransaction",
  "getSignatureStatuses",
  "getBlockHeight",
  "getSlot",
  "getBalance",
  "getAccountInfo",
  "getMultipleAccounts",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getFeeForMessage",
  "getMinimumBalanceForRentExemption",
  "getGenesisHash",
  "getEpochInfo",
  "isBlockhashValid",
]);
const MAX_BODY = 64 * 1024;
const WINDOW_MS = 10_000;
const MAX_CALLS = 60;
const recent = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const calls = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  calls.push(now);
  recent.set(ip, calls);
  if (recent.size > 5_000) recent.clear();
  return calls.length > MAX_CALLS;
}

type RpcCall = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: 429, message: "Too many requests" } }, { status: 429 });

  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: 413, message: "Request too large" } }, { status: 413 });

  let payload: RpcCall | RpcCall[];
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length === 0 || calls.length > 10 || calls.some((call) => !call.method || !ALLOWED.has(call.method))) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: "Method not allowed" } }, { status: 403 });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: 502, message: "Solana RPC unreachable" } }, { status: 502 });
  }
}
