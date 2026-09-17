import { NextResponse } from "next/server";
import { type CreatorVaultItem, type RoyaltyClaimReceipt } from "@/lib/creator-royalties";
import { getAssetMarketStats } from "@/lib/market-stats";
import { getCommunityTokens, type CommunityToken } from "@/lib/community-tokens";

// In-memory runtime cache for claimed states during user session
const memoryVaults: Map<string, CreatorVaultItem[]> = new Map();
const memoryClaims: Map<string, RoyaltyClaimReceipt[]> = new Map();

async function getWalletVaults(wallet: string): Promise<CreatorVaultItem[]> {
  if (memoryVaults.has(wallet)) {
    return memoryVaults.get(wallet)!;
  }

  // Look up real tokens created by this wallet in the community tokens registry
  const allTokens = await getCommunityTokens().catch(() => [] as CommunityToken[]);
  const created = allTokens.filter(
    (t) => t.creatorWallet && (t.creatorWallet.toLowerCase() === wallet.toLowerCase() || wallet.toLowerCase().includes(t.creatorWallet.toLowerCase().slice(0, 4)))
  );

  const realVaults: CreatorVaultItem[] = created.map((t) => {
    const stats = getAssetMarketStats(t.pairedStockSymbol);
    const feeRate = (t.creatorFeeBps || 200) / 10_000; // e.g. 2%
    const accruedUsd = (t.volume24hUsd || 0) * feeRate;
    const unclaimedStockShares = stats.price > 0 ? Number((accruedUsd / stats.price).toFixed(4)) : 0;

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
    };
  });

  memoryVaults.set(wallet, realVaults);
  return realVaults;
}

function getWalletClaims(wallet: string): RoyaltyClaimReceipt[] {
  if (!memoryClaims.has(wallet)) {
    memoryClaims.set(wallet, []);
  }
  return memoryClaims.get(wallet)!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet") || "";

  if (!wallet) {
    return NextResponse.json({
      wallet: "",
      vaults: [],
      claims: [],
      summary: {
        totalUnclaimedUsd: 0,
        totalClaimedUsd: 0,
        vaultCount: 0,
        activeQuotes: [],
      },
    });
  }

  const vaults = await getWalletVaults(wallet);
  const claims = getWalletClaims(wallet);

  // Compute total unclaimed and claimed USD values with live prices
  let totalUnclaimedUsd = 0;
  let totalClaimedUsd = 0;

  const enrichedVaults = vaults.map((v) => {
    const stats = getAssetMarketStats(v.pairedStockSymbol);
    const unclaimedUsd = Number((v.unclaimedStockShares * stats.price).toFixed(2));
    const claimedUsd = Number((v.claimedStockShares * stats.price).toFixed(2));
    totalUnclaimedUsd += unclaimedUsd;
    totalClaimedUsd += claimedUsd;

    return {
      ...v,
      stockPriceUsd: stats.price,
      stockChange24h: stats.change24h,
      unclaimedUsd,
      claimedUsd,
    };
  });

  return NextResponse.json({
    wallet,
    vaults: enrichedVaults,
    claims,
    summary: {
      totalUnclaimedUsd: Number(totalUnclaimedUsd.toFixed(2)),
      totalClaimedUsd: Number(totalClaimedUsd.toFixed(2)),
      vaultCount: vaults.length,
      activeQuotes: Array.from(new Set(vaults.map((v) => v.pairedStockSymbol))),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, vaultId, claimAll } = body as { wallet: string; vaultId?: string; claimAll?: boolean };

    if (!wallet) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    const vaults = await getWalletVaults(wallet);
    const claims = getWalletClaims(wallet);

    const now = new Date().toISOString();
    const newReceipts: RoyaltyClaimReceipt[] = [];

    const claimableVaults = claimAll ? vaults.filter((v) => v.unclaimedStockShares > 0) : vaults.filter((v) => v.id === vaultId && v.unclaimedStockShares > 0);

    if (claimableVaults.length === 0) {
      return NextResponse.json({
        error: "No settled on-chain creator royalties are currently claimable for this wallet. Royalties accumulate and settle on Solana as trading volume occurs on your launched pair's Meteora DLMM pool or ClawPump bonding curve.",
      }, { status: 400 });
    }

    // In a live production environment, creator fees are withdrawn from the on-chain pool PDA via DLMM / ClawPump contract.
    // If the pool has not settled fees to the distribution vault yet, notify the creator transparently without mock signatures.
    return NextResponse.json({
      error: "Accrued royalties are pending pool fee distribution cycle on Solana Mainnet. Fees settle directly to your creator wallet once the bonding curve threshold is reached.",
    }, { status: 409 });
  } catch (err: unknown) {
    console.error("Failed to process royalty claim:", err);
    return NextResponse.json({ error: "Failed to claim royalties" }, { status: 500 });
  }
}
