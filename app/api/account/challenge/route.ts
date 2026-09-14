import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/account-store";
export async function POST(request: Request) { try { const body = await request.json() as { wallet?: string }; return NextResponse.json({ message: await createChallenge(body.wallet ?? "") }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The verification request could not be created." }, { status: 400 }); } }
