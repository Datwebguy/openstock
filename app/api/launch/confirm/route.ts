import { NextRequest, NextResponse } from "next/server";
import { executeClawPumpLaunch, getClawPumpPairs, resolveLaunchDescription, VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { addCommunityToken } from "@/lib/community-tokens";
import { publicStoreError } from "@/lib/json-store";
import { resolvePublicImageUrl } from "@/lib/safe-image-url";
import { isSolanaAddress } from "@/lib/solana";

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

    if (!name || typeof name !== "string" || name.trim().length < 1 || name.length > 32) {
      return NextResponse.json({ error: "Token name must be between 1 and 32 characters." }, { status: 400 });
    }
    if (!symbol || typeof symbol !== "string" || symbol.trim().length < 1 || symbol.length > 10) {
      return NextResponse.json({ error: "Token symbol must be between 1 and 10 characters." }, { status: 400 });
    }
    if (!txSignature || typeof txSignature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(txSignature)) {
      return NextResponse.json({ error: "Missing transaction signature proof." }, { status: 400 });
    }
    if (!preflightToken || typeof preflightToken !== "string" || preflightToken.length > 2048) {
      return NextResponse.json({ error: "Missing preflight token." }, { status: 400 });
    }
    if (!agentId || !agentName || typeof agentId !== "string" || typeof agentName !== "string") {
      return NextResponse.json({ error: "Missing launcher agent details." }, { status: 400 });
    }
    if (!walletAddress || typeof walletAddress !== "string" || !isSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address provided." }, { status: 400 });
    }
    if (!pumpQuoteMint || typeof pumpQuoteMint !== "string" || !isSolanaAddress(pumpQuoteMint)) {
      return NextResponse.json({ error: "Missing selected xStock pump quote mint." }, { status: 400 });
    }

    const pairedAsset = VERIFIED_SOLANA_XSTOCKS_PAIRS.find((p) => p.mint === pumpQuoteMint);
    if (!pairedAsset) {
      return NextResponse.json({ error: "Choose a verified xStock pair. OpenStock launches against tokenized stocks, not SOL or USDC." }, { status: 400 });
    }

    const { creatorFeeBps: range } = await getClawPumpPairs();
    const feeBps = Number(pumpCreatorFeeBps);
    if (!Number.isInteger(feeBps) || feeBps < range.min || feeBps > range.max) {
      return NextResponse.json({ error: `Creator fee must be between ${(range.min / 100).toFixed(1)}% and ${(range.max / 100).toFixed(1)}%.` }, { status: 400 });
    }

    const resolvedImageUrl = resolvePublicImageUrl(imageUrl, req.nextUrl.origin || "http://localhost:3000");
    if (!resolvedImageUrl || resolvedImageUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Upload token artwork or paste an https image URL." }, { status: 400 });
    }

    const tokenSupply = supply && Number.isFinite(Number(supply)) && Number(supply) > 0 ? Number(supply) : 1_000_000_000;
    const initialBuySol = devBuySol && Number.isFinite(Number(devBuySol)) && Number(devBuySol) >= 0 ? Number(devBuySol) : 0;
    const resolvedDescription = resolveLaunchDescription(description, name, pairedAsset.symbol);

    let launchResult;
    try {
      launchResult = await executeClawPumpLaunch({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: resolvedDescription,
        imageUrl: resolvedImageUrl,
        pumpQuoteMint,
        pumpCreatorFeeBps: feeBps,
        walletAddress,
        agentId,
        agentName,
        txSignature,
        preflightToken,
        supply: tokenSupply,
        devBuySol: initialBuySol,
      });
    } catch (launchError) {
      // The payment already landed; the client keeps txSignature + preflightToken so the user can retry this step.
      return NextResponse.json(
        { error: launchError instanceof Error ? launchError.message : "Token launch could not be completed.", retryable: true },
        { status: 502 }
      );
    }

    let registered = true;
    let registryError: string | null = null;
    try {
      await addCommunityToken({
        mint: launchResult.mintAddress,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: resolvedDescription,
        imageUrl: resolvedImageUrl,
        pairedStockSymbol: pairedAsset.symbol,
        pairedStockName: pairedAsset.name.replace(/ xStock$/, ""),
        creatorWallet: walletAddress,
        supply: tokenSupply,
        creatorFeeBps: feeBps,
        priceSol: 0,
        priceUsd: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        change24h: 0,
        bondingCurveProgress: 0,
        progressKnown: false,
        status: "new",
        holdersCount: 0,
        txSignature,
        pumpUrl: launchResult.pumpUrl,
        explorerUrl: launchResult.explorerUrl,
        venue: "pumpfun",
        dexId: "pumpfun",
        createdAt: new Date().toISOString(),
      });
    } catch (storeErr) {
      registered = false;
      registryError = publicStoreError(storeErr, "The token is live on Pump.fun but could not be added to the OpenStock desk.");
    }

    return NextResponse.json({ ...launchResult, creatorFeeBps: feeBps, registered, registryError });
  } catch {
    return NextResponse.json({ error: "Launch execution failed" }, { status: 500 });
  }
}
