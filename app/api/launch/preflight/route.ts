import { NextRequest, NextResponse } from "next/server";
import { requestPreflightQuote, VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { resolvePublicImageUrl } from "@/lib/safe-image-url";
import { isSolanaAddress } from "@/lib/solana";
import { getPlatformTreasuryWallet, calculateLaunchFeeBreakdown, CREATOR_FEE_MIN_BPS, CREATOR_FEE_MAX_BPS } from "@/lib/treasury";

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
    if (!Number.isInteger(feeBps) || feeBps < CREATOR_FEE_MIN_BPS || feeBps > CREATOR_FEE_MAX_BPS) {
      return NextResponse.json({ 
        error: `Creator fee must be an integer between ${CREATOR_FEE_MIN_BPS} and ${CREATOR_FEE_MAX_BPS} bps (${(CREATOR_FEE_MIN_BPS/100).toFixed(1)}%–${(CREATOR_FEE_MAX_BPS/100).toFixed(1)}%).` 
      }, { status: 400 });
    }

    // Calculate fee breakdown including platform surcharge
    const feeBreakdown = calculateLaunchFeeBreakdown(feeBps);
    const platformTreasury = getPlatformTreasuryWallet();

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

    // Add fee breakdown and platform treasury to response
    return NextResponse.json({
      ...preflight,
      feeBreakdown,
      platformTreasury,
      treasury: platformTreasury, // For backward compatibility
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate launch preflight quote" }, { status: 500 });
  }
}
