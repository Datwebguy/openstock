export interface CreatorVaultItem {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  pairedStockSymbol: string;
  pairedStockName: string;
  pairedStockLogo?: string;
  venue: "pumpfun" | "meteora";
  feeBps: number;
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
