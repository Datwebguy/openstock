import { NextResponse } from "next/server";
import { readJson } from "@/lib/json-store";
import { isSolanaAddress } from "@/lib/solana";

/** Metaplex-style JSON for tokens launched through OpenStock's Meteora DBC path (the on-chain `uri` points here). */
export async function GET(_: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isSolanaAddress(mint)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const metadata = await readJson<Record<string, string>>("meta:" + mint);
    if (!metadata) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(metadata, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Metadata storage is unavailable." }, { status: 503 });
  }
}
