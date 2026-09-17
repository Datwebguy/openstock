"use client";

import { useState, useEffect } from "react";

export interface ShareTokenData {
  name: string;
  symbol: string;
  pairedStockSymbol: string;
  creatorFeeBps: number;
  venue?: string;
  mintAddress: string;
  txHash?: string;
  imageUrl?: string;
}

interface ShareToXModalProps {
  token: ShareTokenData;
  onClose: () => void;
}

export function ShareToXModal({ token, onClose }: ShareToXModalProps) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const feePercent = (token.creatorFeeBps / 100).toFixed(1);
  const venueLabel = token.venue === "meteora" ? "Meteora DLMM" : "Pump.fun Curve";
  const ogImageUrl = `/api/og/token?name=${encodeURIComponent(token.name)}&symbol=${encodeURIComponent(
    token.symbol
  )}&stock=${encodeURIComponent(token.pairedStockSymbol)}&fee=${feePercent}&venue=${token.venue || "pumpfun"}`;

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://openstock.fi";
  const shareUrl = `${currentOrigin}/launch?symbol=${token.pairedStockSymbol}`;

  const tweetContent = `Just launched $${token.symbol} paired against tokenized ${token.pairedStockSymbol} on @OpenStock_! 🚀

💎 Earning ${feePercent}% creator royalties in real $${token.pairedStockSymbol} shares
⚡ Venue: ${venueLabel}
🔍 Mint: ${token.mintAddress}

Trade on OpenStock: ${shareUrl}

#Solana #xStocks #OpenStock #${token.symbol}`;

  const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetContent)}`;

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(tweetContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="share-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="share-modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="share-modal-container">
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-modal-title-group">
            <span className="share-x-icon">𝕏</span>
            <div>
              <h2 id="share-modal-title" className="share-modal-title">
                Share to X (Twitter)
              </h2>
              <span className="share-modal-sub">
                Hype your stock-paired token with verified Solana receipts
              </span>
            </div>
          </div>
          <button type="button" className="share-close-btn" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="share-modal-body">
          {/* High-Res OG Card Preview */}
          <div className="share-card-preview-box">
            <div className="share-card-badge">
              <span>Dynamic 1200×630 OG Card</span>
            </div>
            <img
              src={ogImageUrl}
              alt={`${token.name} OpenGraph Card`}
              className="share-card-preview-img"
            />
          </div>

          {/* Tweet Textarea */}
          <div className="share-tweet-composer">
            <label className="share-tweet-label" htmlFor="tweet-textarea">
              Tweet Copy Preview
            </label>
            <textarea
              id="tweet-textarea"
              className="share-tweet-textarea"
              rows={5}
              readOnly
              value={tweetContent}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="share-modal-footer">
          <div className="share-secondary-actions">
            <button
              type="button"
              className="share-btn-secondary"
              onClick={handleCopyText}
            >
              {copiedText ? "✓ Copied Tweet!" : "Copy Text"}
            </button>
            <a
              href={ogImageUrl}
              download={`${token.symbol}-OpenStock-Card.png`}
              target="_blank"
              rel="noreferrer"
              className="share-btn-secondary"
            >
              Download Card PNG ⤓
            </a>
            <button
              type="button"
              className="share-btn-secondary"
              onClick={handleCopyLink}
            >
              {copiedLink ? "✓ Copied Link!" : "Copy Link"}
            </button>
          </div>

          <a
            href={twitterIntentUrl}
            target="_blank"
            rel="noreferrer"
            className="share-btn-primary"
          >
            <span>Post to 𝕏</span>
            <span className="share-arrow">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
