import { NextResponse } from "next/server";
import { isSolanaAddress } from "@/lib/solana";

// Logo for tokens DexScreener has no image for: read the token's on-chain metadata (DAS getAsset on the
// server RPC), follow its JSON to the image and redirect there. 404 lets the client show its letter avatar.

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const cache = new Map<string, { at: number; url: string | null }>();

const ipfs = (url: string) => url.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/");

async function resolveImage(mint: string): Promise<string | null> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAsset", params: { id: mint } }),
    signal: AbortSignal.timeout(8_000),
  });
  const data = await res.json() as { result?: { content?: { json_uri?: string; links?: { image?: string }; files?: Array<{ uri?: string; mime?: string }> } } };
  const content = data.result?.content;
  let image = content?.links?.image || content?.files?.find((f) => f.mime?.startsWith("image/"))?.uri || "";
  if (!image && content?.json_uri) {
    const meta = await fetch(ipfs(content.json_uri), { signal: AbortSignal.timeout(6_000) }).then((r) => r.json()).catch(() => null) as { image?: string } | null;
    image = meta?.image ?? "";
  }
  return /^(https:\/\/|ipfs:\/\/)/.test(image) ? ipfs(image) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isSolanaAddress(mint)) return new NextResponse(null, { status: 400 });
  let hit = cache.get(mint);
  if (!hit || Date.now() - hit.at > 6 * 3600_000) {
    const url = await resolveImage(mint).catch(() => null);
    hit = { at: Date.now(), url };
    cache.set(mint, hit);
  }
  if (!hit.url) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
  return NextResponse.redirect(hit.url, { status: 302, headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
