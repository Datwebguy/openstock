import { NextRequest, NextResponse } from "next/server";
import { requestPreflightQuote } from "@/lib/clawpump";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, imageUrl, pumpQuoteMint, pumpCreatorFeeBps, walletAddress, supply, devBuySol } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length < 1 || name.length > 32) {
      return NextResponse.json({ error: "Token name must be between 1 and 32 characters." }, { status: 400 });
    }
    if (!symbol || typeof symbol !== "string" || symbol.trim().length < 1 || symbol.length > 10) {
      return NextResponse.json({ error: "Token symbol must be between 1 and 10 characters." }, { status: 400 });
    }
    const resolvedDescription = (typeof description === "string" && description.trim().length >= 3)
      ? description.trim().slice(0, 500)
      : `${name.trim()} paired against ${symbol.trim()} on Solana via OpenStock`;

    // Support device upload path (/uploads/...), data URI, or external HTTPS URL
    let resolvedImageUrl = imageUrl;
    if (!resolvedImageUrl || typeof resolvedImageUrl !== "string") {
      return NextResponse.json({ error: "Please provide or upload token artwork." }, { status: 400 });
    }

    if (resolvedImageUrl.startsWith("/uploads/")) {
      const origin = req.nextUrl.origin || "http://localhost:3000";
      resolvedImageUrl = `${origin}${resolvedImageUrl}`;
    } else if (!resolvedImageUrl.startsWith("http://") && !resolvedImageUrl.startsWith("https://") && !resolvedImageUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Artwork must be a valid uploaded image, data URL, or https:// URL." }, { status: 400 });
    }

    if (!pumpQuoteMint || typeof pumpQuoteMint !== "string") {
      return NextResponse.json({ error: "Missing selected xStock pump quote mint." }, { status: 400 });
    }

    const feeBps = Number(pumpCreatorFeeBps);
    if (!Number.isInteger(feeBps) || feeBps < 50 || feeBps > 500) {
      return NextResponse.json({ error: "Creator fee must be an integer between 50 and 500 bps (0.5%–5%)." }, { status: 400 });
    }

    if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length < 32 || walletAddress.length > 44) {
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
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Failed to generate launch preflight quote";
    console.error("Launch preflight error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
