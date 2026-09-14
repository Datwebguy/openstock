import { NextResponse } from "next/server";

const JUPITER_TRIGGER = "https://api.jup.ag/trigger/v2/auth/verify";

export async function POST(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Jupiter authentication is not configured." }, { status: 503 });
  try {
    const body = await request.json() as { walletPubkey?: string; signature?: string; type?: "message" | "transaction" };
    if (!body.walletPubkey || !body.signature) return NextResponse.json({ error: "Wallet address and signature are required." }, { status: 400 });
    const response = await fetch(JUPITER_TRIGGER, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey }, body: JSON.stringify({ walletPubkey: body.walletPubkey, signature: body.signature, type: body.type ?? "message" }), cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "Jupiter authentication could not be completed." }, { status: 502 }); }
}
