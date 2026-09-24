"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CURATED_SWATCHES,
  clampAccentColor,
  isValidHex6,
  sanitizeHex6,
} from "@/lib/og-color-clamping";
import {
  buildTweetCopy,
  calculateXCharacterCount,
  type TweetTemplateKey,
} from "@/lib/tokenized-stock-wording";

export interface ShareTokenData {
  name: string;
  symbol: string;
  pairedStockSymbol: string;
  creatorFeeBps?: number;
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
  const cleanSymbol = useMemo(() => {
    const s = token.symbol || "TOKEN";
    return s.startsWith("$") ? s.slice(1).toUpperCase() : s.toUpperCase();
  }, [token.symbol]);

  // Color customization state
  const [colorMode, setColorMode] = useState<"auto" | "custom">("auto");
  const [customColorHex, setCustomColorHex] = useState<string>("");

  // Tone template and editable tweet text
  const [selectedTemplate, setSelectedTemplate] = useState<TweetTemplateKey>("plain");
  const [tweetText, setTweetText] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Restore user color preference from localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !token.mintAddress) return;
    const storageKey = `openstock_card_color_${token.mintAddress}`;
    const saved = localStorage.getItem(storageKey);
    if (saved && isValidHex6(saved)) {
      const clean = sanitizeHex6(saved);
      if (clean) {
        setColorMode("custom");
        setCustomColorHex(clean);
      }
    }
  }, [token.mintAddress]);

  // Canonical token page trade URL
  const canonicalUrl = useMemo(() => {
    const base = "https://joinopenstock.xyz";
    const colorQuery = colorMode === "custom" && customColorHex ? `?c=${customColorHex}&ref=x` : `?ref=x`;
    return `${base}/token/${encodeURIComponent(token.mintAddress)}${colorQuery}`;
  }, [token.mintAddress, colorMode, customColorHex]);

  // Server-rendered 1200x630 OG image URL
  const ogImageUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("symbol", cleanSymbol);
    params.set("stock", token.pairedStockSymbol || "NVDAx");
    if (token.imageUrl) {
      params.set("logo", token.imageUrl);
    }
    if (colorMode === "custom" && customColorHex) {
      params.set("c", customColorHex);
    }
    return `/api/og/token?${params.toString()}`;
  }, [cleanSymbol, token.pairedStockSymbol, token.imageUrl, colorMode, customColorHex]);

  // Sync default tweet text whenever template or canonical URL changes
  useEffect(() => {
    const text = buildTweetCopy({
      symbol: cleanSymbol,
      pairedStockSymbol: token.pairedStockSymbol || "NVDAx",
      link: canonicalUrl,
      template: selectedTemplate,
    });
    setTweetText(text);
  }, [cleanSymbol, token.pairedStockSymbol, canonicalUrl, selectedTemplate]);

  // Calculate live X character count
  const { count, remaining, isOverLimit } = useMemo(() => {
    return calculateXCharacterCount(tweetText, canonicalUrl);
  }, [tweetText, canonicalUrl]);

  // Handle color switching
  const handleSelectAuto = useCallback(() => {
    setColorMode("auto");
    setCustomColorHex("");
    if (typeof window !== "undefined" && token.mintAddress) {
      localStorage.removeItem(`openstock_card_color_${token.mintAddress}`);
    }
  }, [token.mintAddress]);

  const handleSelectColor = useCallback(
    (hex: string) => {
      const sanitized = sanitizeHex6(hex);
      if (!sanitized) return;
      const clamped = clampAccentColor(sanitized).accentHex;
      const cleanClamped = clamped.replace("#", "").toLowerCase();
      setColorMode("custom");
      setCustomColorHex(cleanClamped);
      if (typeof window !== "undefined" && token.mintAddress) {
        localStorage.setItem(`openstock_card_color_${token.mintAddress}`, cleanClamped);
      }
    },
    [token.mintAddress]
  );

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Download real server-rendered 1200x630 PNG
  async function handleDownloadImage() {
    try {
      setIsDownloading(true);
      const res = await fetch(ogImageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanSymbol}-OpenStock-Card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Direct blob download failed, opening image in new tab:", err);
      window.open(ogImageUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  }

  // Copy canonical direct trade URL
  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  }

  // Construct Twitter / X Intent URL
  const twitterIntentUrl = useMemo(() => {
    if (tweetText.includes(canonicalUrl)) {
      return `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    }
    return `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(canonicalUrl)}`;
  }, [tweetText, canonicalUrl]);

  return (
    <div className="share-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="share-modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="share-modal-container">
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-modal-title-group">
            <span className="share-x-icon" aria-hidden="true">
              𝕏
            </span>
            <div>
              <h2 id="share-modal-title" className="share-modal-title">
                Share to X
              </h2>
              <span className="share-modal-sub">
                Post your stock-paired token on X with an official OpenGraph card.
              </span>
            </div>
          </div>
          <button type="button" className="share-close-btn" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="share-modal-body">
          {/* Card Preview: Scaled server-generated PNG without overlay badges or chips */}
          <div className="share-card-preview-box">
            <img
              src={ogImageUrl}
              alt={`${cleanSymbol} Card Preview`}
              className="share-card-preview-img"
            />
          </div>

          {/* Card Color Section */}
          <div className="share-color-section">
            <div className="share-section-header">
              <label className="share-section-label">Card color</label>
              <span className="share-color-mode-indicator">
                {colorMode === "auto" ? "Auto extracted" : `#${customColorHex.toUpperCase()}`}
              </span>
            </div>

            <div className="share-swatches-row">
              <button
                type="button"
                className={`share-auto-btn ${colorMode === "auto" ? "is-active" : ""}`}
                onClick={handleSelectAuto}
                title="Use dominant vibrant color extracted from logo"
              >
                Auto
              </button>

              <div className="share-swatches-list" role="radiogroup" aria-label="Card color swatches">
                {CURATED_SWATCHES.map((swatch) => {
                  const cleanHex = swatch.hex.replace("#", "").toLowerCase();
                  const isSelected = colorMode === "custom" && customColorHex === cleanHex;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={swatch.label}
                      title={swatch.label}
                      className={`share-swatch-circle ${isSelected ? "is-active" : ""}`}
                      style={{ backgroundColor: swatch.hex }}
                      onClick={() => handleSelectColor(swatch.hex)}
                    />
                  );
                })}
              </div>

              {/* Custom Color Input */}
              <label
                className={`share-custom-picker-label ${
                  colorMode === "custom" && !CURATED_SWATCHES.some((s) => s.hex.replace("#", "").toLowerCase() === customColorHex)
                    ? "is-active"
                    : ""
                }`}
                title="Custom color picker"
              >
                <input
                  type="color"
                  className="share-custom-picker-input"
                  value={colorMode === "custom" && customColorHex ? `#${customColorHex}` : "#9945ff"}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  aria-label="Pick custom accent color"
                />
                <span className="share-picker-icon" aria-hidden="true" />
              </label>
            </div>
          </div>

          {/* Post Text Section */}
          <div className="share-tweet-composer">
            <div className="share-section-header">
              <label className="share-section-label" htmlFor="share-tweet-textarea">
                Post text
              </label>
              <div className="share-tone-tabs" role="tablist" aria-label="Tweet tone templates">
                {(["plain", "playful", "formal"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    role="tab"
                    aria-selected={selectedTemplate === tone}
                    className={`share-tone-btn ${selectedTemplate === tone ? "is-active" : ""}`}
                    onClick={() => setSelectedTemplate(tone)}
                  >
                    {tone.charAt(0).toUpperCase() + tone.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="share-tweet-textarea"
              className="share-tweet-textarea"
              rows={4}
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              aria-label="Tweet copy"
            />

            <div className="share-composer-footer">
              <span className={`share-char-counter ${isOverLimit ? "is-over-limit" : ""}`}>
                {count} / 280
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="share-modal-footer">
          <div className="share-secondary-actions">
            <button
              type="button"
              className="share-btn-secondary"
              onClick={handleDownloadImage}
              disabled={isDownloading}
            >
              {isDownloading ? "Downloading..." : "Download image"}
            </button>
            <button
              type="button"
              className="share-btn-secondary"
              onClick={handleCopyLink}
            >
              {copiedLink ? "Copied" : "Copy link"}
            </button>
          </div>

          <a
            href={twitterIntentUrl}
            target="_blank"
            rel="noreferrer"
            className="share-btn-primary"
          >
            Post to X
          </a>
        </div>
      </div>
    </div>
  );
}
