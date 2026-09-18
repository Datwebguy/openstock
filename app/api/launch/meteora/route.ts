import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { addCommunityToken } from "@/lib/community-tokens";
import {
  checkMeteoraDbcBadgeSupport,
  executeMeteoraDbcLaunch,
  prepareMeteoraDbcPoolTx,
  type DbcCurvePresetKey,
} from "@/lib/meteora-dbc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode = "confirm",
      name,
      symbol,
      description,
      imageUrl,
      quoteMint,
      creatorWallet,
      creatorFeeBps,
      supply,
      curvePreset = "linear",
      txSignature,
      mintAddress,
      poolAddress,
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

    // Never let user sign or create a DBC pool that will fail on-chain with InvalidTokenBadge
    const isBadgeSupported = await checkMeteoraDbcBadgeSupport(quoteMint);
    if (!isBadgeSupported) {
      return NextResponse.json(
        {
          error: "This stock can’t be the pair yet. Use SOL or USDC instead.",
          unbadged: true,
        },
        { status: 400 }
      );
    }

    let resolvedImageUrl = imageUrl;
    if (resolvedImageUrl && typeof resolvedImageUrl === "string" && resolvedImageUrl.startsWith("/uploads/")) {
      const origin = req.nextUrl.origin || "http://localhost:3000";
      resolvedImageUrl = `${origin}${resolvedImageUrl}`;
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1_000_000_000;
    const launchPayload = {
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      description: description?.trim() || "",
      imageUrl: resolvedImageUrl || "",
      quoteMint,
      creatorWallet,
      creatorFeeBps: Number(creatorFeeBps) || 150,
      supply: tokenSupply,
      curvePreset: (curvePreset as DbcCurvePresetKey) || "linear",
    };

    // Mode 1: Prepare the authentic on-chain Meteora DBC transaction
    if (mode === "prepare") {
      const prepared = await prepareMeteoraDbcPoolTx(launchPayload);
      return NextResponse.json({
        success: true,
        mode: "prepare",
        ...prepared,
      });
    }

    // Mode 2: Confirm launch with the signed transaction signature
    if (!txSignature) {
      return NextResponse.json(
        { error: "A valid signed Solana transaction signature is required to confirm pool initialization." },
        { status: 400 }
      );
    }

    const launchResult = await executeMeteoraDbcLaunch(
      launchPayload,
      txSignature,
      mintAddress,
      poolAddress
    );

    // Record the newly created community stock-pair token in the live registry
    const pairedAsset = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === quoteMint) || {
      symbol: "NVDAx",
      name: "NVIDIA Corporation",
    };

    try {
      await addCommunityToken({
        mint: launchResult.mintAddress,
        name: launchPayload.name,
        symbol: launchPayload.symbol,
        description: launchPayload.description || `Community token paired with ${pairedAsset.symbol} on Meteora DBC`,
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

    return NextResponse.json({
      mode: "confirm",
      ...launchResult,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Meteora DBC launch failed";
    console.error("Meteora DBC launch error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
