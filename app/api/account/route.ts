import { NextResponse } from "next/server";
import { accountFromSession } from "@/lib/account-store";
export async function GET(request: Request) { const sessionId = request.headers.get("cookie")?.match(/(?:^|; )openstock-account=([^;]+)/)?.[1] ?? null; return NextResponse.json({ account: await accountFromSession(sessionId) }, { headers: { "Cache-Control": "no-store" } }); }
