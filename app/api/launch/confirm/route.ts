import { NextRequest, NextResponse } from "next/server";
import { executeClawPumpLaunch } from "@/lib/clawpump";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      symbol,
      description,
      imageUrl,
      pumpQuoteMint,
      pumpCreatorFeeBps,
      walletAddress,
      agentId,
      agentName,
      txSignature,
      preflightToken,
      supply,
    } = body;

    if (!txSignature || typeof txSignature !== "string") {
      return NextResponse.json({ error: "Missing transaction signature proof." }, { status: 400 });
    }
    if (!preflightToken || typeof preflightToken !== "string") {
      return NextResponse.json({ error: "Missing preflight token." }, { status: 400 });
    }
    if (!agentId || !agentName) {
      return NextResponse.json({ error: "Missing launcher agent details." }, { status: 400 });
    }

    let resolvedImageUrl = imageUrl;
    if (resolvedImageUrl && typeof resolvedImageUrl === "string" && resolvedImageUrl.startsWith("/uploads/")) {
      const origin = req.nextUrl.origin || "http://localhost:3000";
      resolvedImageUrl = `${origin}${resolvedImageUrl}`;
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1000000000;

    const launchResult = await executeClawPumpLaunch({
      name,
      symbol,
      description,
      imageUrl: resolvedImageUrl,
      pumpQuoteMint,
      pumpCreatorFeeBps: Number(pumpCreatorFeeBps),
      walletAddress,
      agentId,
      agentName,
      txSignature,
      preflightToken,
      supply: tokenSupply,
    });

    return NextResponse.json(launchResult);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Launch execution failed";
    console.error("Launch confirmation error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
