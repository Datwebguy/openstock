import { getAssetMarketStats } from "./market-stats";

export interface CreatorVaultItem {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  pairedStockSymbol: string;
  pairedStockName: string;
  pairedStockLogo?: string;
  venue: "pumpfun" | "meteora";
  feeBps: number; // 100 to 300 bps (1.0% to 3.0%)
  tradingVolume24hUsd: number;
  unclaimedStockShares: number;
  claimedStockShares: number;
  lastClaimDate?: string;
}

export interface RoyaltyClaimReceipt {
  id: string;
  vaultId: string;
  tokenSymbol: string;
  stockSymbol: string;
  claimedShares: number;
  valueUsd: number;
  txHash: string;
  timestamp: string;
  status: "confirmed" | "pending";
}

// Initial seed vaults for any creator wallet to experience claiming
export const SEED_CREATOR_VAULTS: CreatorVaultItem[] = [
  {
    id: "vault-nvda-compute",
    tokenName: "HyperCompute",
    tokenSymbol: "COMPUTE",
    tokenLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "NVDAx",
    pairedStockName: "NVIDIA",
    venue: "pumpfun",
    feeBps: 200, // 2.0%
    tradingVolume24hUsd: 148200,
    unclaimedStockShares: 3.24,
    claimedStockShares: 11.5,
    lastClaimDate: "2026-09-15T18:30:00.000Z",
  },
  {
    id: "vault-aapl-peel",
    tokenName: "ApplePeel",
    tokenSymbol: "PEEL",
    tokenLogo: "https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "AAPLx",
    pairedStockName: "Apple",
    venue: "meteora",
    feeBps: 150, // 1.5%
    tradingVolume24hUsd: 94600,
    unclaimedStockShares: 1.85,
    claimedStockShares: 6.2,
    lastClaimDate: "2026-09-14T22:15:00.000Z",
  },
  {
    id: "vault-tsla-cyber",
    tokenName: "CyberTrucker",
    tokenSymbol: "CYBER",
    tokenLogo: "https://images.unsplash.com/photo-1617791160505-6f00b51616ec?w=200&auto=format&fit=crop&q=80",
    pairedStockSymbol: "TSLAx",
    pairedStockName: "Tesla",
    venue: "pumpfun",
    feeBps: 250, // 2.5%
    tradingVolume24hUsd: 112400,
    unclaimedStockShares: 2.15,
    claimedStockShares: 8.8,
    lastClaimDate: "2026-09-15T08:45:00.000Z",
  },
];

export const SEED_CLAIM_RECEIPTS: RoyaltyClaimReceipt[] = [
  {
    id: "rc-901",
    vaultId: "vault-nvda-compute",
    tokenSymbol: "COMPUTE",
    stockSymbol: "NVDAx",
    claimedShares: 4.5,
    valueUsd: 578.25,
    txHash: "4x8kL8M...q9Vz7N",
    timestamp: "2026-09-15T18:30:00.000Z",
    status: "confirmed",
  },
  {
    id: "rc-902",
    vaultId: "vault-aapl-peel",
    tokenSymbol: "PEEL",
    stockSymbol: "AAPLx",
    claimedShares: 3.1,
    valueUsd: 721.68,
    txHash: "3m7vK2L...p4Tx8K",
    timestamp: "2026-09-14T22:15:00.000Z",
    status: "confirmed",
  },
  {
    id: "rc-903",
    vaultId: "vault-tsla-cyber",
    tokenSymbol: "CYBER",
    stockSymbol: "TSLAx",
    claimedShares: 4.2,
    valueUsd: 1054.20,
    txHash: "5n9wP1Q...r2Ym6P",
    timestamp: "2026-09-15T08:45:00.000Z",
    status: "confirmed",
  },
];

export function calculateVaultValueUsd(shares: number, stockSymbol: string): number {
  const stats = getAssetMarketStats(stockSymbol);
  return Number((shares * stats.price).toFixed(2));
}
