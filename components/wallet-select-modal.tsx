"use client";

import { useWallet } from "@/components/wallet-session";
import { isMobile, connectPhantomMobile, connectSolflareMobile } from "@/components/wallet-deeplink";

type WalletSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function WalletSelectModal({ isOpen, onClose }: WalletSelectModalProps) {
  const { connect, connectEmail, emailEnabled } = useWallet();

  if (!isOpen) return null;

  const handlePhantomClick = async () => {
    if (isMobile()) {
      connectPhantomMobile();
    } else {
      try {
        await connect();
      } catch (error) {
        console.error("Phantom connection failed:", error);
      }
    }
    onClose();
  };

  const handleSolflareClick = async () => {
    if (isMobile()) {
      connectSolflareMobile();
    } else {
      try {
        await connect();
      } catch (error) {
        console.error("Solflare connection failed:", error);
      }
    }
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

  return (
    <div className="wallet-modal-backdrop" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <h2>Connect Wallet</h2>
          <button className="wallet-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        
        <div className="wallet-modal-body">
          <p className="wallet-modal-description">
            Choose your preferred wallet to connect to OpenStock
          </p>
          
          <div className="wallet-options-grid">
            <button 
              className="wallet-option-card"
              onClick={handlePhantomClick}
              type="button"
            >
              <div className="wallet-option-icon">
                <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="8" fill="#AB9FF2"/>
                  <path d="M8 20C8 13.3726 13.3726 8 20 8C26.6274 8 32 13.3726 32 20C32 26.6274 26.6274 32 20 32C13.3726 32 8 26.6274 8 20Z" fill="white"/>
                  <circle cx="20" cy="20" r="6" fill="#AB9FF2"/>
                </svg>
              </div>
              <div className="wallet-option-info">
                <strong>Phantom</strong>
                <span>{isMobile() ? "Open Phantom app" : "Browser extension"}</span>
              </div>
            </button>
            
            <button 
              className="wallet-option-card"
              onClick={handleSolflareClick}
              type="button"
            >
              <div className="wallet-option-icon">
                <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="8" fill="#14F195"/>
                  <path d="M20 8L28 16L20 24L12 16L20 8Z" fill="white"/>
                  <path d="M20 16L28 24L20 32L12 24L20 16Z" fill="white" opacity="0.6"/>
                </svg>
              </div>
              <div className="wallet-option-info">
                <strong>Solflare</strong>
                <span>{isMobile() ? "Open Solflare app" : "Browser extension"}</span>
              </div>
            </button>
            
            {emailEnabled && (
              <button 
                className="wallet-option-card wallet-option-card--email"
                onClick={handleEmailClick}
                type="button"
              >
                <div className="wallet-option-icon wallet-option-icon--email">
                  <svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                    <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor"/>
                  </svg>
                </div>
                <div className="wallet-option-info">
                  <strong>Email / Google</strong>
                  <span>Login with email or Google account</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}