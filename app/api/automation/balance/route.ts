import { NextResponse } from "next/server";
import { USDC_DECIMALS, USDC_MINT, isSolanaAddress } from "@/lib/solana";
import { rawToUi, uiToRaw } from "@/lib/scaled-amounts";
import { CURATED_SYMBOLS, getHydratedAsset } from "@/lib/xstocks";

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

type RpcResponse = {
  result?: {
    value?: Array<{
      account?: {
        data?: {
          parsed?: {
            info?: {
              tokenAmount?: { uiAmountString?: string; decimals?: number; amount?: string };
            };
          };
        };
      };
    }>;
  };
  error?: { message?: string };
};

function isWallet(value: string) {
  return isSolanaAddress(value);
}

async function tokenBalanceRaw(wallet: string, mint: string): Promise<number> {
  const response = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [wallet, { mint }, { encoding: "jsonParsed" }],
    }),
  });
  const payload = (await response.json()) as RpcResponse;
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "Solana balance could not be read.");
  return (payload.result?.value ?? []).reduce((total, item) => {
    const amount = item.account?.data?.parsed?.info?.tokenAmount?.amount;
    const n = amount !== undefined ? Number(amount) : 0;
    return total + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet") ?? "";
  const symbol = url.searchParams.get("symbol") ?? "";
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const requested = Number(url.searchParams.get("amount") ?? "0");
  if (!isWallet(wallet)) return NextResponse.json({ error: "Choose a valid Solana wallet first." }, { status: 400 });
  if (!CURATED_SYMBOLS.includes(symbol)) return NextResponse.json({ error: "Choose a supported stock." }, { status: 400 });
  if (!Number.isFinite(requested) || requested <= 0) {
    return NextResponse.json({ error: "The funding amount is not ready yet." }, { status: 400 });
  }

  try {
    const asset = await getHydratedAsset(symbol);
    const mint = side === "buy" ? USDC_MINT : asset.solanaDeployment?.address;
    const decimals = side === "buy" ? USDC_DECIMALS : asset.solanaDeployment?.decimals;
    if (!mint || decimals === undefined) {
      return NextResponse.json({ error: "This stock's Solana deployment is still loading." }, { status: 409 });
    }

    const multiplier = asset.multiplier?.currentMultiplier ?? null;
    const availableRaw = await tokenBalanceRaw(wallet, mint);

    if (side === "sell") {
      // UI shares → raw atoms via ÷ multiplier (never ×)
      const conversion = uiToRaw(requested, multiplier, decimals);
      if (!conversion) {
        return NextResponse.json(
          { error: "Multiplier/decimals unavailable — cannot size a sell safely." },
          { status: 409 }
        );
      }
      const requiredRaw = Number(conversion.rawAmount);
      const shortfallRaw = Math.max(0, requiredRaw - availableRaw);
      const availableUi = rawToUi(String(availableRaw), multiplier, decimals) ?? 0;
      return NextResponse.json({
        wallet,
        symbol,
        side,
        fundingAsset: symbol,
        mint,
        decimals,
        multiplier: conversion.multiplier,
        required: requested,
        requiredRaw: conversion.rawAmount,
        available: availableUi,
        shortfall: rawToUi(String(shortfallRaw), multiplier, decimals) ?? 0,
        sufficient: shortfallRaw <= 0,
        source: "Solana RPC",
      });
    }

    // Buy: fund with USDC (no stock multiplier)
    const requiredRaw = Math.ceil(requested * 10 ** decimals);
    const shortfallRaw = Math.max(0, requiredRaw - availableRaw);
    const availableUi = availableRaw / 10 ** decimals;
    return NextResponse.json({
      wallet,
      symbol,
      side,
      fundingAsset: "USDC",
      mint,
      decimals,
      multiplier: 1,
      required: requested,
      requiredRaw: String(requiredRaw),
      available: availableUi,
      shortfall: shortfallRaw / 10 ** decimals,
      sufficient: shortfallRaw <= 0,
      source: "Solana RPC",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet balance could not be loaded." },
      { status: 502 }
    );
  }
}
