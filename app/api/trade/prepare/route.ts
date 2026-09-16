import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getMarketEvidence } from "@/lib/market-evidence";
import { getHydratedAsset, XStocksApiError } from "@/lib/xstocks";
import { uiToRaw } from "@/lib/scaled-amounts";
import { USDC_DECIMALS, USDC_MINT } from "@/lib/solana";

const JUPITER_API_BASE = process.env.JUPITER_SWAP_API_BASE ?? "https://api.jup.ag/swap/v2";
type TradeRequest = { symbol?: string; side?: "buy" | "sell"; shares?: number; wallet?: string };
type OrderResponse = { transaction?: string | null; requestId?: string; lastValidBlockHeight?: number; errorMessage?: string };

function headers() { return { Accept: "application/json", "Content-Type": "application/json", ...(process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {}) }; }
async function requestJson<T>(url: string): Promise<T> { const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(12_000) }); if (!response.ok) throw new Error("Jupiter returned " + response.status); return response.json() as Promise<T>; }
function stablecoin(asset: Awaited<ReturnType<typeof getHydratedAsset>>) { const stablecoins = (asset.solanaDeployment?.stablecoins ?? []) as Array<{ currency?: string; symbol?: string; address?: string; decimals?: number }>; return stablecoins.find((coin) => coin.currency === "USD" && coin.symbol === "USDC") ?? stablecoins.find((coin) => coin.currency === "USD") ?? { address: USDC_MINT, decimals: 6 }; }

export async function POST(request: Request) {
  let body: TradeRequest;
  try { body = (await request.json()) as TradeRequest; } catch { return NextResponse.json({ error: "Enter a valid order." }, { status: 400 }); }
  const symbol = body.symbol?.trim(), side = body.side, shares = body.shares, wallet = body.wallet?.trim();
  if (!symbol || (side !== "buy" && side !== "sell") || !Number.isFinite(shares) || Number(shares) <= 0 || !wallet) return NextResponse.json({ error: "Enter a stock, share amount, and wallet before continuing." }, { status: 400 });
  try { new PublicKey(wallet); } catch { return NextResponse.json({ error: "That wallet address is not valid. Reconnect your wallet and try again." }, { status: 400 }); }
  try {
    const asset = await getHydratedAsset(symbol), evidence = await getMarketEvidence(asset);
    const poolPrice = evidence.meteora.data?.find((pool) => typeof pool.priceUsd === "number" && pool.priceUsd > 0)?.priceUsd ?? null;
    const officialReferencePrice = asset.price;
    const price = officialReferencePrice ?? poolPrice;
    const halted = Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted), multiplier = asset.multiplier?.currentMultiplier, decimals = evidence.tokenDecimals.data, stockMint = asset.solanaDeployment?.address;
    if (halted) return NextResponse.json({ error: "Trading is paused for this stock." }, { status: 409 });
    if (typeof price !== "number" || !Number.isFinite(price) || typeof multiplier !== "number" || !Number.isFinite(multiplier) || decimals === null || decimals === undefined || !stockMint) return NextResponse.json({ error: "No live issuer or onchain price is available for this order." }, { status: 409 });
    const coin = stablecoin(asset), stableMint = coin.address ?? USDC_MINT, stableDecimals = typeof coin.decimals === "number" && Number.isInteger(coin.decimals) && coin.decimals >= 0 && coin.decimals <= 18 ? coin.decimals : USDC_DECIMALS;
    const inputMint = side === "buy" ? stableMint : stockMint, outputMint = side === "buy" ? stockMint : stableMint, sellConversion = side === "sell" ? uiToRaw(Number(shares), multiplier, decimals) : null;
    if (side === "sell" && !sellConversion) return NextResponse.json({ error: "The share amount could not be converted safely." }, { status: 400 });
    const inputAmount = side === "buy" ? String(Math.max(1, Math.round(Number(shares) * price * 10 ** stableDecimals))) : sellConversion!.rawAmount;

    let order: OrderResponse;

    if (process.env.JUPITER_API_KEY) {
      const params = new URLSearchParams({ inputMint, outputMint, amount: inputAmount, taker: wallet });
      order = await requestJson<OrderResponse>(JUPITER_API_BASE + "/order?" + params);
    } else {
      // Free public Jupiter Lite route
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(inputAmount)}&slippageBps=50`;
      const quoteRes = await fetch(quoteUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (!quoteRes.ok) throw new Error("Jupiter Lite returned " + quoteRes.status);
      const quoteResponse = await quoteRes.json();

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet,
          wrapAndUnwrapSol: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!swapRes.ok) throw new Error("Jupiter Swap builder returned " + swapRes.status);
      const swapData = await swapRes.json() as { swapTransaction?: string; lastValidBlockHeight?: number };
      order = {
        transaction: swapData.swapTransaction,
        requestId: `lite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        lastValidBlockHeight: swapData.lastValidBlockHeight,
      };
    }

    if (!order.transaction || !order.requestId) return NextResponse.json({ error: order.errorMessage ?? "Jupiter did not return a live route for this stock." }, { status: 502 });
    return NextResponse.json({ symbol: asset.symbol, side, shares: Number(shares), referencePrice: price, priceSource: officialReferencePrice !== null ? "official" : "onchain_pool", multiplier, decimals, inputMint, outputMint, inputAmount, ...order, preparedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof XStocksApiError && error.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Stock not found." : "We could not prepare a live route. Try refreshing the market context." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
