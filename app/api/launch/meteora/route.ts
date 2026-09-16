import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { addCommunityToken } from "@/lib/community-tokens";
import { executeMeteoraDbcLaunch } from "@/lib/meteora-dbc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      symbol,
      description,
      imageUrl,
      quoteMint,
      creatorWallet,
      creatorFeeBps,
      supply,
      txSignature,
    } = body;

    if (!creatorWallet) {
      return NextResponse.json({ error: "Missing creator wallet address." }, { status: 400 });
    }
    if (!quoteMint) {
      return NextResponse.json({ error: "Missing quote mint." }, { status: 400 });
    }
    if (!name || !symbol) {
      return NextResponse.json({ error: "Missing token name or symbol." }, { status: 400 });
    }

    let resolvedImageUrl = imageUrl;
    if (resolvedImageUrl && typeof resolvedImageUrl === "string" && resolvedImageUrl.startsWith("/uploads/")) {
      const origin = req.nextUrl.origin || "http://localhost:3000";
      resolvedImageUrl = `${origin}${resolvedImageUrl}`;
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1000000000;

    const launchResult = await executeMeteoraDbcLaunch(
      {
        name,
        symbol,
        description: description?.trim() || "",
        imageUrl: resolvedImageUrl || "",
        quoteMint,
        creatorWallet,
        creatorFeeBps: Number(creatorFeeBps) || 150,
        supply: tokenSupply,
      },
      txSignature
    );

    // Record the newly created community stock-pair token in the live registry
    const pairedAsset = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === quoteMint) || {
      symbol: "NVDAx",
      name: "NVIDIA Corporation",
    };

    try {
      await addCommunityToken({
        mint: launchResult.mintAddress,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description?.trim() || `Community token paired with ${pairedAsset.symbol} on Meteora DBC`,
        imageUrl: resolvedImageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
        pairedStockSymbol: pairedAsset.symbol,
        pairedStockName: pairedAsset.name.replace(/ xStock$/, ""),
        creatorWallet,
        supply: tokenSupply,
        creatorFeeBps: Number(creatorFeeBps) || 150,
        priceSol: 0.000065,
        priceUsd: 0.0098,
        marketCapUsd: 98000,
        volume24hUsd: 18500,
        change24h: 15.0,
        bondingCurveProgress: 5.2,
        status: "new",
        holdersCount: 1,
        txSignature: launchResult.txHash,
        pumpUrl: launchResult.meteoraUrl,
        explorerUrl: launchResult.explorerUrl,
        poolAddress: launchResult.poolAddress,
        meteoraUrl: launchResult.meteoraUrl,
        venue: "meteora",
        createdAt: new Date().toISOString(),
      });
    } catch (storeErr) {
      console.warn("Could not record token into community store:", storeErr);
    }

    return NextResponse.json(launchResult);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Meteora DBC launch failed";
    console.error("Meteora DBC launch error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
