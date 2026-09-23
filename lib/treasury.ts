/**
 * OpenStock Platform Treasury Configuration
 * Manages the designated Solana wallet address where all platform revenue,
 * launch surcharges, trading fee splits, and referral rewards are routed.
 */

/** OpenStock platform treasury (fee / surcharge destination). Override via PLATFORM_TREASURY_WALLET. */
export const DEFAULT_FALLBACK_TREASURY = "3FJwowmTbZ7A5EX3kSV1XGQgQWij8ZoF6Xm1rGZMhdok";

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
