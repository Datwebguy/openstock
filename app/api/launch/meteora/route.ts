import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { addCommunityToken } from "@/lib/community-tokens";
import {
  checkMeteoraDbcBadgeSupport,
  executeMeteoraDbcLaunch,
  prepareMeteoraDbcPoolTx,
  type DbcCurvePresetKey,
} from "@/lib/meteora-dbc";
import { resolvePublicImageUrl } from "@/lib/safe-image-url";
import { isSolanaAddress } from "@/lib/solana";

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

    if (!creatorWallet || typeof creatorWallet !== "string" || !isSolanaAddress(creatorWallet)) {
      return NextResponse.json({ error: "Missing creator wallet address." }, { status: 400 });
    }
    if (!quoteMint || typeof quoteMint !== "string" || !isSolanaAddress(quoteMint)) {
      return NextResponse.json({ error: "Missing quote mint." }, { status: 400 });
    }
    if (!name || typeof name !== "string" || !symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "Missing token name or symbol." }, { status: 400 });
    }

    const pairedStock = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === quoteMint);
    if (!pairedStock) {
      return NextResponse.json({ error: "Choose a verified xStock pair. OpenStock launches against tokenized stocks, not SOL or USDC." }, { status: 400 });
    }

    // Never let user sign or create a DBC pool that will fail on-chain with InvalidTokenBadge
    const isBadgeSupported = await checkMeteoraDbcBadgeSupport(quoteMint);
    if (!isBadgeSupported) {
      return NextResponse.json(
        {
          error: "This xStock is not badged on Meteora DBC yet. Launch against it on Pump.fun, or pick a badged stock.",
          unbadged: true,
        },
        { status: 400 }
      );
    }

    const resolvedImageUrl = resolvePublicImageUrl(imageUrl, req.nextUrl.origin || "http://localhost:3000") ?? "";

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
      pairedStockSymbol: pairedStock.symbol,
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
    const pairedAsset = pairedStock;

    try {
      await addCommunityToken({
        mint: launchResult.mintAddress,
        name: launchPayload.name,
        symbol: launchPayload.symbol,
        description: launchPayload.description || `Community token paired with ${pairedAsset.symbol} on Meteora DBC`,
        imageUrl: resolvedImageUrl,
        pairedStockSymbol: pairedAsset.symbol,
        pairedStockName: pairedAsset.name.replace(/ xStock$/, ""),
        creatorWallet,
        supply: tokenSupply,
        creatorFeeBps: Number(creatorFeeBps) || 150,
        priceSol: 0,
        priceUsd: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        change24h: 0,
        bondingCurveProgress: 0,
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
    console.error("Meteora DBC launch error:", error);
    return NextResponse.json({ error: "Meteora DBC launch failed" }, { status: 500 });
  }
}
