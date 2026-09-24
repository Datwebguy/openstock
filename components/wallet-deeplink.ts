/**
 * Mobile wallet deep link utilities for Phantom and Solflare
 * Enables wallet connection on mobile browsers where extensions aren't available
 */

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function connectPhantomMobile(): void {
  const appUrl = encodeURIComponent(window.location.origin);
  const redirectLink = encodeURIComponent(window.location.href);
  const cluster = "mainnet-beta";
  
  // For Phantom deep links, we need to generate a dapp encryption public key
  // This is a simplified version - in production you'd want proper crypto implementation
  const dappEncryptionPublicKey = "b4d5c2f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2";
  
  const deeplinkUrl = `https://phantom.app/ul/v1/connect?app_url=${appUrl}&dapp_encryption_public_key=${dappEncryptionPublicKey}&redirect_link=${redirectLink}&cluster=${cluster}`;
  
  window.location.href = deeplinkUrl;
}

export function connectSolflareMobile(): void {
  const appUrl = encodeURIComponent(window.location.origin);
  const redirectLink = encodeURIComponent(window.location.href);
  
  const deeplinkUrl = `https://solflare.com/wallet/deeplink?url=${redirectLink}&dapp=${appUrl}`;
  
  window.location.href = deeplinkUrl;
}

export function detectMobileWallet(): "phantom" | "solflare" | "none" {
  if (typeof window === "undefined") return "none";
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes("phantom")) return "phantom";
  if (userAgent.includes("solflare")) return "solflare";
  
  return "none";
}