import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/account-store";
import { publicStoreError, StoreUnavailableError } from "@/lib/json-store";
export async function POST(request: Request) { try { const body = await request.json() as { wallet?: string }; return NextResponse.json({ message: await createChallenge(body.wallet ?? "") }); } catch (error) { return NextResponse.json({ error: publicStoreError(error, "The verification request could not be created.") }, { status: error instanceof StoreUnavailableError ? 503 : 400 }); } }
