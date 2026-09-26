import { NextRequest, NextResponse } from "next/server";
import { VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { addCommunityToken } from "@/lib/community-tokens";
import {
  checkMeteoraDbcBadgeSupport,
  executeMeteoraDbcLaunch,
  prepareMeteoraDbcPoolTx,
  DBC_CURVE_KEYS,
  readDbcConfigSummary,
  resolveDbcConfigAddress,
  type DbcCurveKey,
} from "@/lib/meteora-dbc";
import { publicStoreError, writeJson } from "@/lib/json-store";
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
      supply,
      txSignature,
      mintAddress,
      poolAddress,
      curve: curveInput,
    } = body;
    const curve: DbcCurveKey = DBC_CURVE_KEYS.includes(curveInput) ? curveInput : "standard";

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

    const origin = req.nextUrl.origin || "http://localhost:3000";
    const resolvedImageUrl = resolvePublicImageUrl(imageUrl, origin) ?? "";
    if (!resolvedImageUrl || resolvedImageUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Upload token artwork or paste an https image URL." }, { status: 400 });
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1_000_000_000;
    const launchPayload = {
      name: name.trim(),
      symbol: symbol.trim(),
      description: description?.trim() || "",
      imageUrl: resolvedImageUrl || "",
      quoteMint,
      creatorWallet,
      // Creator share is fixed by the on-chain PoolConfig — the client value is ignored.
      creatorFeeBps: 0,
      supply: tokenSupply,
      pairedStockSymbol: pairedStock.symbol,
      curve,
      metadataUri: "",
    };

    // Mode 1: Prepare the authentic on-chain Meteora DBC transaction
    if (mode === "prepare") {
      // The mint keypair is generated inside prepare; metadata is stored under that mint before the tx is built.
      const prepared = await prepareMeteoraDbcPoolTx(launchPayload, async (mintAddress) => {
        await writeJson("meta:" + mintAddress, {
          name: launchPayload.name,
          symbol: launchPayload.symbol,
          description: launchPayload.description || `${launchPayload.name} paired against ${pairedStock.symbol} on Solana.`,
          image: resolvedImageUrl,
        });
        return `${origin}/api/token-metadata/${mintAddress}`;
      });
      return NextResponse.json({
        success: true,
        mode: "prepare",
        ...prepared,
      });
    }

    // Mode 2: Confirm launch with the signed transaction signature
    if (typeof txSignature !== "string" || typeof mintAddress !== "string" || typeof poolAddress !== "string" || !isSolanaAddress(mintAddress) || !isSolanaAddress(poolAddress)) {
      return NextResponse.json({ error: "Missing transaction signature, mint, or pool." }, { status: 400 });
    }

    let launchResult;
    try {
      launchResult = await executeMeteoraDbcLaunch(launchPayload, txSignature, mintAddress, poolAddress);
    } catch (verifyError) {
      return NextResponse.json({ error: verifyError instanceof Error ? verifyError.message : "Pool not verified." }, { status: 409 });
    }

    // Record the newly created community stock-pair token in the live registry
    const pairedAsset = pairedStock;

    const configAddress = resolveDbcConfigAddress({ quoteMint, pairedStockSymbol: pairedStock.symbol, curve });
    const summary = configAddress ? await readDbcConfigSummary(configAddress) : null;
    const creatorFeeOnChainBps = summary ? Math.round((summary.baseFeeBps * summary.creatorTradingFeePercent) / 100) : 0;

    let registered = true;
    let registryError: string | null = null;
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
        creatorFeeBps: creatorFeeOnChainBps,
        priceSol: 0,
        priceUsd: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        change24h: 0,
        bondingCurveProgress: 0,
        status: "new",
        holdersCount: 1,
        progressKnown: true,
        txSignature: launchResult.txHash,
        pumpUrl: launchResult.poolUrl,
        explorerUrl: launchResult.explorerUrl,
        poolAddress: launchResult.poolAddress,
        venue: "meteora",
        dexId: "meteora",
        createdAt: new Date().toISOString(),
      });
    } catch (storeErr) {
      registered = false;
      registryError = publicStoreError(storeErr, "The token is live on Solana but could not be added to the OpenStock desk.");
    }

    return NextResponse.json({
      mode: "confirm",
      ...launchResult,
      registered,
      registryError,
    });
  } catch (error: unknown) {
    console.error("Meteora DBC launch error:", error);
    const message = error instanceof Error && /not configured|metadata|Storage/.test(error.message) ? error.message : "Meteora DBC launch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
