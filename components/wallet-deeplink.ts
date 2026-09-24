/**
 * Mobile wallet deep link & in-app browser utilities for Solana
 * Supports Phantom, Solflare, Backpack, OKX, and Coinbase Wallet
 *
 * Handles both:
 * 1. Native in-app Web3 browsers (Phantom, Solflare, etc.) -> connects directly via injected provider
 * 2. Mobile external browsers (Safari, Chrome) -> opens universal link into the wallet's internal Web3 browser
 */

export type SupportedWalletId = "phantom" | "solflare" | "backpack" | "okx" | "coinbase";

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isTouchDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
  return isTouchDevice;
}

export function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detects if the user is running inside an in-app Web3 wallet browser
 * (e.g. browsing OpenStock inside Phantom app, Solflare app, Backpack, etc.)
 */
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const current = window as unknown as {
    phantom?: { solana?: { isPhantom?: boolean } };
    solflare?: { isSolflare?: boolean };
    solana?: { isPhantom?: boolean; isSolflare?: boolean };
    backpack?: { isBackpack?: boolean };
    okxwallet?: { solana?: unknown };
    coinbaseSolana?: unknown;
  };

  const hasInjectedWallet = Boolean(
    current.phantom?.solana?.isPhantom ||
    current.solflare?.isSolflare ||
    current.solana?.isPhantom ||
    current.solana?.isSolflare ||
    current.backpack?.isBackpack ||
    current.okxwallet?.solana ||
    current.coinbaseSolana
  );

  const hasInAppUserAgent =
    ua.includes("phantom") ||
    ua.includes("solflare") ||
    ua.includes("backpack") ||
    ua.includes("okx") ||
    ua.includes("coinbase");

  return isMobile() && (hasInjectedWallet || hasInAppUserAgent);
}

/**
 * Returns which specific wallet's in-app browser is active, if any.
 */
export function detectInAppWallet(): SupportedWalletId | "unknown" | "none" {
  if (typeof window === "undefined") return "none";
  const ua = navigator.userAgent.toLowerCase();
  const current = window as unknown as {
    phantom?: { solana?: { isPhantom?: boolean } };
    solflare?: { isSolflare?: boolean };
    solana?: { isPhantom?: boolean; isSolflare?: boolean };
    backpack?: { isBackpack?: boolean };
    okxwallet?: { solana?: unknown };
    coinbaseSolana?: unknown;
  };

  if (current.phantom?.solana?.isPhantom || current.solana?.isPhantom || ua.includes("phantom")) {
    return "phantom";
  }
  if (current.solflare?.isSolflare || current.solana?.isSolflare || ua.includes("solflare")) {
    return "solflare";
  }
  if (current.backpack?.isBackpack || ua.includes("backpack")) {
    return "backpack";
  }
  if (current.okxwallet?.solana || ua.includes("okx")) {
    return "okx";
  }
  if (current.coinbaseSolana || ua.includes("coinbase")) {
    return "coinbase";
  }

  return isInAppBrowser() ? "unknown" : "none";
}

/**
 * Backwards compatible with existing detectMobileWallet() calls
 */
export function detectMobileWallet(): "phantom" | "solflare" | "none" {
  const detected = detectInAppWallet();
  if (detected === "phantom") return "phantom";
  if (detected === "solflare") return "solflare";
  return "none";
}

/**
 * Generates verified universal browse link for Phantom mobile
 */
export function getPhantomUniversalLink(targetUrl?: string): string {
  if (typeof window === "undefined") return "";
  const currentUrl = targetUrl || window.location.href;
  const origin = window.location.origin;
  return `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(origin)}`;
}

/**
 * Generates verified universal browse link for Solflare mobile
 */
export function getSolflareUniversalLink(targetUrl?: string): string {
  if (typeof window === "undefined") return "";
  const currentUrl = targetUrl || window.location.href;
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(currentUrl)}`;
}

/**
 * Generates verified universal browse link for Backpack mobile
 */
export function getBackpackUniversalLink(targetUrl?: string): string {
  if (typeof window === "undefined") return "";
  const currentUrl = targetUrl || window.location.href;
  return `https://backpack.app/ul/v1/browse/${encodeURIComponent(currentUrl)}`;
}

/**
 * Generates deep link for OKX wallet mobile
 */
export function getOkxUniversalLink(targetUrl?: string): string {
  if (typeof window === "undefined") return "";
  const currentUrl = targetUrl || window.location.href;
  return `okx://wallet/dapp/details?dappUrl=${encodeURIComponent(currentUrl)}`;
}

/**
 * Generates verified universal browse link for Coinbase Wallet mobile
 */
export function getCoinbaseUniversalLink(targetUrl?: string): string {
  if (typeof window === "undefined") return "";
  const currentUrl = targetUrl || window.location.href;
  return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`;
}

export function openPhantomMobile(targetUrl?: string): void {
  const link = getPhantomUniversalLink(targetUrl);
  if (link && typeof window !== "undefined") window.location.href = link;
}

export function openSolflareMobile(targetUrl?: string): void {
  const link = getSolflareUniversalLink(targetUrl);
  if (link && typeof window !== "undefined") window.location.href = link;
}

export function openBackpackMobile(targetUrl?: string): void {
  const link = getBackpackUniversalLink(targetUrl);
  if (link && typeof window !== "undefined") window.location.href = link;
}

export function openOkxMobile(targetUrl?: string): void {
  const link = getOkxUniversalLink(targetUrl);
  if (link && typeof window !== "undefined") window.location.href = link;
}

export function openCoinbaseMobile(targetUrl?: string): void {
  const link = getCoinbaseUniversalLink(targetUrl);
  if (link && typeof window !== "undefined") window.location.href = link;
}

/**
 * Backwards compatibility aliases
 */
export function connectPhantomMobile(): void {
  openPhantomMobile();
}

export function connectSolflareMobile(): void {
  openSolflareMobile();
}

/**
 * Dispatches the universal browse link for any supported mobile wallet
 */
export function openMobileWallet(walletId: string, targetUrl?: string): boolean {
  switch (walletId.toLowerCase()) {
    case "phantom":
      openPhantomMobile(targetUrl);
      return true;
    case "solflare":
      openSolflareMobile(targetUrl);
      return true;
    case "backpack":
      openBackpackMobile(targetUrl);
      return true;
    case "okx":
    case "okx wallet":
      openOkxMobile(targetUrl);
      return true;
    case "coinbase":
    case "coinbase wallet":
      openCoinbaseMobile(targetUrl);
      return true;
    default:
      return false;
  }
}