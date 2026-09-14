import { NextResponse } from "next/server";

const JUPITER_HISTORY = "https://api.jup.ag/trigger/v2/orders/history";

export async function GET(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!apiKey) return NextResponse.json({ error: "Jupiter is not configured." }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Authenticate the wallet before loading automation history." }, { status: 401 });
  try {
    const url = new URL(JUPITER_HISTORY);
    url.searchParams.set("limit", "50");
    const response = await fetch(url, { headers: { "x-api-key": apiKey, Authorization: authorization }, cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "Automation history could not be loaded." }, { status: 502 }); }
}
