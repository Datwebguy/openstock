import { NextResponse } from "next/server";
import { USDC_MINT, isSolanaAddress } from "@/lib/solana";
import { CURATED_SYMBOLS, getHydratedAsset } from "@/lib/xstocks";

const JUPITER_PRICE_ORDER = "https://api.jup.ag/trigger/v2/orders/price";
const JUPITER_DCA_ORDER = "https://api.jup.ag/trigger/v2/orders/dca";

type Body = {
  symbol?: string;
  side?: "buy" | "sell";
  kind?: "limit" | "stop" | "oco" | "dca";
  userAddress?: string;
  depositRequestId?: string;
  depositSignedTx?: string;
  inputAmount?: string;
  trigger?: number;
  takeProfit?: number;
  stopLoss?: number;
  cadence?: string;
  rounds?: number;
};

function isWallet(value: string) { return isSolanaAddress(value); }
function isRawAmount(value: string) { return /^[1-9][0-9]*$/.test(value); }
function isSignedTransaction(value: string) { return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 100; }
function interval(cadence: string | undefined) { return cadence === "daily" ? 86400 : cadence === "monthly" ? 2592000 : 604800; }

export async function POST(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!apiKey) return NextResponse.json({ error: "Jupiter is not configured." }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Authenticate the wallet before activating a rule." }, { status: 401 });
  let body: Body;
  try { body = await request.json() as Body; } catch { return NextResponse.json({ error: "The activation request is not valid." }, { status: 400 }); }
  const symbol = body.symbol ?? "";
  const side = body.side === "sell" ? "sell" : "buy";
  const kind = body.kind ?? "limit";
  const userAddress = body.userAddress ?? "";
  const depositRequestId = body.depositRequestId ?? "";
  const depositSignedTx = body.depositSignedTx ?? "";
  const inputAmount = body.inputAmount ?? "";
  if (!CURATED_SYMBOLS.includes(symbol) || !isWallet(userAddress) || !depositRequestId || !isRawAmount(inputAmount) || !isSignedTransaction(depositSignedTx)) return NextResponse.json({ error: "Review the wallet approval and funding amount again." }, { status: 400 });
  if (kind === "oco" && side !== "sell") return NextResponse.json({ error: "OCO protects a held position, so choose Sell." }, { status: 400 });
  if (kind === "dca" && side !== "buy") return NextResponse.json({ error: "DCA automation is for recurring buys." }, { status: 400 });
  try {
    const asset = await getHydratedAsset(symbol);
    const stockMint = asset.solanaDeployment?.address;
    if (!stockMint) return NextResponse.json({ error: "This stock's Solana deployment is still loading." }, { status: 409 });
    const inputMint = side === "buy" ? USDC_MINT : stockMint;
    const outputMint = side === "buy" ? stockMint : USDC_MINT;
    const common = { depositRequestId, depositSignedTx, userPubkey: userAddress, inputMint, inputAmount, outputMint };
    let endpoint = JUPITER_PRICE_ORDER;
    let payload: Record<string, unknown>;
    if (kind === "dca") {
      const rounds = Math.floor(body.rounds ?? 4);
      if (rounds < 2) return NextResponse.json({ error: "A recurring rule needs at least two rounds." }, { status: 400 });
      payload = { ...common, orderCount: rounds, intervalSeconds: interval(body.cadence), orderType: "time_based" };
      endpoint = JUPITER_DCA_ORDER;
    } else if (kind === "oco") {
      if (!Number.isFinite(body.takeProfit) || !Number.isFinite(body.stopLoss) || (body.takeProfit ?? 0) <= (body.stopLoss ?? 0)) return NextResponse.json({ error: "Take-profit must be above stop-loss." }, { status: 400 });
      payload = { ...common, orderType: "oco", triggerMint: stockMint, tpPriceUsd: body.takeProfit, slPriceUsd: body.stopLoss, tpSlippageBps: 100, slSlippageBps: 100, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
    } else {
      if (!Number.isFinite(body.trigger) || (body.trigger ?? 0) <= 0) return NextResponse.json({ error: "Add a valid trigger price before activating this rule." }, { status: 400 });
      const triggerCondition = kind === "stop" ? (side === "sell" ? "below" : "above") : (side === "buy" ? "below" : "above");
      payload = { ...common, orderType: "single", triggerMint: stockMint, triggerCondition, triggerPriceUsd: body.trigger, slippageBps: 100, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
    }
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, Authorization: authorization }, body: JSON.stringify(payload), cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "The automation could not be activated." }, { status: 502 }); }
}
