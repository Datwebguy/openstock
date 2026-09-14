import { NextResponse } from "next/server";
import { CURATED_SYMBOLS, getHydratedAsset } from "@/lib/xstocks";

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGkGzwyTDt1v";
const USDC_DECIMALS = 6;

type RpcResponse = { result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmountString?: string; decimals?: number } } } } } }> } ; error?: { message?: string } };

function isWallet(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function amountToRaw(value: number, decimals: number) {
  if (!Number.isFinite(value) || value < 0) return "0";
  return Math.ceil(value * (10 ** decimals)).toString();
}

async function tokenBalance(wallet: string, mint: string) {
  const response = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [wallet, { mint }, { encoding: "jsonParsed" }] }),
  });
  const payload = await response.json() as RpcResponse;
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "Solana balance could not be read.");
  return (payload.result?.value ?? []).reduce((total, item) => total + Number(item.account?.data?.parsed?.info?.tokenAmount?.uiAmountString ?? 0), 0);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet") ?? "";
  const symbol = url.searchParams.get("symbol") ?? "";
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const requested = Number(url.searchParams.get("amount") ?? "0");
  if (!isWallet(wallet)) return NextResponse.json({ error: "Choose a valid Solana wallet first." }, { status: 400 });
  if (!CURATED_SYMBOLS.includes(symbol)) return NextResponse.json({ error: "Choose a supported stock." }, { status: 400 });
  if (!Number.isFinite(requested) || requested <= 0) return NextResponse.json({ error: "The funding amount is not ready yet." }, { status: 400 });

  try {
    const asset = await getHydratedAsset(symbol);
    const mint = side === "buy" ? USDC_MINT : asset.solanaDeployment?.address;
    const decimals = side === "buy" ? USDC_DECIMALS : asset.solanaDeployment?.decimals;
    if (!mint || decimals === undefined) return NextResponse.json({ error: "This stock's Solana deployment is still loading." }, { status: 409 });
    const multiplier = side === "sell" ? asset.multiplier?.currentMultiplier ?? 1 : 1;
    const required = side === "sell" ? requested * multiplier : requested;
    const available = await tokenBalance(wallet, mint);
    const shortfall = Math.max(0, required - available);
    return NextResponse.json({ wallet, symbol, side, fundingAsset: side === "buy" ? "USDC" : symbol, mint, decimals, multiplier, required, requiredRaw: amountToRaw(required, decimals), available, shortfall, sufficient: shortfall <= 0, source: "Solana RPC" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet balance could not be loaded." }, { status: 502 });
  }
}
