import { NextResponse } from "next/server";
import { CURATED_SYMBOLS, getHydratedAsset } from "@/lib/xstocks";

const JUPITER_DEPOSIT = "https://api.jup.ag/trigger/v2/deposit/craft";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGkGzwyTDt1v";

type Body = { token?: string; symbol?: string; side?: "buy" | "sell"; kind?: "limit" | "stop" | "oco" | "dca"; userAddress?: string; amount?: string };

function isWallet(value: string) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value); }
function isRawAmount(value: string) { return /^[1-9][0-9]*$/.test(value); }

export async function POST(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!apiKey) return NextResponse.json({ error: "Jupiter is not configured." }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Authenticate the wallet before preparing a deposit." }, { status: 401 });
  let body: Body;
  try { body = await request.json() as Body; } catch { return NextResponse.json({ error: "The deposit request is not valid." }, { status: 400 }); }
  const symbol = body.symbol ?? "";
  const side = body.side === "sell" ? "sell" : "buy";
  const kind = body.kind ?? "limit";
  const userAddress = body.userAddress ?? "";
  const amount = body.amount ?? "";
  if (!CURATED_SYMBOLS.includes(symbol) || !isWallet(userAddress) || !isRawAmount(amount)) return NextResponse.json({ error: "The stock, wallet, or funding amount is not valid." }, { status: 400 });
  if (kind === "oco" && side !== "sell") return NextResponse.json({ error: "OCO protects a held position, so choose Sell." }, { status: 400 });
  if (kind === "dca" && side !== "buy") return NextResponse.json({ error: "DCA automation is for recurring buys." }, { status: 400 });
  try {
    const asset = await getHydratedAsset(symbol);
    const stockMint = asset.solanaDeployment?.address;
    if (!stockMint) return NextResponse.json({ error: "This stock's Solana deployment is still loading." }, { status: 409 });
    const inputMint = side === "buy" ? USDC_MINT : stockMint;
    const outputMint = side === "buy" ? stockMint : USDC_MINT;
    const deposit = kind === "dca"
      ? { inputMint, outputMint, userAddress, amount, orderType: "dca" }
      : { inputMint, outputMint, userAddress, amount, orderType: "price", orderSubType: kind === "oco" ? "oco" : "single" };
    const response = await fetch(JUPITER_DEPOSIT, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, Authorization: authorization }, body: JSON.stringify(deposit), cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "The unsigned deposit preview could not be prepared." }, { status: 502 }); }
}
