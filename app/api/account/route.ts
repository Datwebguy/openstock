import { NextResponse } from "next/server";
import { accountFromSession } from "@/lib/account-store";
export async function GET(request: Request) { const sessionId = request.headers.get("cookie")?.match(/(?:^|; )openstock-account=([^;]+)/)?.[1] ?? null; try { return NextResponse.json({ account: await accountFromSession(sessionId) }, { headers: { "Cache-Control": "no-store" } }); } catch { return NextResponse.json({ account: null, error: "Account storage is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); } }
