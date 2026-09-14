import { NextResponse } from "next/server";
import { getAlertState, setAlertWatch } from "@/lib/alert-store";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const COOKIE_NAME = "openstock-alert-session";
const COOKIE_PATTERN = new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([a-f0-9]{32})(?:;|$)", "i");

function sessionFrom(request: Request) {
  const existing = request.headers.get("cookie")?.match(COOKIE_PATTERN)?.[1];
  return existing ?? crypto.randomUUID().replace(/-/g, "");
}

function respond(request: Request, body: unknown, status = 200) {
  const existing = request.headers.get("cookie")?.match(COOKIE_PATTERN)?.[1];
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!existing) response.cookies.set(COOKIE_NAME, sessionFrom(request), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return response;
}

export async function GET(request: Request) {
  const sessionId = sessionFrom(request);
  const state = await getAlertState(sessionId);
  return respond(request, { ...state, scope: "server-local", message: "Alert preferences are saved to this OpenStock server session." });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { eventId?: string; symbol?: string; enabled?: boolean };
    if (!body.eventId || body.eventId.length > 200 || !body.symbol || !CURATED_SYMBOLS.includes(body.symbol) || typeof body.enabled !== "boolean") {
      return respond(request, { error: "Choose a supported issuer event and alert state." }, 400);
    }
    const sessionId = sessionFrom(request);
    const state = await setAlertWatch(sessionId, body.eventId, body.symbol, body.enabled);
    return respond(request, { ...state, scope: "server-local", message: body.enabled ? "Alert preference saved." : "Alert preference removed." });
  } catch {
    return respond(request, { error: "The alert preference could not be saved." }, 400);
  }
}
