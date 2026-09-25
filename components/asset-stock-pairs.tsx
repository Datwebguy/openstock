"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CommunityToken } from "@/lib/community-tokens";
import { curveStatusLabel, formatTokenPrice, isOnAmmPool } from "@/lib/community-token-utils";
import { MigrationModal } from "@/components/migration-modal";

export function AssetStockPairs({ symbol }: { symbol: string }) {
  const [tokens, setTokens] = useState<CommunityToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationToken, setMigrationToken] = useState<CommunityToken | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/community-tokens?search=${encodeURIComponent(symbol)}&limit=40`, {
          cache: "no-store",
        });
        const data = await res.json();
        const list = Array.isArray(data.tokens) ? (data.tokens as CommunityToken[]) : [];
        const matched = list.filter(
          (t) => t.pairedStockSymbol?.toUpperCase() === symbol.toUpperCase()
        );
        if (!cancelled) setTokens(matched);
      } catch {
        if (!cancelled) setTokens([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const graduating = tokens.filter((t) => !isOnAmmPool(t));
  const graduated = tokens.filter(isOnAmmPool);

  return (
    <section className="asset-stock-pairs" id="pairs" aria-label={`Community pairs against ${symbol}`}>
      <div className="asset-stock-pairs__head">
        <div>
          <span className="workspace-kicker">
            <span className="live-dot" aria-hidden="true" />
            TOKEN × {symbol}
          </span>
          <h2>Pairs launched against this stock</h2>
          <p>Tokens quoted in {symbol}: OpenStock launches and existing pools found on DexScreener.</p>
        </div>
        <Link className="button button--gradient" href={`/launch?symbol=${encodeURIComponent(symbol)}&quick=1`}>
          Launch against {symbol}
        </Link>
      </div>

      {loading ? (
        <p className="workspace-note">Loading pairs…</p>
      ) : tokens.length === 0 ? (
        <p className="workspace-note">
          No community TOKEN×{symbol} pairs yet.{" "}
          <Link href={`/launch?symbol=${encodeURIComponent(symbol)}&quick=1`}>One-tap launch</Link> to create the first.
        </p>
      ) : (
        <div className="asset-stock-pairs__grid">
          {graduating.length > 0 ? (
            <div className="asset-stock-pairs__group">
              <h3>On a bonding curve</h3>
              <ul>
                {graduating.slice(0, 6).map((t) => (
                  <li key={t.mint}>
                    <button type="button" onClick={() => setMigrationToken(t)}>
                      <strong>{t.symbol}</strong>
                      <span>{curveStatusLabel(t)}</span>
                    </button>
                    <Link href={`/token/${encodeURIComponent(t.mint)}`}>Open</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {graduated.length > 0 ? (
            <div className="asset-stock-pairs__group">
              <h3>On an AMM pool</h3>
              <ul>
                {graduated.slice(0, 6).map((t) => (
                  <li key={t.mint}>
                    <div>
                      <strong>{t.symbol}</strong>
                      <span>{formatTokenPrice(t.priceUsd)} · {curveStatusLabel(t)}</span>
                    </div>
                    <Link href={`/token/${encodeURIComponent(t.mint)}`}>Trade</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {graduating.length === 0 && graduated.length === 0 ? (
            <ul className="asset-stock-pairs__simple">
              {tokens.slice(0, 8).map((t) => (
                <li key={t.mint}>
                  <strong>{t.symbol}</strong>
                  <span>{curveStatusLabel(t)}</span>
                  <Link href={`/token/${encodeURIComponent(t.mint)}`}>Open</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {migrationToken ? (
        <MigrationModal token={migrationToken} onClose={() => setMigrationToken(null)} />
      ) : null}
    </section>
  );
}
