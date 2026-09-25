"use client";

import { useState } from "react";
import { shortWallet, useWallet } from "@/components/wallet-session";
import {
  isAndroid,
  isMobile,
  isInAppBrowser,
  openPhantomMobile,
  openSolflareMobile,
  openBackpackMobile,
  openOkxMobile,
  openCoinbaseMobile,
  openMobileWallet,
} from "@/components/wallet-deeplink";

type WalletSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function WalletSelectModal({ isOpen, onClose }: WalletSelectModalProps) {
  const {
    address,
    connected,
    connecting,
    wallet,
    wallets,
    connect,
    connectEmail,
    disconnect,
    switchAccount,
    emailEnabled,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"wallets" | "connected">("wallets");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const mobile = isMobile();
  const inApp = isInAppBrowser();

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mwaAvailable = wallets.some(
    (w) => w.adapter.name === "Mobile Wallet Adapter" && (w.readyState === "Installed" || w.readyState === "Loadable")
  );

  const handleWalletSelect = async (walletId: string, walletName?: string) => {
    setStatusMessage(null);

    // Mobile external browser (Safari/Chrome): open the wallet app's in-app browser via its universal link.
    if (mobile && !inApp && walletId !== "mwa") {
      const opened = openMobileWallet(walletId);
      if (opened) {
        onClose();
        return;
      }
    }

    try {
      const key = await connect(walletName ?? walletId);
      if (key) onClose();
    } catch (err: unknown) {
      console.warn("Wallet connection cancelled or failed:", err);
      setStatusMessage(err instanceof Error ? err.message : "Connection was cancelled.");
    }
  };

  const handleSwitchAccount = async () => {
    setStatusMessage(null);
    try {
      await switchAccount();
      // Keep modal open so the user can pick their new account or wallet
    } catch (err) {
      console.warn("Switch account error:", err);
    }
  };

  const handleDisconnect = async () => {
    setStatusMessage(null);
    await disconnect();
    onClose();
  };

  const handleEmailClick = async () => {
    try {
      await connectEmail();
      onClose();
    } catch (error) {
      console.error("Email login failed:", error);
    }
  };

  // Check which wallets are detected/installed in current browser
  const isInstalled = (name: string) => {
    return wallets.some(
      (w) =>
        w.adapter.name.toLowerCase().includes(name.toLowerCase()) &&
        (w.readyState === "Installed" || w.readyState === "Loadable")
    );
  };

  // If already connected, show account manager with quick switch option
  if (connected && address) {
    return (
      <div className="wallet-modal-backdrop" onClick={onClose}>
        <div className="wallet-modal-card wallet-modal-card--connected" onClick={(e) => e.stopPropagation()}>
          <div className="wallet-modal-header">
            <div className="wallet-modal-title-row">
              <span className="wallet-status-dot wallet-status-dot--active" />
              <h2>Connected Account</h2>
            </div>
            <button className="wallet-modal-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="wallet-modal-body">
            {/* Active Account Card */}
            <div className="wallet-active-account-card">
              <div className="wallet-active-account-info">
                <div className="wallet-active-badge">
                  <span className="wallet-active-badge__pill">Solana Mainnet</span>
                  {wallet?.adapter.name && (
                    <span className="wallet-active-badge__name">{wallet.adapter.name}</span>
                  )}
                </div>
                <div className="wallet-active-address-row">
                  <code className="wallet-active-address">{shortWallet(address)}</code>
                  <button
                    className="button button--light wallet-copy-btn"
                    onClick={handleCopy}
                    type="button"
                    title="Copy address"
                  >
                    {copied ? "Copied! ✓" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="wallet-active-account-actions">
                <button
                  className="button button--gradient wallet-switch-btn"
                  onClick={handleSwitchAccount}
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                  </svg>
                  Switch / Change Address
                </button>

                <a
                  className="button button--light wallet-solscan-btn"
                  href={`https://solscan.io/account/${address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Solscan ↗
                </a>

                <button
                  className="button button--light wallet-disconnect-btn"
                  onClick={handleDisconnect}
                  type="button"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* Switch to a different wallet */}
            <div className="wallet-switch-section">
              <p className="wallet-switch-title">Or connect with another wallet:</p>
              <div className="wallet-options-grid wallet-options-grid--compact">
                <button
                  className="wallet-option-card wallet-option-card--compact"
                  onClick={() => handleWalletSelect("phantom", "Phantom")}
                  type="button"
                >
                  <div className="wallet-option-icon">
                    <PhantomIcon />
                  </div>
                  <div className="wallet-option-info">
                    <strong>Phantom</strong>
                  </div>
                </button>

                <button
                  className="wallet-option-card wallet-option-card--compact"
                  onClick={() => handleWalletSelect("solflare", "Solflare")}
                  type="button"
                >
                  <div className="wallet-option-icon">
                    <SolflareIcon />
                  </div>
                  <div className="wallet-option-info">
                    <strong>Solflare</strong>
                  </div>
                </button>

                <button
                  className="wallet-option-card wallet-option-card--compact"
                  onClick={() => handleWalletSelect("backpack", "Backpack")}
                  type="button"
                >
                  <div className="wallet-option-icon">
                    <BackpackIcon />
                  </div>
                  <div className="wallet-option-info">
                    <strong>Backpack</strong>
                  </div>
                </button>

                <button
                  className="wallet-option-card wallet-option-card--compact"
                  onClick={() => handleWalletSelect("okx", "OKX Wallet")}
                  type="button"
                >
                  <div className="wallet-option-icon">
                    <OkxIcon />
                  </div>
                  <div className="wallet-option-info">
                    <strong>OKX</strong>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not connected view: Full wallet picker
  return (
    <div className="wallet-modal-backdrop" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <div>
            <h2>Connect Solana Wallet</h2>
            <p className="wallet-modal-subtitle">
              {mobile && !inApp
                ? "Tap your preferred mobile wallet to connect"
                : "Select a wallet to trade and launch synthetic stock pairs"}
            </p>
          </div>
          <button className="wallet-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {statusMessage && (
          <div className="wallet-modal-alert">
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="wallet-modal-body">
          <div className="wallet-options-grid">
            {/* Android: Mobile Wallet Adapter connects an installed wallet app without leaving this browser */}
            {mobile && !inApp && isAndroid() && mwaAvailable && (
              <button
                className="wallet-option-card"
                onClick={() => handleWalletSelect("mwa", "Mobile Wallet Adapter")}
                type="button"
                disabled={connecting}
              >
                <div className="wallet-option-icon">
                  <PhantomIcon />
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-title-row">
                    <strong>Use installed wallet app</strong>
                  </div>
                  <span>Stay in this browser (Mobile Wallet Adapter)</span>
                </div>
              </button>
            )}

            {/* Phantom */}
            <button
              className="wallet-option-card"
              onClick={() => handleWalletSelect("phantom", "Phantom")}
              type="button"
              disabled={connecting}
            >
              <div className="wallet-option-icon">
                <PhantomIcon />
              </div>
              <div className="wallet-option-info">
                <div className="wallet-option-title-row">
                  <strong>Phantom</strong>
                  {isInstalled("Phantom") && <span className="wallet-installed-badge">Installed</span>}
                </div>
                <span>
                  {mobile && !inApp ? "Open in Phantom app" : "Popular Solana wallet"}
                </span>
              </div>
            </button>

            {/* Solflare */}
            <button
              className="wallet-option-card"
              onClick={() => handleWalletSelect("solflare", "Solflare")}
              type="button"
              disabled={connecting}
            >
              <div className="wallet-option-icon">
                <SolflareIcon />
              </div>
              <div className="wallet-option-info">
                <div className="wallet-option-title-row">
                  <strong>Solflare</strong>
                  {isInstalled("Solflare") && <span className="wallet-installed-badge">Installed</span>}
                </div>
                <span>
                  {mobile && !inApp ? "Open in Solflare app" : "Web3 & mobile wallet"}
                </span>
              </div>
            </button>

            {/* Backpack */}
            <button
              className="wallet-option-card"
              onClick={() => handleWalletSelect("backpack", "Backpack")}
              type="button"
              disabled={connecting}
            >
              <div className="wallet-option-icon">
                <BackpackIcon />
              </div>
              <div className="wallet-option-info">
                <div className="wallet-option-title-row">
                  <strong>Backpack</strong>
                  {isInstalled("Backpack") && <span className="wallet-installed-badge">Installed</span>}
                </div>
                <span>
                  {mobile && !inApp ? "Open in Backpack app" : "xNFT & Solana wallet"}
                </span>
              </div>
            </button>

            {/* OKX */}
            <button
              className="wallet-option-card"
              onClick={() => handleWalletSelect("okx", "OKX Wallet")}
              type="button"
              disabled={connecting}
            >
              <div className="wallet-option-icon">
                <OkxIcon />
              </div>
              <div className="wallet-option-info">
                <div className="wallet-option-title-row">
                  <strong>OKX Wallet</strong>
                  {isInstalled("OKX") && <span className="wallet-installed-badge">Installed</span>}
                </div>
                <span>
                  {mobile && !inApp ? "Open in OKX app" : "Multi-chain Web3 wallet"}
                </span>
              </div>
            </button>

            {/* Coinbase Wallet */}
            <button
              className="wallet-option-card"
              onClick={() => handleWalletSelect("coinbase", "Coinbase Wallet")}
              type="button"
              disabled={connecting}
            >
              <div className="wallet-option-icon">
                <CoinbaseIcon />
              </div>
              <div className="wallet-option-info">
                <div className="wallet-option-title-row">
                  <strong>Coinbase Wallet</strong>
                  {isInstalled("Coinbase") && <span className="wallet-installed-badge">Installed</span>}
                </div>
                <span>
                  {mobile && !inApp ? "Open in Coinbase app" : "Self-custody wallet"}
                </span>
              </div>
            </button>

            {/* Email / Google via Privy (if configured) */}
            {emailEnabled && (
              <button
                className="wallet-option-card wallet-option-card--email"
                onClick={handleEmailClick}
                type="button"
                disabled={connecting}
              >
                <div className="wallet-option-icon wallet-option-icon--email">
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" />
                  </svg>
                </div>
                <div className="wallet-option-info">
                  <strong>Email / Google</strong>
                  <span>Social login without a seed phrase</span>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="wallet-modal-footer">
          <p>
            By connecting, you agree to the OpenStock Non-Custodial Terms.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Icons
// ---------------------------------------------------------------------------

function PhantomIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#AB9FF2" />
      <path
        d="M8 20C8 13.3726 13.3726 8 20 8C26.6274 8 32 13.3726 32 20C32 26.6274 26.6274 32 20 32C13.3726 32 8 26.6274 8 20Z"
        fill="white"
      />
      <circle cx="16" cy="19" r="2.5" fill="#AB9FF2" />
      <circle cx="24" cy="19" r="2.5" fill="#AB9FF2" />
    </svg>
  );
}

function SolflareIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#FC842C" />
      <path d="M20 7L29 16L20 25L11 16L20 7Z" fill="white" />
      <path d="M20 15L29 24L20 33L11 24L20 15Z" fill="white" opacity="0.65" />
    </svg>
  );
}

function BackpackIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#E33E3E" />
      <path
        d="M13 15C13 12.7909 14.7909 11 17 11H23C25.2091 11 27 12.7909 27 15V27C27 28.6569 25.6569 30 24 30H16C14.3431 30 13 28.6569 13 27V15Z"
        fill="white"
      />
      <path
        d="M16 11V9C16 7.89543 16.8954 7 18 7H22C23.1046 7 24 7.89543 24 9V11"
        stroke="white"
        strokeWidth="2"
      />
      <rect x="17" y="19" width="6" height="5" rx="1" fill="#E33E3E" />
    </svg>
  );
}

function OkxIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#000000" />
      <rect x="11" y="11" width="8" height="8" rx="2" fill="white" />
      <rect x="21" y="11" width="8" height="8" rx="2" fill="white" />
      <rect x="16" y="16" width="8" height="8" rx="2" fill="white" />
      <rect x="11" y="21" width="8" height="8" rx="2" fill="white" />
      <rect x="21" y="21" width="8" height="8" rx="2" fill="white" />
    </svg>
  );
}

function CoinbaseIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#0052FF" />
      <circle cx="20" cy="20" r="11" fill="white" />
      <rect x="16" y="16" width="8" height="8" rx="2" fill="#0052FF" />
    </svg>
  );
}