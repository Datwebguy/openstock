import { NextResponse } from "next/server";
import { verifyChallenge } from "@/lib/account-store";
import { publicStoreError, StoreUnavailableError } from "@/lib/json-store";
const COOKIE = "openstock-account";
export async function POST(request: Request) { try { const body = await request.json() as { wallet?: string; signature?: string }; const result = await verifyChallenge(body.wallet ?? "", body.signature ?? ""); const response = NextResponse.json({ account: result.account }); response.cookies.set(COOKIE, result.sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 }); return response; } catch (error) { return NextResponse.json({ error: publicStoreError(error, "Wallet verification failed.") }, { status: error instanceof StoreUnavailableError ? 503 : 400 }); } }
