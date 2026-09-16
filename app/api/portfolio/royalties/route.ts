import { NextResponse } from "next/server";
import { SEED_CREATOR_VAULTS, SEED_CLAIM_RECEIPTS, type CreatorVaultItem, type RoyaltyClaimReceipt } from "@/lib/creator-royalties";
import { getAssetMarketStats } from "@/lib/market-stats";

// In-memory runtime cache for claimed states during user session
const memoryVaults: Map<string, CreatorVaultItem[]> = new Map();
const memoryClaims: Map<string, RoyaltyClaimReceipt[]> = new Map();

function getWalletVaults(wallet: string): CreatorVaultItem[] {
  if (!memoryVaults.has(wallet)) {
    // Deep clone seeds
    memoryVaults.set(wallet, JSON.parse(JSON.stringify(SEED_CREATOR_VAULTS)));
  }
  return memoryVaults.get(wallet)!;
}

function getWalletClaims(wallet: string): RoyaltyClaimReceipt[] {
  if (!memoryClaims.has(wallet)) {
    memoryClaims.set(wallet, JSON.parse(JSON.stringify(SEED_CLAIM_RECEIPTS)));
  }
  return memoryClaims.get(wallet)!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet") || "demo-wallet";

  const vaults = getWalletVaults(wallet);
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

    const vaults = getWalletVaults(wallet);
    const claims = getWalletClaims(wallet);

    const now = new Date().toISOString();
    const newReceipts: RoyaltyClaimReceipt[] = [];

    // Simulate real Solana base58 transaction signature
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const randomTx = () => Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    if (claimAll) {
      for (const v of vaults) {
        if (v.unclaimedStockShares > 0) {
          const stats = getAssetMarketStats(v.pairedStockSymbol);
          const sharesToClaim = v.unclaimedStockShares;
          const valueUsd = Number((sharesToClaim * stats.price).toFixed(2));

          v.claimedStockShares += sharesToClaim;
          v.unclaimedStockShares = 0;
          v.lastClaimDate = now;

          const receipt: RoyaltyClaimReceipt = {
            id: `claim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            vaultId: v.id,
            tokenSymbol: v.tokenSymbol,
            stockSymbol: v.pairedStockSymbol,
            claimedShares: sharesToClaim,
            valueUsd,
            txHash: randomTx(),
            timestamp: now,
            status: "confirmed",
          };
          claims.unshift(receipt);
          newReceipts.push(receipt);
        }
      }
    } else if (vaultId) {
      const v = vaults.find((item) => item.id === vaultId);
      if (!v) {
        return NextResponse.json({ error: "Vault not found" }, { status: 404 });
      }
      if (v.unclaimedStockShares <= 0) {
        return NextResponse.json({ error: "No unclaimed royalties available in this vault" }, { status: 400 });
      }

      const stats = getAssetMarketStats(v.pairedStockSymbol);
      const sharesToClaim = v.unclaimedStockShares;
      const valueUsd = Number((sharesToClaim * stats.price).toFixed(2));

      v.claimedStockShares += sharesToClaim;
      v.unclaimedStockShares = 0;
      v.lastClaimDate = now;

      const receipt: RoyaltyClaimReceipt = {
        id: `claim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        vaultId: v.id,
        tokenSymbol: v.tokenSymbol,
        stockSymbol: v.pairedStockSymbol,
        claimedShares: sharesToClaim,
        valueUsd,
        txHash: randomTx(),
        timestamp: now,
        status: "confirmed",
      };
      claims.unshift(receipt);
      newReceipts.push(receipt);
    } else {
      return NextResponse.json({ error: "Specify vaultId or claimAll" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully claimed creator equity royalties on Solana!`,
      receipts: newReceipts,
    });
  } catch (err: unknown) {
    console.error("Failed to process royalty claim:", err);
    return NextResponse.json({ error: "Failed to claim royalties" }, { status: 500 });
  }
}
