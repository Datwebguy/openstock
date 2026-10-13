"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StockLogo } from "@/components/stock-logo";
import type { DbcPreset } from "@/lib/dbc-catalog";

type CatalogResponse = {
  success?: boolean;
  program?: string;
  dammV2Config?: string;
  dammV2FeeBps?: number;
  presets?: DbcPreset[];
  builder?: Record<string, { method: string; path: string }>;
  notes?: string[];
};

function usd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1000) return `~$${Math.round(value).toLocaleString("en-US")}`;
  return `~$${value.toFixed(2)}`;
}

export function DbcPresetDesk() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/launch/dbc-presets", { cache: "no-store" });
        const body = (await res.json()) as CatalogResponse;
        if (!res.ok) throw new Error("Could not read on-chain PoolConfigs.");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load presets.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  }

  const presets = data?.presets ?? [];

  return (
    <div className="launch-container dbc-preset-desk">
      <section className="launch-intro" aria-labelledby="preset-title">
        <div className="launch-intro-top">
          <Link href="/launch" className="launch-back-link">
            <span aria-hidden="true">←</span> Back to Launch
          </Link>
          <span className="launch-network-pill">
            <span className="launch-pulse-dot" /> Mainnet PoolConfigs
          </span>
        </div>
        <div className="launch-intro-body">
          <span className="launch-studio-kicker">
            <span className="launch-pulse-dot" /> METEORA DBC PRESETS
          </span>
          <h1 id="preset-title" className="launch-intro-title">
            Equity curves, on chain
          </h1>
          <p className="launch-intro-desc">
            Three curve styles per stock. Fees, quote mint, and DAMM v2 graduation are read from the Meteora DBC program.
            Builders can copy a config address and launch against the same xStock quote.
          </p>
        </div>
      </section>

      {error ? <p className="launch-badge-note">{error}</p> : null}

      <section className="launch-panel">
        <div className="launch-panel-head">
          <div>
            <h2>Live configs</h2>
            <p>
              Program <code>{data?.program ?? "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN"}</code>
              {data?.dammV2Config ? (
                <>
                  {" "}
                  · DAMM v2 {data.dammV2FeeBps} bps <code>{data.dammV2Config}</code>
                </>
              ) : null}
            </p>
          </div>
          <Link className="button button--gradient" href="/launch">
            Launch on a preset ↗
          </Link>
        </div>

        {presets.length === 0 && !error ? (
          <p className="launch-badge-note">Reading PoolConfig accounts from Solana…</p>
        ) : (
          <div className="dbc-preset-table-wrap">
            <table className="dbc-preset-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Curve</th>
                  <th>Fee</th>
                  <th>Graduates after</th>
                  <th>USD at live price</th>
                  <th>Migrates to</th>
                  <th>PoolConfig</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((preset) => (
                  <tr key={preset.configAddress}>
                    <td>
                      <div className="dbc-preset-stock">
                        <StockLogo symbol={preset.symbol} size={24} />
                        <span>
                          <strong>{preset.symbol}</strong>
                          <span className="dbc-preset-muted">{preset.stockName}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{preset.name}</strong>
                      <span className="dbc-preset-muted">{preset.blurb}</span>
                    </td>
                    <td>
                      {(preset.baseFeeBps / 100).toFixed(2)}%
                      <span className="dbc-preset-muted">{preset.creatorTradingFeePercent}% to creator</span>
                    </td>
                    <td>
                      {preset.migrationThresholdUi.toFixed(4)} {preset.symbol}
                    </td>
                    <td>{usd(preset.graduationUsd)}</td>
                    <td>{preset.migrationTarget}</td>
                    <td>
                      <a href={preset.configUrl} target="_blank" rel="noreferrer">
                        {preset.configAddress.slice(0, 4)}…{preset.configAddress.slice(-4)}
                      </a>
                      <button type="button" className="dbc-copy-btn" onClick={() => copy(preset.configAddress, preset.configAddress)}>
                        {copied === preset.configAddress ? "Copied" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="launch-panel">
        <div className="launch-panel-head">
          <div>
            <h2>Builder plug-in</h2>
            <p>JSON the launch studio already uses. Poll these routes instead of scraping the UI.</p>
          </div>
          <a className="workspace-pill-link" href="/api/launch/dbc-presets">
            GET /api/launch/dbc-presets
          </a>
        </div>
        <ul className="dbc-builder-list">
          <li>
            <code>GET /api/launch/dbc-presets</code> — on-chain PoolConfigs, live USD graduation, DAMM v2 config
          </li>
          <li>
            <code>GET /api/launch/venues?symbol=NVDAx</code> — badge + curve terms for one stock
          </li>
          <li>
            <code>GET /api/launch/dbc-pools</code> — OpenStock DBC pools and on-chain curve progress
          </li>
          <li>
            <code>POST /api/launch/meteora</code> — prepare / confirm a stock-quoted DBC pool
          </li>
          <li>
            <code>POST /api/migration/meteora</code> — DBC → DAMM v2 when the curve is full
          </li>
        </ul>
        {data?.notes?.length ? (
          <p className="launch-badge-note">{data.notes.join(" ")}</p>
        ) : null}
      </section>
    </div>
  );
}
