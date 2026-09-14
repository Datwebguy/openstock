import { NextResponse } from "next/server";

const JUPITER_VAULT = "https://api.jup.ag/trigger/v2/vault";
const JUPITER_VAULT_REGISTER = "https://api.jup.ag/trigger/v2/vault/register";

async function forward(request: Request, url: string) {
  const apiKey = process.env.JUPITER_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!apiKey) return NextResponse.json({ error: "Jupiter is not configured." }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Authenticate the wallet before checking the vault." }, { status: 401 });
  try {
    const response = await fetch(url, { method: request.method, headers: { "x-api-key": apiKey, Authorization: authorization }, cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "Vault details could not be loaded." }, { status: 502 }); }
}

export async function GET(request: Request) { return forward(request, JUPITER_VAULT); }
export async function POST(request: Request) { return forward(request, JUPITER_VAULT_REGISTER); }
