import { NextRequest, NextResponse } from "next/server";
import { updateCommunityTokenStatus } from "@/lib/community-tokens";
import {
  prepareMeteoraDammMigrationTx,
  queryOnChainDbcProgress,
} from "@/lib/meteora-dbc";
import { Connection, PublicKey } from "@solana/web3.js";
import { DAMM_V2_PROGRAM_ID } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { isSolanaAddress } from "@/lib/solana";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

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
      if (typeof txSignature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(txSignature)) {
        return NextResponse.json({ error: "A valid transaction signature is required to confirm migration." }, { status: 400 });
      }
      if (!dammPoolAddress || !isSolanaAddress(dammPoolAddress) || (mint && !isSolanaAddress(mint))) {
        return NextResponse.json({ error: "The migration mint or pool address is not valid." }, { status: 400 });
      }

      // Only mark graduated once the chain shows the migration landed and the DAMM v2 pool exists.
      const connection = new Connection(RPC, "confirmed");
      const status = await connection.getSignatureStatus(txSignature, { searchTransactionHistory: true });
      if (!status.value || status.value.err || !status.value.confirmationStatus) {
        return NextResponse.json({ error: "The migration transaction is not confirmed on Solana yet." }, { status: 409 });
      }
      const dammAccount = await connection.getAccountInfo(new PublicKey(dammPoolAddress));
      if (!dammAccount || !dammAccount.owner.equals(DAMM_V2_PROGRAM_ID)) {
        return NextResponse.json({ error: "The DAMM v2 pool was not found on Solana." }, { status: 409 });
      }

      const targetDammPool = dammPoolAddress;
      const meteoraUrl = `https://solscan.io/account/${targetDammPool}`;
      const explorerUrl = `https://solscan.io/tx/${txSignature}`;
      let registryUpdated = false;
      if (mint) {
        try {
          registryUpdated = Boolean(await updateCommunityTokenStatus(mint, "graduated", targetDammPool, meteoraUrl));
        } catch {
          registryUpdated = false;
        }
      }

      return NextResponse.json({
        success: true,
        mode: "confirm",
        poolAddress,
        dammPoolAddress: targetDammPool,
        txHash: txSignature,
        meteoraUrl,
        explorerUrl,
        registryUpdated,
      });
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (err: unknown) {
    console.error("Meteora migration route error:", err);
    const message = err instanceof Error && /not configured|not found/.test(err.message) ? err.message : "Meteora migration transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
