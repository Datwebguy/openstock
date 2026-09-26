import { NextRequest, NextResponse } from "next/server";
import { getClawPumpPairs, requestPreflightQuote, resolveLaunchDescription, VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { resolvePublicImageUrl } from "@/lib/safe-image-url";
import { isSolanaAddress } from "@/lib/solana";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, imageUrl, pumpQuoteMint, pumpCreatorFeeBps, walletAddress, supply, devBuySol, agentId, agentName } = body;

    if (!name || typeof name !== "string" || name.trim().length < 1 || name.length > 32) {
      return NextResponse.json({ error: "Token name must be between 1 and 32 characters." }, { status: 400 });
    }
    if (!symbol || typeof symbol !== "string" || symbol.trim().length < 1 || symbol.length > 10) {
      return NextResponse.json({ error: "Token symbol must be between 1 and 10 characters." }, { status: 400 });
    }
    if (!walletAddress || typeof walletAddress !== "string" || !isSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address provided." }, { status: 400 });
    }
    if (!pumpQuoteMint || typeof pumpQuoteMint !== "string" || !isSolanaAddress(pumpQuoteMint)) {
      return NextResponse.json({ error: "Missing selected xStock pump quote mint." }, { status: 400 });
    }

    const pairedAsset = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === pumpQuoteMint);
    if (!pairedAsset) {
      return NextResponse.json({ error: "Choose a verified xStock pair. OpenStock launches against tokenized stocks, not SOL or USDC." }, { status: 400 });
    }

    const resolvedImageUrl = resolvePublicImageUrl(imageUrl, req.nextUrl.origin || "http://localhost:3000");
    if (!resolvedImageUrl || resolvedImageUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Upload token artwork or paste an https image URL." }, { status: 400 });
    }

    const { creatorFeeBps: range } = await getClawPumpPairs();
    const feeBps = Number(pumpCreatorFeeBps);
    if (!Number.isInteger(feeBps) || feeBps < range.min || feeBps > range.max) {
      return NextResponse.json(
        { error: `Creator fee must be between ${(range.min / 100).toFixed(1)}% and ${(range.max / 100).toFixed(1)}%.` },
        { status: 400 }
      );
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1_000_000_000;
    const initialBuySol = devBuySol && Number.isFinite(Number(devBuySol)) && Number(devBuySol) >= 0 ? Number(devBuySol) : 0;

    const preflight = await requestPreflightQuote({
      name: name.trim(),
      symbol: symbol.trim(),
      description: resolveLaunchDescription(description, name, pairedAsset.symbol),
      imageUrl: resolvedImageUrl,
      pumpQuoteMint,
      pumpCreatorFeeBps: feeBps,
      walletAddress,
      supply: tokenSupply,
      devBuySol: initialBuySol,
      agentId: typeof agentId === "string" ? agentId : undefined,
      agentName: typeof agentName === "string" ? agentName : undefined,
    });

    return NextResponse.json({ ...preflight, creatorFeeBps: feeBps });
  } catch (error) {
    const message = error instanceof Error && /not configured|Try again/.test(error.message) ? error.message : "Failed to generate launch quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
