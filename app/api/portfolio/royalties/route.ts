import { NextResponse } from "next/server";
import { type CreatorVaultItem, type RoyaltyClaimReceipt } from "@/lib/creator-royalties";
import { getCommunityTokens, type CommunityToken } from "@/lib/community-tokens";
import { getCreatorPoolFees, prepareClaimCreatorTradingFeeTx } from "@/lib/meteora-dbc";
import { isSolanaAddress } from "@/lib/solana";

const memoryClaims: Map<string, RoyaltyClaimReceipt[]> = new Map();

function rawToUi(raw: string, decimals = 6): number {
  try {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n / 10 ** decimals;
  } catch {
    return 0;
  }
}

async function getWalletVaults(wallet: string): Promise<(CreatorVaultItem & { poolAddress?: string; unclaimedQuoteRaw?: string })[]> {
  const allTokens = await getCommunityTokens().catch(() => [] as CommunityToken[]);
  const created = allTokens.filter(
    (t) => t.creatorWallet && t.creatorWallet.toLowerCase() === wallet.toLowerCase()
  );

  let onChainFees: Awaited<ReturnType<typeof getCreatorPoolFees>> = [];
  try {
    onChainFees = await getCreatorPoolFees(wallet);
  } catch (err) {
    console.warn("getCreatorPoolFees failed:", err);
  }

  const feeByPool = new Map(onChainFees.map((f) => [f.poolAddress, f]));

  return created.map((t) => {
    const fee = t.poolAddress ? feeByPool.get(t.poolAddress) : undefined;
    const unclaimedQuoteRaw = fee?.unclaimedQuoteFeeRaw ?? "0";
    const unclaimedStockShares = rawToUi(unclaimedQuoteRaw, 6);

    return {
      id: `vault-${t.mint}`,
      tokenName: t.name,
      tokenSymbol: t.symbol,
      tokenLogo: t.imageUrl,
      pairedStockSymbol: t.pairedStockSymbol,
      pairedStockName: t.pairedStockName,
      venue: t.venue || "meteora",
      feeBps: t.creatorFeeBps || 200,
      tradingVolume24hUsd: t.volume24hUsd || 0,
      unclaimedStockShares,
      claimedStockShares: 0,
      lastClaimDate: undefined,
      poolAddress: t.poolAddress,
      unclaimedQuoteRaw,
    };
  });
}

function getWalletClaims(wallet: string): RoyaltyClaimReceipt[] {
  if (!memoryClaims.has(wallet)) memoryClaims.set(wallet, []);
  return memoryClaims.get(wallet)!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet") || "";

  if (!wallet || !isSolanaAddress(wallet)) {
    return NextResponse.json({
      wallet: "",
      vaults: [],
      claims: [],
      summary: { totalUnclaimedUsd: 0, totalClaimedUsd: 0, vaultCount: 0, activeQuotes: [] },
    });
  }

  const vaults = await getWalletVaults(wallet);
  const claims = getWalletClaims(wallet);

  // Stock-share units are already quote-token amounts (xStock). USD is unknown without a live price — leave 0 when unavailable.
  const enrichedVaults = vaults.map((v) => ({
    ...v,
    stockPriceUsd: 0,
    stockChange24h: null as number | null,
    unclaimedUsd: 0,
    claimedUsd: 0,
  }));

  return NextResponse.json({
    wallet,
    vaults: enrichedVaults,
    claims,
    summary: {
      totalUnclaimedUsd: 0,
      totalClaimedUsd: 0,
      vaultCount: vaults.length,
      activeQuotes: Array.from(new Set(vaults.map((v) => v.pairedStockSymbol))),
      totalUnclaimedStockShares: Number(
        vaults.reduce((acc, v) => acc + (v.unclaimedStockShares || 0), 0).toFixed(6)
      ),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, vaultId, claimAll } = body as { wallet: string; vaultId?: string; claimAll?: boolean };

    if (!wallet || !isSolanaAddress(wallet)) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    const vaults = await getWalletVaults(wallet);
    const targets = claimAll
      ? vaults.filter((v) => (v.unclaimedStockShares || 0) > 0 && v.poolAddress && v.venue !== "pumpfun")
      : vaults.filter((v) => v.id === vaultId && (v.unclaimedStockShares || 0) > 0 && v.poolAddress);

    if (targets.length === 0) {
      const pumpOnly = vaults.some((v) => v.id === vaultId && v.venue === "pumpfun");
      return NextResponse.json({
        error: pumpOnly
          ? "Pump.fun creator fee claim is not wired yet. Meteora DBC stock-paired fees can be claimed when unclaimed quote balance is > 0."
          : "No claimable Meteora creator fees in the paired xStock for this wallet right now.",
      }, { status: 400 });
    }

    // Prepare the first claimable pool tx (client signs). Multi-vault claim-all returns one at a time.
    const target = targets[0];
    if (!target.poolAddress) {
      return NextResponse.json({ error: "Pool address missing for this vault." }, { status: 400 });
    }

    const prepared = await prepareClaimCreatorTradingFeeTx({
      poolAddress: target.poolAddress,
      creatorWallet: wallet,
      maxQuoteAmount: target.unclaimedQuoteRaw && target.unclaimedQuoteRaw !== "0"
        ? target.unclaimedQuoteRaw
        : undefined,
    });

    return NextResponse.json({
      success: true,
      mode: "prepare",
      vaultId: target.id,
      poolAddress: prepared.poolAddress,
      pairedStockSymbol: target.pairedStockSymbol,
      unclaimedStockShares: target.unclaimedStockShares,
      transactionBase64: prepared.transactionBase64,
      remainingVaults: Math.max(0, targets.length - 1),
    });
  } catch (err: unknown) {
    console.error("Failed to process royalty claim:", err);
    const message = err instanceof Error ? err.message : "Failed to prepare royalty claim";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
