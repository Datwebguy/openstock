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

    const launchResult = await executeClawPumpLaunch({
      name,
      symbol,
      description,
      imageUrl,
      pumpQuoteMint,
      pumpCreatorFeeBps: Number(pumpCreatorFeeBps),
      walletAddress,
      agentId,
      agentName,
      txSignature,
      preflightToken,
    });

    return NextResponse.json(launchResult);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Launch execution failed";
    console.error("Launch confirmation error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
