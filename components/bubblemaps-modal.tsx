"use client";

import { useEffect, useState } from "react";
import { StockLogo } from "@/components/stock-logo";
import type { CommunityToken } from "@/lib/community-tokens";

type BubblemapsModalProps = {
  token: CommunityToken;
  onClose: () => void;
};

type Holder = { owner: string; tokenAccount: string; uiAmount: number; pct: number };
type HolderData = { supplyUi: number; holders: Holder[]; top10Pct: number; fetchedAt: string };

function short(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Top holders read from Solana (getTokenLargestAccounts), plus a link to the token's real Bubblemaps map.
 * Pool vaults and the curve itself appear as holders — they are labelled when they match the known pool.
 */
export function BubblemapsModal({ token, onClose }: BubblemapsModalProps) {
  const [data, setData] = useState<HolderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/token-holders?mint=${encodeURIComponent(token.mint)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Holder data is unavailable right now.");
        if (!cancelled) setData(body as HolderData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Holder data is unavailable right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [token.mint]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copyMint() {
    void navigator.clipboard.writeText(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function labelFor(holder: Holder) {
    if (token.poolAddress && holder.owner === token.poolAddress) return "Pool";
    if (token.creatorWallet && holder.owner === token.creatorWallet) return "Creator";
    return null;
  }

  return (
    <div className="os-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="holders-title">
      <div className="os-modal-card bubblemaps-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bubblemaps-modal-header">
          <div className="bubblemaps-token-info">
            {token.imageUrl ? <img src={token.imageUrl} alt="" className="bubblemaps-token-avatar" /> : null}
            <div>
              <div className="bubblemaps-token-title">
                <h3 id="holders-title">{token.name}</h3>
                <span className="bubblemaps-token-sym">${token.symbol}</span>
              </div>
              <div className="bubblemaps-token-pair">
                <span>Paired with</span>
                <StockLogo symbol={token.pairedStockSymbol} size={18} />
                <strong>{token.pairedStockSymbol}</strong>
              </div>
            </div>
          </div>
          <button type="button" className="os-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="bubblemaps-mint-bar">
          <span className="bubblemaps-mint-label">Mint</span>
          <code className="bubblemaps-mint-code">{token.mint}</code>
          <button type="button" className="bubblemaps-copy-btn" onClick={copyMint}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <a href={`https://solscan.io/token/${token.mint}#holders`} target="_blank" rel="noreferrer" className="bubblemaps-link-out">
            Solscan ↗
          </a>
          <a href={`https://app.bubblemaps.io/sol/token/${token.mint}`} target="_blank" rel="noreferrer" className="bubblemaps-link-out">
            Bubblemaps ↗
          </a>
        </div>

        <div className="bubblemaps-canvas-wrap">
          <div className="bubblemaps-canvas-kicker">
            <span>Top holders on Solana</span>
            <small>
              {data
                ? `Top 10 hold ${data.top10Pct.toFixed(1)}% of supply · pool vaults count as holders`
                : error ?? "Reading token accounts…"}
            </small>
          </div>
          {data ? (
            <ol className="bubblemaps-holder-list">
              {data.holders.slice(0, 10).map((holder) => (
                <li key={holder.tokenAccount}>
                  <a href={`https://solscan.io/account/${holder.owner}`} target="_blank" rel="noreferrer">
                    {short(holder.owner)}
                  </a>
                  {labelFor(holder) ? <span className="bubblemaps-holder-tag">{labelFor(holder)}</span> : null}
                  <strong>{holder.pct.toFixed(2)}%</strong>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </div>
  );
}
