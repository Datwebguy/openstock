/**
 * OpenStock Platform Treasury Configuration
 * Manages the designated Solana wallet address where all platform revenue,
 * launch surcharges, trading fee splits, and referral rewards are routed.
 */

/** OpenStock platform treasury (fee / surcharge destination). Override via PLATFORM_TREASURY_WALLET. */
export const DEFAULT_FALLBACK_TREASURY = "3FJwowmTbZ7A5EX3kSV1XGQgQWij8ZoF6Xm1rGZMhdok";

/**
 * Platform fee configuration for token launches
 * Platform surcharge is added on top of creator fees to fund platform operations
 */
export const PLATFORM_LAUNCH_FEE_BPS = 100; // 1% platform surcharge on all launches

/**
 * Minimum and maximum creator fee ranges (basis points)
 * Creator fees are set by the token creator
 */
export const CREATOR_FEE_MIN_BPS = 50; // 0.5%
export const CREATOR_FEE_MAX_BPS = 500; // 5%
export const CREATOR_FEE_DEFAULT_BPS = 100; // 1%

/**
 * Fee structure breakdown for token launches:
 * - Creator fee: Set by creator (0.5%–5%), goes to token creator
 * - Platform fee: 1% surcharge, goes to OpenStock treasury
 * - ClawPump fee: Taken by ClawPump from the transaction (not transparent in API)
 * 
 * Total fee from token trades = Creator fee + Platform fee + ClawPump fee
 */

/**
 * Returns the currently active platform treasury wallet address.
 * Prioritizes environment variables, falling back to the default dev wallet.
 */
export function getPlatformTreasuryWallet(): string {
  const envTreasury =
    process.env.PLATFORM_TREASURY_WALLET ||
    process.env.NEXT_PUBLIC_PLATFORM_TREASURY_WALLET;

  if (envTreasury && envTreasury.trim().length >= 32 && envTreasury.trim().length <= 44) {
    return envTreasury.trim();
  }

  return DEFAULT_FALLBACK_TREASURY;
}

/**
 * Calculate total fee breakdown for a launch
 * @param creatorFeeBps - Creator fee in basis points (e.g., 100 = 1%)
 * @returns Fee breakdown object
 */
export function calculateLaunchFeeBreakdown(creatorFeeBps: number) {
  return {
    creatorFeeBps: creatorFeeBps,
    platformFeeBps: PLATFORM_LAUNCH_FEE_BPS,
    totalFeeBps: creatorFeeBps + PLATFORM_LAUNCH_FEE_BPS,
    creatorFeePercent: (creatorFeeBps / 100).toFixed(2) + '%',
    platformFeePercent: (PLATFORM_LAUNCH_FEE_BPS / 100).toFixed(2) + '%',
    totalFeePercent: ((creatorFeeBps + PLATFORM_LAUNCH_FEE_BPS) / 100).toFixed(2) + '%',
  };
}
