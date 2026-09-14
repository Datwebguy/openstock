import { NextResponse } from "next/server";
import { getMarketWatchState, setMarketWatch } from "@/lib/alert-store";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const COOKIE_NAME = "openstock-alert-session";
const COOKIE_PATTERN = new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([a-f0-9]{32})(?:;|$)", "i");

function sessionFrom(request: Request) {
  return request.headers.get("cookie")?.match(COOKIE_PATTERN)?.[1] ?? crypto.randomUUID().replace(/-/g, "");
}

function respond(request: Request, body: unknown, status = 200) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!request.headers.get("cookie")?.match(COOKIE_PATTERN)?.[1]) response.cookies.set(COOKIE_NAME, sessionFrom(request), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return response;
}

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol") ?? undefined;
  if (symbol && !CURATED_SYMBOLS.includes(symbol)) return respond(request, { error: "Choose a supported stock." }, 400);
  const state = await getMarketWatchState(sessionFrom(request), symbol);
  return respond(request, { ...state, message: "Watch rules are saved to this server session." });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { symbol?: string; kind?: string; direction?: string; threshold?: number; enabled?: boolean };
    const validSymbol = typeof body.symbol === "string" && CURATED_SYMBOLS.includes(body.symbol);
    const validKind = body.kind === "price" || body.kind === "liquidity";
    const validDirection = body.direction === "above" || body.direction === "below";
    const validThreshold = typeof body.threshold === "number" && Number.isFinite(body.threshold) && body.threshold > 0 && body.threshold < 1_000_000_000;
    if (!validSymbol || !validKind || !validDirection || !validThreshold || typeof body.enabled !== "boolean") return respond(request, { error: "Choose a supported stock, condition, and positive value." }, 400);
    const symbol = body.symbol as string;
    const kind = body.kind as "price" | "liquidity";
    const direction = body.direction as "above" | "below";
    const threshold = body.threshold as number;
    const state = await setMarketWatch(sessionFrom(request), { symbol, kind, direction, threshold, enabled: body.enabled });
    return respond(request, { ...state, message: body.enabled ? "Watch rule saved." : "Watch rule removed." });
  } catch {
    return respond(request, { error: "The watch rule could not be saved." }, 400);
  }
}
