/**
 * OpenStock Platform Treasury Configuration
 * Manages the designated Solana wallet address where all platform revenue,
 * launch surcharges, trading fee splits, and referral rewards are routed.
 */

export const DEFAULT_FALLBACK_TREASURY = "6zSNxgRm8p6JQcHSanFkELedbxQQnc9Jq6TMQMe6ZfYT";

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
