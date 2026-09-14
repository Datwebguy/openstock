import { NextResponse } from "next/server";
import { evaluateMarketWatches } from "@/lib/market-watch-evaluator";

const COOKIE_NAME = "openstock-alert-session";
const COOKIE_PATTERN = new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([a-f0-9]{32})(?:;|$)", "i");

function sessionFrom(request: Request) {
  return request.headers.get("cookie")?.match(COOKIE_PATTERN)?.[1] ?? crypto.randomUUID().replace(/-/g, "");
}

export async function GET(request: Request) {
  const hasSession = Boolean(request.headers.get("cookie")?.match(COOKIE_PATTERN)?.[1]);
  const sessionId = sessionFrom(request);
  const state = await evaluateMarketWatches(sessionId);
  const response = NextResponse.json({ ...state, message: state.checked ? "Checks run while OpenStock is open." : "Create a watch rule to start checking a level." }, { headers: { "Cache-Control": "no-store" } });
  if (!hasSession) response.cookies.set(COOKIE_NAME, sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return response;
}
