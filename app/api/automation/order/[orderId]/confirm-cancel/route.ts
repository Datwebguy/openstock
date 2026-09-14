import { NextResponse } from "next/server";

const BASE = "https://api.jup.ag/trigger/v2";

function validId(value: string) { return /^[a-zA-Z0-9-]{8,100}$/.test(value); }

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const apiKey = process.env.JUPITER_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!validId(orderId)) return NextResponse.json({ error: "The order reference is not valid." }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "Jupiter is not configured." }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Authenticate the wallet before completing cancellation." }, { status: 401 });
  let body: { orderType?: "dca" | "price"; signedTransaction?: string; cancelRequestId?: string };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "The cancellation approval is not valid." }, { status: 400 }); }
  if (!body.signedTransaction || !body.cancelRequestId) return NextResponse.json({ error: "Approve the withdrawal in your wallet first." }, { status: 400 });
  const path = body.orderType === "dca" ? "dca" : "price";
  try {
    const response = await fetch(`${BASE}/orders/${path}/confirm-cancel/${encodeURIComponent(orderId)}`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, Authorization: authorization }, body: JSON.stringify({ signedTransaction: body.signedTransaction, cancelRequestId: body.cancelRequestId }), cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "Cancellation could not be completed." }, { status: 502 }); }
}
