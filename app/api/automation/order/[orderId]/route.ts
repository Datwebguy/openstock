import { NextResponse } from "next/server";

const BASE = "https://api.jup.ag/trigger/v2";
type OrderType = "single" | "oco" | "dca";

function validId(value: string) { return /^[a-zA-Z0-9-]{8,100}$/.test(value); }

async function auth(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!apiKey) return { error: NextResponse.json({ error: "Jupiter is not configured." }, { status: 503 }) };
  if (!authorization?.startsWith("Bearer ")) return { error: NextResponse.json({ error: "Authenticate the wallet before managing this rule." }, { status: 401 }) };
  return { apiKey, authorization };
}

async function relay(url: string, method: string, request: Request, headers: { apiKey: string; authorization: string }, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json", "x-api-key": headers.apiKey, Authorization: headers.authorization }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const text = await response.text();
  return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!validId(orderId)) return NextResponse.json({ error: "The order reference is not valid." }, { status: 400 });
  const credentials = await auth(request);
  if ("error" in credentials) return credentials.error;
  let body: { orderType?: OrderType; triggerPriceUsd?: number; tpPriceUsd?: number; slPriceUsd?: number; slippageBps?: number };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "The update request is not valid." }, { status: 400 }); }
  if (body.orderType === "dca") return NextResponse.json({ error: "DCA rules cannot be edited. Cancel it and create a new rule." }, { status: 400 });
  if (body.orderType !== "single" && body.orderType !== "oco") return NextResponse.json({ error: "Choose a supported price rule." }, { status: 400 });
  return relay(`${BASE}/orders/price/${encodeURIComponent(orderId)}`, "PATCH", request, credentials, { ...body, orderType: body.orderType });
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!validId(orderId)) return NextResponse.json({ error: "The order reference is not valid." }, { status: 400 });
  const credentials = await auth(request);
  if ("error" in credentials) return credentials.error;
  let body: { orderType?: OrderType };
  try { body = await request.json() as typeof body; } catch { body = {}; }
  const path = body.orderType === "dca" ? "dca" : "price";
  return relay(`${BASE}/orders/${path}/cancel/${encodeURIComponent(orderId)}`, "POST", request, credentials);
}
