import { NextRequest, NextResponse } from "next/server";
import { executeClawPumpLaunch, VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { addCommunityToken } from "@/lib/community-tokens";

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
      devBuySol,
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
    const initialBuySol = devBuySol && Number.isFinite(Number(devBuySol)) && Number(devBuySol) >= 0 ? Number(devBuySol) : 0;

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
      devBuySol: initialBuySol,
    });

    // Record the newly created community stock-pair token in the live registry
    const pairedAsset = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === pumpQuoteMint) || {
      symbol: "NVDAx",
      name: "NVIDIA Corporation",
    };

    try {
      await addCommunityToken({
        mint: launchResult.mintAddress,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description?.trim() || `Community token paired with ${pairedAsset.symbol} on Solana`,
        imageUrl: resolvedImageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
        pairedStockSymbol: pairedAsset.symbol,
        pairedStockName: pairedAsset.name.replace(/ xStock$/, ""),
        creatorWallet: walletAddress,
        supply: tokenSupply,
        creatorFeeBps: Number(pumpCreatorFeeBps),
        priceSol: 0.00005,
        priceUsd: 0.0075,
        marketCapUsd: 75000,
        volume24hUsd: 14200,
        change24h: 12.5,
        bondingCurveProgress: 4.8,
        status: "new",
        holdersCount: 1,
        txSignature,
        pumpUrl: launchResult.pumpUrl,
        explorerUrl: launchResult.explorerUrl,
        createdAt: new Date().toISOString(),
      });
    } catch (storeErr) {
      console.warn("Could not record token into community store:", storeErr);
    }

    return NextResponse.json(launchResult);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Launch execution failed";
    console.error("Launch confirmation error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
