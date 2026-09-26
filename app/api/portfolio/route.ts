import { NextResponse } from "next/server";
import { getSolPriceUsd } from "@/lib/market-evidence";
import { getPortfolioSnapshots, portfolioChange, recordPortfolioSnapshot, type PortfolioSnapshot } from "@/lib/portfolio-snapshots";
import { USDC_DECIMALS, USDC_MINT, isSolanaAddress } from "@/lib/solana";
import { getHydratedAsset } from "@/lib/xstocks";
import curatedRegistry from "@/lib/solana-curated-25.json";

const MINT_TO_SYMBOL = new Map(Object.values(curatedRegistry as Record<string, { symbol: string; mint: string }>).map((entry) => [entry.mint, entry.symbol]));

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
type TokenAccount = { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmountString?: string; decimals?: number; amount?: string } } } } } };
type RpcResponse<T> = { result?: T; error?: { message?: string } };
type AssetBalance = { shares: number; rawAmount: string; decimals: number };

function isWallet(value: string) { return isSolanaAddress(value); }
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(SOLANA_RPC, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(12_000) });
      const payload = await response.json() as RpcResponse<T>;
      if (response.ok && !payload.error && payload.result !== undefined) return payload.result;
      throw new Error(payload.error?.message ?? "The Solana balance could not be read.");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("The Solana balance could not be read.");
      if (attempt === 0 && /INTERNAL_ERROR|timeout|fetch failed/i.test(lastError.message)) await new Promise((resolve) => setTimeout(resolve, 350));
      else break;
    }
  }
  throw lastError ?? new Error("The Solana balance could not be read.");
}
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function solBalance(wallet: string): Promise<number> {
  try {
    const res = await rpc<{ value?: number } | number>("getBalance", [wallet, { commitment: "confirmed" }]);
    const lamports = typeof res === "number" ? res : (res?.value ?? 0);
    return Number.isFinite(lamports) && lamports >= 0 ? lamports / 1_000_000_000 : 0;
  } catch {
    return 0;
  }
}

async function getUserTokenMap(wallet: string): Promise<Map<string, AssetBalance>> {
  const map = new Map<string, AssetBalance>();
  try {
    const [splResult, t22Result] = await Promise.all([
      rpc<{ value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmountString?: string; amount?: string; decimals?: number } } } } } }> }>(
        "getTokenAccountsByOwner",
        [wallet, { programId: TOKEN_PROGRAM_ID }, { encoding: "jsonParsed" }]
      ).catch(() => ({ value: [] })),
      rpc<{ value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmountString?: string; amount?: string; decimals?: number } } } } } }> }>(
        "getTokenAccountsByOwner",
        [wallet, { programId: TOKEN_2022_PROGRAM_ID }, { encoding: "jsonParsed" }]
      ).catch(() => ({ value: [] })),
    ]);

    const accounts = [...(splResult.value ?? []), ...(t22Result.value ?? [])];
    for (const item of accounts) {
      const info = item.account?.data?.parsed?.info;
      const mint = info?.mint;
      const tokenAmount = info?.tokenAmount;
      if (!mint || !tokenAmount) continue;

      const shares = Number(tokenAmount.uiAmountString ?? 0);
      const rawAmount = tokenAmount.amount ?? "0";
      const decimals = Number.isInteger(tokenAmount.decimals) ? (tokenAmount.decimals as number) : 6;

      if (shares > 0) {
        const existing = map.get(mint);
        if (existing) {
          map.set(mint, {
            shares: existing.shares + shares,
            rawAmount: (BigInt(existing.rawAmount) + BigInt(rawAmount)).toString(),
            decimals,
          });
        } else {
          map.set(mint, { shares, rawAmount, decimals });
        }
      }
    }
  } catch (err) {
    console.warn("Could not query user token accounts:", err);
  }
  return map;
}

function usd(value: number | null) { return value !== null && Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : null; }

async function portfolioResponse(wallet: string, track: boolean) {
  if (!isWallet(wallet)) return NextResponse.json({ error: "Connect a valid Solana wallet to view the portfolio." }, { status: 400 });
  try {
    const [sol, solPriceResult, userTokenMap] = await Promise.all([
      solBalance(wallet),
      getSolPriceUsd().catch(() => null),
      getUserTokenMap(wallet),
    ]);

    const solPriceUsd = typeof solPriceResult === "number" && Number.isFinite(solPriceResult) ? solPriceResult : null;
    const solValueUsd = solPriceUsd !== null ? Number((sol * solPriceUsd).toFixed(2)) : null;

    // Read real on-chain USDC balance
    const usdcBalance = userTokenMap.get(USDC_MINT);
    const usdcShares = usdcBalance ? usdcBalance.shares : 0;
    const usdcValueUsd = Number(usdcShares.toFixed(2));

    // Match any stock assets held by this wallet
    const holdings = [];
    let holdingsTotalUsd = 0;

    // Only load live data for stocks this wallet actually holds, in parallel (loading all 32 in sequence timed out).
    const heldSymbols = [...userTokenMap.keys()].map((mint) => MINT_TO_SYMBOL.get(mint)).filter((symbol): symbol is string => Boolean(symbol));
    const heldAssets = await Promise.all(heldSymbols.map((symbol) => getHydratedAsset(symbol).catch(() => null)));
    for (const asset of heldAssets) {
      try {
        if (!asset) continue;
        const mint = asset.solanaDeployment?.address;
        if (!mint) continue;

        const balance = userTokenMap.get(mint);
        if (balance && balance.shares > 0) {
          const mult = asset.multiplier?.currentMultiplier && Number.isFinite(asset.multiplier.currentMultiplier)
            ? asset.multiplier.currentMultiplier
            : 1;
          const rawTokens = Number(balance.shares.toFixed(4));
          const actualShares = Number((balance.shares * mult).toFixed(4));
          const priceUsd = asset.price !== null && Number.isFinite(asset.price) ? asset.price : null;
          const valueUsd = priceUsd !== null ? Number((actualShares * priceUsd).toFixed(2)) : null;
          if (valueUsd !== null) holdingsTotalUsd += valueUsd;

          holdings.push({
            symbol: asset.symbol,
            name: asset.name.replace(/ xStock$/, ""),
            logo: asset.logo ?? null,
            mint,
            decimals: asset.solanaDeployment?.decimals ?? balance.decimals,
            rawTokens,
            multiplier: mult,
            shares: actualShares,
            rawAmount: balance.rawAmount,
            priceUsd: usd(priceUsd),
            valueUsd: usd(valueUsd),
          });
        }
      } catch {
        // Skip unresolvable asset
      }
    }

    const totalValueUsd = Number(((solValueUsd ?? 0) + usdcValueUsd + holdingsTotalUsd).toFixed(2));
    const generatedAt = new Date().toISOString();
    const snapshot: PortfolioSnapshot = {
      createdAt: generatedAt,
      totalValueUsd,
      solValueUsd: usd(solValueUsd),
      usdcValueUsd,
      holdings: holdings.map((h) => ({ symbol: h.symbol, shares: h.shares, valueUsd: h.valueUsd })),
    };

    let snapshotState: { recorded: boolean; snapshots: PortfolioSnapshot[] } = { recorded: false, snapshots: [] };
    try {
      snapshotState = track ? await recordPortfolioSnapshot(wallet, snapshot) : { recorded: false, snapshots: await getPortfolioSnapshots(wallet) };
    } catch {
      // History storage unavailable — balances are still real, only the value-change history is skipped.
    }
    const performance = portfolioChange(snapshotState.snapshots, totalValueUsd);

    return NextResponse.json({
      wallet,
      generatedAt,
      source: "Solana RPC on-chain balances and live public prices",
      balances: {
        sol: { amount: sol, priceUsd: usd(solPriceUsd), valueUsd: usd(solValueUsd) },
        usdc: { amount: usdcShares, valueUsd: usd(usdcValueUsd), mint: USDC_MINT, decimals: USDC_DECIMALS },
      },
      holdings,
      totalValueUsd,
      valueComplete: true,
      performance: {
        available: performance.available,
        pnlUsd: performance.changeUsd,
        since: performance.since,
        snapshots: performance.snapshots,
        note: performance.available ? "Change in wallet value since the first snapshot (includes deposits and withdrawals)." : "On-chain balances. Value history starts after the next snapshot.",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "The portfolio could not be loaded. Try again in a moment." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  return portfolioResponse(new URL(request.url).searchParams.get("wallet") ?? "", false);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { wallet?: string };
    return portfolioResponse(body.wallet ?? "", true);
  } catch { return NextResponse.json({ error: "Connect a valid Solana wallet to begin portfolio tracking." }, { status: 400 }); }
}
