import { NextRequest, NextResponse } from "next/server";
import { requestPreflightQuote } from "@/lib/clawpump";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, imageUrl, pumpQuoteMint, pumpCreatorFeeBps, walletAddress } = body;

    // Strict validation matching ClawPump specifications
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 32) {
      return NextResponse.json({ error: "Token name must be between 1 and 32 characters." }, { status: 400 });
    }
    if (!symbol || typeof symbol !== "string" || symbol.length < 1 || symbol.length > 10) {
      return NextResponse.json({ error: "Token symbol must be between 1 and 10 characters." }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.length < 20 || description.length > 500) {
      return NextResponse.json({ error: "Description must be between 20 and 500 characters." }, { status: 400 });
    }
    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Image URL must be a valid https:// URL." }, { status: 400 });
    }
    if (!pumpQuoteMint || typeof pumpQuoteMint !== "string") {
      return NextResponse.json({ error: "Missing selected xStock pump quote mint." }, { status: 400 });
    }
    const feeBps = Number(pumpCreatorFeeBps);
    if (!Number.isInteger(feeBps) || feeBps < 100 || feeBps > 300) {
      return NextResponse.json({ error: "Creator fee must be an integer between 100 and 300 bps (1%–3%)." }, { status: 400 });
    }
    if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json({ error: "Invalid Solana wallet address provided." }, { status: 400 });
    }

    const preflight = await requestPreflightQuote({
      name,
      symbol: symbol.toUpperCase(),
      description,
      imageUrl,
      pumpQuoteMint,
      pumpCreatorFeeBps: feeBps,
      walletAddress,
    });

    return NextResponse.json(preflight);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Failed to generate launch preflight quote";
    console.error("Launch preflight error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
