import { NextResponse } from "next/server";
import { isSolanaAddress } from "@/lib/solana";
import { fetchJupiterPrices } from "@/lib/jupiter-price";

// Recent trades for a community token, read straight from Solana: the pool's latest transactions are
// fetched and each one is turned into a buy or sell from the trader's own token-balance changes.
// Works for any pool from its first trade, including bonding curves no charting site has indexed yet.

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const WSOL = "So11111111111111111111111111111111111111112";
const MAX_TXS = 120;

type TokenBalance = { mint: string; owner?: string; uiTokenAmount: { uiAmount: number | null } };
type RpcTx = {
  blockTime: number | null;
  transaction: { signatures: string[]; message: { accountKeys: Array<string | { pubkey: string }> } };
  meta: { err: unknown; fee: number; preBalances: number[]; postBalances: number[]; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } | null;
};
type DexPair = {
  pairAddress: string; dexId?: string; url?: string;
  baseToken: { address: string; symbol: string }; quoteToken: { address: string; symbol: string };
  priceUsd?: string; priceNative?: string; marketCap?: number; fdv?: number;
  liquidity?: { usd?: number };
  volume?: Record<string, number>; priceChange?: Record<string, number>;
  txns?: Record<string, { buys: number; sells: number }>;
};
export type TokenTrade = { signature: string; time: number; side: "buy" | "sell"; trader: string; tokenAmount: number; quoteAmount: number; priceQuote: number; priceUsd: number | null; valueUsd: number | null };

const cache = new Map<string, { at: number; body: unknown }>();

async function rpcBatch<T>(calls: Array<{ method: string; params: unknown[] }>): Promise<Array<T | null>> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await res.json() as Array<{ id: number; result?: T }> | { error?: unknown };
  if (!Array.isArray(payload)) throw new Error("Solana RPC rejected the request.");
  const out: Array<T | null> = calls.map(() => null);
  for (const item of payload) out[item.id] = item.result ?? null;
  return out;
}

async function findPair(mint: string): Promise<DexPair | null> {
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(8_000), next: { revalidate: 30 } });
  if (!res.ok) return null;
  const pairs = await res.json() as DexPair[];
  if (!Array.isArray(pairs) || !pairs.length) return null;
  return [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

const key = (k: string | { pubkey: string }) => (typeof k === "string" ? k : k.pubkey);

/** Net change per token-account owner for one mint. */
function deltasByOwner(meta: NonNullable<RpcTx["meta"]>, mint: string) {
  const out = new Map<string, number>();
  for (const [list, sign] of [[meta.preTokenBalances, -1], [meta.postTokenBalances, 1]] as const) {
    for (const b of list ?? []) {
      if (b.mint !== mint || !b.owner) continue;
      out.set(b.owner, (out.get(b.owner) ?? 0) + sign * (b.uiTokenAmount.uiAmount ?? 0));
    }
  }
  return out;
}

// The pool is the owner whose token and quote balances move in opposite directions by the most token;
// the trade is read from its side (works when a bot or aggregator pays the fee instead of the trader).
function parseTrade(tx: RpcTx, mint: string, quoteMint: string, quoteUsd: number | null): TokenTrade | null {
  if (!tx?.meta || tx.meta.err) return null;
  const tokenD = deltasByOwner(tx.meta, mint);
  const quoteD = deltasByOwner(tx.meta, quoteMint);
  if (quoteMint === WSOL) {
    const keys = tx.transaction.message.accountKeys.map(key);
    keys.forEach((k, i) => {
      if (!tokenD.has(k) || quoteD.get(k)) return;
      const lamports = (tx.meta!.postBalances[i] - tx.meta!.preBalances[i] + (i === 0 ? tx.meta!.fee : 0)) / 1e9;
      if (Math.abs(lamports) > 1e-9) quoteD.set(k, lamports);
    });
  }
  let pool: string | null = null, best = 0;
  for (const [owner, dT] of tokenD) {
    const dQ = quoteD.get(owner) ?? 0;
    if (dT && dQ && Math.sign(dT) !== Math.sign(dQ) && Math.abs(dT) > best) { pool = owner; best = Math.abs(dT); }
  }
  if (!pool) return null;
  const poolToken = tokenD.get(pool)!, poolQuote = quoteD.get(pool)!;
  const side: "buy" | "sell" = poolToken < 0 ? "buy" : "sell";
  let trader = key(tx.transaction.message.accountKeys[0]), traderAmt = 0;
  for (const [owner, dT] of tokenD) {
    if (owner === pool) continue;
    const moved = side === "buy" ? dT : -dT;
    if (moved > traderAmt) { trader = owner; traderAmt = moved; }
  }
  const tokenAmount = Math.abs(poolToken), quoteAmount = Math.abs(poolQuote);
  const priceQuote = quoteAmount / tokenAmount;
  return {
    signature: tx.transaction.signatures[0],
    time: (tx.blockTime ?? 0) * 1000,
    side,
    trader,
    tokenAmount,
    quoteAmount,
    priceQuote,
    priceUsd: quoteUsd !== null ? priceQuote * quoteUsd : null,
    valueUsd: quoteUsd !== null ? quoteAmount * quoteUsd : null,
  };
}

export async function GET(request: Request) {
  const mint = new URL(request.url).searchParams.get("mint") ?? "";
  if (!isSolanaAddress(mint)) return NextResponse.json({ error: "Invalid mint." }, { status: 400 });
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < 15_000) return NextResponse.json(hit.body);

  try {
    const pair = await findPair(mint);
    if (!pair) return NextResponse.json({ error: "No pool found for this token yet." }, { status: 404 });
    const tokenIsBase = pair.baseToken.address === mint;
    const quoteMint = tokenIsBase ? pair.quoteToken.address : pair.baseToken.address;
    const quoteSymbol = tokenIsBase ? pair.quoteToken.symbol : pair.baseToken.symbol;

    const [prices, [sigs, supply]] = await Promise.all([
      fetchJupiterPrices([quoteMint], 6_000).catch(() => ({} as Record<string, { usdPrice?: number }>)),
      rpcBatch<unknown>([
        { method: "getSignaturesForAddress", params: [pair.pairAddress, { limit: MAX_TXS }] },
        { method: "getTokenSupply", params: [mint] },
      ]),
    ]);
    const quoteUsdRaw = Number((prices as Record<string, { usdPrice?: number }>)[quoteMint]?.usdPrice);
    const quoteUsd = Number.isFinite(quoteUsdRaw) && quoteUsdRaw > 0 ? quoteUsdRaw : null;
    const signatures = ((sigs as Array<{ signature: string; err: unknown }> | null) ?? []).filter((s) => !s.err).map((s) => s.signature);

    const txs: Array<RpcTx | null> = [];
    for (let i = 0; i < signatures.length; i += 40) {
      txs.push(...await rpcBatch<RpcTx>(signatures.slice(i, i + 40).map((sig) => ({ method: "getTransaction", params: [sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }))));
    }
    const trades = txs.map((tx) => (tx ? parseTrade(tx, mint, quoteMint, quoteUsd) : null)).filter((t): t is TokenTrade => Boolean(t)).sort((a, b) => b.time - a.time);

    const supplyUi = Number((supply as { value?: { uiAmountString?: string } } | null)?.value?.uiAmountString ?? 0) || null;
    const lastPriceUsd = trades[0]?.priceUsd ?? (pair.priceUsd ? Number(pair.priceUsd) : null);
    const body = {
      mint,
      pool: { address: pair.pairAddress, dexId: pair.dexId ?? null, url: pair.url ?? null, quoteMint, quoteSymbol, quoteUsd },
      supply: supplyUi,
      lastPriceUsd,
      lastPriceQuote: trades[0]?.priceQuote ?? null,
      marketCapUsd: lastPriceUsd !== null && supplyUi ? lastPriceUsd * supplyUi : pair.marketCap ?? pair.fdv ?? null,
      liquidityUsd: pair.liquidity?.usd ?? null,
      windows: pair.txns ? Object.fromEntries(["m5", "h1", "h6", "h24"].map((w) => [w, { buys: pair.txns?.[w]?.buys ?? 0, sells: pair.txns?.[w]?.sells ?? 0, volumeUsd: pair.volume?.[w] ?? 0, change: pair.priceChange?.[w] ?? null }])) : null,
      trades,
      scanned: signatures.length,
      source: "Solana RPC (pool transactions) · DexScreener (pool, windows) · Jupiter (quote price)",
      generatedAt: new Date().toISOString(),
    };
    cache.set(mint, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (error) {
    console.error("token-activity failed", error);
    return NextResponse.json({ error: "Trade data is unavailable right now." }, { status: 502 });
  }
}
