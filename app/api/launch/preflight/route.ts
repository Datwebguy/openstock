import { NextRequest, NextResponse } from "next/server";
import { requestPreflightQuote, VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { resolvePublicImageUrl } from "@/lib/safe-image-url";
import { isSolanaAddress } from "@/lib/solana";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, imageUrl, pumpQuoteMint, pumpCreatorFeeBps, walletAddress, supply, devBuySol } = body;

    if (!name || typeof name !== "string" || name.trim().length < 1 || name.length > 32) {
      return NextResponse.json({ error: "Token name must be between 1 and 32 characters." }, { status: 400 });
    }
    if (!symbol || typeof symbol !== "string" || symbol.trim().length < 1 || symbol.length > 10) {
      return NextResponse.json({ error: "Token symbol must be between 1 and 10 characters." }, { status: 400 });
    }
    const resolvedDescription = (typeof description === "string" && description.trim().length >= 3)
      ? description.trim().slice(0, 500)
      : `${name.trim()} paired against ${symbol.trim()} on Solana via OpenStock`;

    const resolvedImageUrl = resolvePublicImageUrl(imageUrl, req.nextUrl.origin || "http://localhost:3000");
    if (!resolvedImageUrl) {
      return NextResponse.json({ error: "Please provide or upload token artwork." }, { status: 400 });
    }

    if (!pumpQuoteMint || typeof pumpQuoteMint !== "string" || !isSolanaAddress(pumpQuoteMint)) {
      return NextResponse.json({ error: "Missing selected xStock pump quote mint." }, { status: 400 });
    }

    const pairedAsset = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === pumpQuoteMint);
    if (!pairedAsset) {
      return NextResponse.json({
        error: "Choose a verified xStock pair. OpenStock launches against tokenized stocks, not SOL or USDC.",
      }, { status: 400 });
    }

    const feeBps = Number(pumpCreatorFeeBps);
    if (!Number.isInteger(feeBps) || feeBps < 50 || feeBps > 500) {
      return NextResponse.json({ error: "Creator fee must be an integer between 50 and 500 bps (0.5%–5%)." }, { status: 400 });
    }

    if (!walletAddress || typeof walletAddress !== "string" || !isSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address provided." }, { status: 400 });
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1000000000;
    const initialBuySol = devBuySol && Number.isFinite(Number(devBuySol)) && Number(devBuySol) >= 0 ? Number(devBuySol) : 0;

    const preflight = await requestPreflightQuote({
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      description: resolvedDescription,
      imageUrl: resolvedImageUrl,
      pumpQuoteMint,
      pumpCreatorFeeBps: feeBps,
      walletAddress,
      supply: tokenSupply,
      devBuySol: initialBuySol,
    });

    return NextResponse.json(preflight);
  } catch {
    return NextResponse.json({ error: "Failed to generate launch preflight quote" }, { status: 500 });
  }
}
