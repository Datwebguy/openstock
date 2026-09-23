import { NextRequest, NextResponse } from "next/server";
import { updateCommunityTokenStatus } from "@/lib/community-tokens";
import {
  prepareMeteoraDammMigrationTx,
  queryOnChainDbcProgress,
} from "@/lib/meteora-dbc";
import { isSolanaAddress } from "@/lib/solana";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const poolAddress = searchParams.get("poolAddress");

    if (!poolAddress || !isSolanaAddress(poolAddress)) {
      return NextResponse.json({ error: "Missing poolAddress parameter." }, { status: 400 });
    }

    const progress = await queryOnChainDbcProgress(poolAddress);
    return NextResponse.json({
      success: true,
      poolAddress,
      progress,
      isGraduated: progress !== null && progress >= 100,
    });
  } catch {
    return NextResponse.json({ error: "Failed to query DBC progress" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode = "prepare",
      poolAddress,
      payerWallet,
      mint,
      txSignature,
      dammPoolAddress,
    } = body;

    if (!poolAddress || !isSolanaAddress(poolAddress)) {
      return NextResponse.json({ error: "Missing DBC poolAddress." }, { status: 400 });
    }

    // Mode 1: Query on-chain progress
    if (mode === "progress") {
      const progress = await queryOnChainDbcProgress(poolAddress);
      return NextResponse.json({
        success: true,
        poolAddress,
        progress,
        isGraduated: progress !== null && progress >= 100,
      });
    }

    // Mode 2: Prepare DAMM v2 Migration Transaction
    if (mode === "prepare") {
      if (!payerWallet || !isSolanaAddress(payerWallet)) {
        return NextResponse.json({ error: "Missing payerWallet address." }, { status: 400 });
      }

      const prepared = await prepareMeteoraDammMigrationTx(poolAddress, payerWallet);
      return NextResponse.json({
        success: true,
        mode: "prepare",
        poolAddress,
        mint,
        ...prepared,
      });
    }

    // Mode 3: Confirm Migration with broadcasted txSignature
    if (mode === "confirm") {
      if (!txSignature) {
        return NextResponse.json(
          { error: "A valid signed Solana transaction signature is required to confirm migration." },
          { status: 400 }
        );
      }

      const targetDammPool = dammPoolAddress || poolAddress;
      const meteoraUrl = `https://app.meteora.ag/dlmm/${targetDammPool}`;
      const explorerUrl = `https://solscan.io/tx/${txSignature}`;

      if (mint) {
        if (!isSolanaAddress(mint) || (dammPoolAddress && !isSolanaAddress(dammPoolAddress))) {
          return NextResponse.json({ error: "The migration mint or pool address is not valid." }, { status: 400 });
        }
        await updateCommunityTokenStatus(mint, "graduated", targetDammPool, meteoraUrl);
      }

      return NextResponse.json({
        success: true,
        mode: "confirm",
        poolAddress,
        dammPoolAddress: targetDammPool,
        txHash: txSignature,
        meteoraUrl,
        explorerUrl,
      });
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (err: unknown) {
    console.error("Meteora migration route error:", err);
    return NextResponse.json({ error: "Meteora migration transaction failed" }, { status: 500 });
  }
}
