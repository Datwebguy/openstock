import { NextResponse } from "next/server";
import { getSolPriceUsd } from "@/lib/market-evidence";
import { getPortfolioSnapshots, portfolioChange, recordPortfolioSnapshot, type PortfolioSnapshot } from "@/lib/portfolio-snapshots";
import { USDC_DECIMALS, USDC_MINT } from "@/lib/solana";
import { CURATED_SYMBOLS, getHydratedAsset } from "@/lib/xstocks";

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
type TokenAccount = { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmountString?: string; decimals?: number; amount?: string } } } } } };
type RpcResponse<T> = { result?: T; error?: { message?: string } };
type AssetBalance = { shares: number; rawAmount: string; decimals: number };

function isWallet(value: string) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value); }
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
async function tokenBalance(wallet: string, mint: string): Promise<AssetBalance> {
  const result = await rpc<{ value?: TokenAccount[] }>("getTokenAccountsByOwner", [wallet, { mint }, { encoding: "jsonParsed" }]);
  let shares = 0; let rawAmount = BigInt(0); let decimals = 0;
  for (const item of result.value ?? []) {
    const tokenAmount = item.account?.data?.parsed?.info?.tokenAmount;
    if (!tokenAmount) continue;
    shares += Number(tokenAmount.uiAmountString ?? 0);
    if (tokenAmount.amount) rawAmount += BigInt(tokenAmount.amount);
    if (Number.isInteger(tokenAmount.decimals)) decimals = tokenAmount.decimals as number;
  }
  return { shares: Number.isFinite(shares) ? shares : 0, rawAmount: rawAmount.toString(), decimals };
}
async function solBalance(wallet: string) { return (await rpc<number>("getBalance", [wallet, { commitment: "confirmed" }])) / 1_000_000_000; }
function usd(value: number | null) { return value !== null && Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : null; }

async function portfolioResponse(wallet: string, track: boolean) {
  if (!isWallet(wallet)) return NextResponse.json({ error: "Connect a valid Solana wallet to view the portfolio." }, { status: 400 });
  try {
    const [sol, usdcResult, solPriceResult] = await Promise.all([
      solBalance(wallet), tokenBalance(wallet, USDC_MINT).catch(() => null), getSolPriceUsd().catch(() => null),
    ]);
    const assetResults: PromiseSettledResult<{ asset: Awaited<ReturnType<typeof getHydratedAsset>>; balance: AssetBalance } | null>[] = [];
    for (let index = 0; index < CURATED_SYMBOLS.length; index += 3) {
      const batch = CURATED_SYMBOLS.slice(index, index + 3).map(async (symbol) => {
        const asset = await getHydratedAsset(symbol);
        const mint = asset.solanaDeployment?.address;
        return mint ? { asset, balance: await tokenBalance(wallet, mint) } : null;
      });
      assetResults.push(...await Promise.allSettled(batch));
    }
    const usdc = usdcResult;
    const solPriceUsd = typeof solPriceResult === "number" && Number.isFinite(solPriceResult) ? solPriceResult : null;
    const holdings = assetResults.filter((result): result is PromiseFulfilledResult<{ asset: Awaited<ReturnType<typeof getHydratedAsset>>; balance: AssetBalance } | null> => result.status === "fulfilled" && Boolean(result.value)).map((result) => result.value as { asset: Awaited<ReturnType<typeof getHydratedAsset>>; balance: AssetBalance }).filter(({ balance }) => balance.shares > 0).map(({ asset, balance }) => {
      const priceUsd = asset.price !== null && Number.isFinite(asset.price) ? asset.price : null;
      return { symbol: asset.symbol, name: asset.name.replace(/ xStock$/, ""), logo: asset.logo ?? null, mint: asset.solanaDeployment?.address ?? null, decimals: asset.solanaDeployment?.decimals ?? balance.decimals, shares: balance.shares, rawAmount: balance.rawAmount, multiplier: asset.multiplier?.currentMultiplier ?? null, priceUsd: usd(priceUsd), valueUsd: usd(priceUsd === null ? null : balance.shares * priceUsd) };
    });
    const solValueUsd = solPriceUsd === null ? null : sol * solPriceUsd; const usdcValueUsd = usdc?.shares ?? null;
    const valuedHoldings = holdings.flatMap((holding) => holding.valueUsd === null ? [] : [holding.valueUsd]);
    const assetBalancesComplete = assetResults.every((result) => result.status === "fulfilled");
    const totalValueUsd = solValueUsd !== null && usdcValueUsd !== null ? usd(solValueUsd + usdcValueUsd + valuedHoldings.reduce((sum, value) => sum + value, 0)) : null;
    const generatedAt = new Date().toISOString();
    const snapshot: PortfolioSnapshot = { createdAt: generatedAt, totalValueUsd, solValueUsd: usd(solValueUsd), usdcValueUsd, holdings: holdings.map((holding) => ({ symbol: holding.symbol, shares: holding.shares, valueUsd: holding.valueUsd })) };
    const snapshotState = track ? await recordPortfolioSnapshot(wallet, snapshot) : { recorded: false, snapshots: await getPortfolioSnapshots(wallet) };
    const performance = portfolioChange(snapshotState.snapshots, totalValueUsd);
    return NextResponse.json({ wallet, generatedAt, source: "Solana RPC balances and xStocks public prices", balances: { sol: { amount: sol, priceUsd: usd(solPriceUsd), valueUsd: usd(solValueUsd) }, usdc: { amount: usdc?.shares ?? null, valueUsd: usdc === null ? null : usd(usdcValueUsd), mint: USDC_MINT, decimals: USDC_DECIMALS } }, holdings, totalValueUsd, valueComplete: totalValueUsd !== null && assetBalancesComplete, performance: { available: performance.available, pnlUsd: performance.changeUsd, since: performance.since, snapshots: performance.snapshots, note: performance.available ? "Change since tracking started." : performance.snapshots ? "Tracking started. Change appears after the next snapshot." : "Performance starts after tracking begins." } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The portfolio could not be loaded." }, { status: 502, headers: { "Cache-Control": "no-store" } });
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
