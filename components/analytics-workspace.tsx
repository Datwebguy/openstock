"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AssetPriceChart } from "@/components/asset-price-chart";
import { ProStockHeader } from "@/components/pro-stock-header";
import { StockLogo } from "@/components/stock-logo";
import curated25Data from "@/lib/solana-curated-25.json";

const curated25: Record<string, { symbol: string; name: string; mint: string; decimals: number; logo: string }> = curated25Data;

type SymbolOption = { symbol: string; name: string };

type StatsRow = { price: number; change24h: number | null; volume24h: string; liquidity: string };

type Evidence = {
  symbol: string;
  name: string;
  mint: string | null;
  decimals: number | null;
  issuerPrice: number | null;
  multiplier: number | null;
  oracle: { source: "pyth" | "jupiter"; price: number; confidence: number | null; freshnessSeconds: number | null; deviationPct: number | null } | null;
  executablePrice: number | null;
  priceImpactPct: number | null;
  pools: Array<{ address: string; name: string; tvl: number | null; priceUsd: number | null; volume24h: number | null; feePct: number | null }>;
  reserves: { sharesHeld: number | null; circulatingSupply: number | null; coverage: number | null; asOf: string | null };
};

function usd(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? "$" + value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";
}

function pct(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%` : "—";
}

export function AnalyticsWorkspace({ symbols }: { symbols: SymbolOption[] }) {
  const searchParams = useSearchParams();
  const paramSymbol = searchParams?.get("symbol");
  const initialSymbol = paramSymbol && curated25[paramSymbol] ? paramSymbol : "NVDAx";

  const [selected, setSelected] = useState<string>(initialSymbol);
  const [activeTab, setActiveTab] = useState<"pools" | "oracles" | "reserves" | "launch">("pools");
  const [stats, setStats] = useState<Record<string, StatsRow>>({});
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    if (paramSymbol && curated25[paramSymbol] && paramSymbol !== selected) setSelected(paramSymbol);
  }, [paramSymbol, selected]);

  function handleSelectSymbol(sym: string) {
    setSelected(sym);
    const url = new URL(window.location.href);
    url.searchParams.set("symbol", sym);
    window.history.replaceState(null, "", url.toString());
  }

  // Ribbon prices: Jupiter/DexScreener stats for every curated stock (refreshed every 30s).
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/market/stats", { cache: "no-store" });
        const body = (await res.json()) as { stats?: Record<string, StatsRow> };
        if (active && body.stats) setStats(body.stats);
      } catch {
        /* keep the last good values */
      }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setEvidence(null);
    setEvidenceError(null);
    fetch(`/api/evidence/${encodeURIComponent(selected)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Evidence is unavailable right now.");
        if (active) setEvidence(body as Evidence);
      })
      .catch((err: unknown) => active && setEvidenceError(err instanceof Error ? err.message : "Evidence is unavailable right now."));
    return () => {
      active = false;
    };
  }, [selected]);

  const meta = curated25[selected];
  const row = stats[selected];
  const dexPrice = row && row.price > 0 ? row.price : evidence?.executablePrice ?? null;
  const headlinePrice = dexPrice ?? evidence?.issuerPrice ?? null;
  const topPool = evidence?.pools[0] ?? null;
  const oracleGap =
    evidence?.oracle && dexPrice ? ((dexPrice - evidence.oracle.price) / evidence.oracle.price) * 100 : null;

  return (
    <section className="analytics-suite" aria-label="Pool and price analytics">
      <div className="analytics-asset-ribbon" role="group" aria-label="Select stock">
        {symbols.slice(0, 10).map((item) => {
          const price = stats[item.symbol]?.price;
          return (
            <button
              type="button"
              key={item.symbol}
              className={`analytics-ribbon-pill ${selected === item.symbol ? "is-active" : ""}`}
              onClick={() => handleSelectSymbol(item.symbol)}
            >
              <StockLogo symbol={item.symbol} logo={curated25[item.symbol]?.logo} size={22} />
              <span className="analytics-ribbon-symbol">{item.symbol}</span>
              <span className="analytics-ribbon-price">{usd(price)}</span>
            </button>
          );
        })}
      </div>

      {meta ? (
        <ProStockHeader
          symbol={meta.symbol}
          name={meta.name}
          logo={meta.logo}
          underlyingSymbol={meta.symbol.replace(/x$/, "")}
          price={headlinePrice ?? 0}
          officialReady={evidence?.issuerPrice != null}
          priceFormatted={usd(headlinePrice)}
          change24h={row?.change24h}
          liquidityUsd={row?.liquidity}
          volume24h={row?.volume24h}
          oraclePrice={evidence?.oracle ? usd(evidence.oracle.price) : undefined}
          oracleLabel={evidence?.oracle?.source === "pyth" ? "PYTH ORACLE" : evidence?.oracle ? "JUPITER PRICE" : "ORACLE"}
          reserveCoverage={evidence?.reserves.coverage != null ? `${(evidence.reserves.coverage * 100).toFixed(2)}% backed` : "Reserve unavailable"}
          mintAddress={meta.mint}
          decimals={evidence?.decimals ?? meta.decimals}
          venueStatus={dexPrice !== null ? "ROUTE" : "24/7 DEX"}
          sessionStatus="24/7 DEX"
        />
      ) : null}

      <div className="analytics-chart-container">
        <AssetPriceChart symbol={selected} name={meta?.name.replace(/ xStock$/, "") ?? selected} referencePrice={headlinePrice} />
      </div>

      <div className="analytics-module-card">
        <div className="analytics-module-tabs" role="tablist">
          {([
            ["pools", "Meteora pools"],
            ["oracles", "Price sources"],
            ["reserves", "Issuer reserves"],
            ["launch", "Launch a pair"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`analytics-module-tab ${activeTab === id ? "is-active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {evidenceError ? <p className="workspace-note" role="alert">{evidenceError}</p> : null}
        {!evidence && !evidenceError ? <p className="workspace-note">Loading on-chain evidence…</p> : null}

        {evidence && activeTab === "pools" && (
          <div className="analytics-tab-content">
            <div className="analytics-dlmm-header">
              <div>
                <h4>Meteora pools for {selected}</h4>
                <p>From Meteora&apos;s pool API. Bin-level depth is not published there, so pools are listed with TVL and volume.</p>
              </div>
              <div className="analytics-dlmm-stats">
                <div className="analytics-stat-pill">
                  <span>Top pool TVL</span>
                  <strong>{usd(topPool?.tvl, 0)}</strong>
                </div>
                <div className="analytics-stat-pill">
                  <span>Top pool fee</span>
                  <strong>{topPool?.feePct ? `${topPool.feePct.toFixed(2)}%` : "—"}</strong>
                </div>
                <div className="analytics-stat-pill">
                  <span>Pools</span>
                  <strong>{evidence.pools.length}</strong>
                </div>
              </div>
            </div>
            {evidence.pools.length === 0 ? (
              <p className="workspace-note">No Meteora pools reported for {selected}.</p>
            ) : (
              <div className="analytics-audit-grid">
                {evidence.pools.map((pool) => (
                  <div className="analytics-audit-item" key={pool.address}>
                    <span>
                      <a href={`https://solscan.io/account/${pool.address}`} target="_blank" rel="noreferrer">{pool.name} ↗</a>
                    </span>
                    <strong>
                      TVL {usd(pool.tvl, 0)} · 24h {usd(pool.volume24h, 0)} · {usd(pool.priceUsd)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {evidence && activeTab === "oracles" && (
          <div className="analytics-tab-content">
            <div className="analytics-oracle-grid">
              <article className="analytics-oracle-card">
                <div className="analytics-oracle-card__head">
                  <span className="analytics-oracle-badge os-badge-purple">Issuer reference</span>
                </div>
                <h3>{usd(evidence.issuerPrice)}</h3>
                <p>Backed/xStocks price for the underlying share.</p>
              </article>
              <article className="analytics-oracle-card">
                <div className="analytics-oracle-card__head">
                  <span className="analytics-oracle-badge os-badge-green">
                    {evidence.oracle?.source === "pyth" ? "Pyth feed" : "Jupiter price (no Pyth feed)"}
                  </span>
                </div>
                <h3>{usd(evidence.oracle?.price)}</h3>
                <div className="analytics-oracle-meta">
                  <span>Confidence</span>
                  <strong>{evidence.oracle?.confidence != null ? `±${usd(evidence.oracle.confidence)}` : "—"}</strong>
                </div>
                <div className="analytics-oracle-meta">
                  <span>Age</span>
                  <strong>{evidence.oracle?.freshnessSeconds != null ? `${Math.round(evidence.oracle.freshnessSeconds)}s` : "—"}</strong>
                </div>
              </article>
              <article className="analytics-oracle-card">
                <div className="analytics-oracle-card__head">
                  <span className="analytics-oracle-badge os-badge-blue">Solana DEX vs oracle</span>
                </div>
                <h3>{pct(oracleGap, 3)}</h3>
                <div className="analytics-oracle-meta">
                  <span>DEX price (Jupiter)</span>
                  <strong>{usd(dexPrice)}</strong>
                </div>
                <div className="analytics-oracle-meta">
                  <span>Quote price impact</span>
                  <strong>{evidence.priceImpactPct != null ? `${evidence.priceImpactPct.toFixed(3)}%` : "—"}</strong>
                </div>
              </article>
            </div>
          </div>
        )}

        {evidence && activeTab === "reserves" && (
          <div className="analytics-tab-content">
            <div className="analytics-audit-grid">
              <div className="analytics-audit-item">
                <span>Issuer</span>
                <strong>Backed (xStocks)</strong>
              </div>
              <div className="analytics-audit-item">
                <span>Reserve coverage</span>
                <strong>{evidence.reserves.coverage != null ? `${(evidence.reserves.coverage * 100).toFixed(2)}%` : "Unavailable"}</strong>
              </div>
              <div className="analytics-audit-item">
                <span>Shares held / circulating</span>
                <strong>
                  {evidence.reserves.sharesHeld?.toLocaleString() ?? "—"} / {evidence.reserves.circulatingSupply?.toLocaleString() ?? "—"}
                </strong>
              </div>
              <div className="analytics-audit-item">
                <span>Reported</span>
                <strong>{evidence.reserves.asOf ? new Date(evidence.reserves.asOf).toUTCString() : "—"}</strong>
              </div>
              <div className="analytics-audit-item">
                <span>Mint</span>
                <div className="analytics-mint-row">
                  <code>{evidence.mint ?? "—"}</code>
                  {evidence.mint ? (
                    <a href={`https://solscan.io/token/${evidence.mint}`} target="_blank" rel="noreferrer" className="analytics-solscan-link">
                      Solscan ↗
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="analytics-audit-item">
                <span>Decimals · share multiplier</span>
                <strong>
                  {evidence.decimals ?? "—"} · {evidence.multiplier != null ? `${evidence.multiplier.toFixed(4)}×` : "—"}
                </strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === "launch" && (
          <div className="analytics-tab-content">
            <div className="analytics-clawpump-box">
              <div className="analytics-clawpump-info">
                <h4>Launch a token quoted in {selected}</h4>
                <p>Pump.fun (via ClawPump) or Meteora DBC where configured. The pool&apos;s quote asset is the stock, not SOL or USDC.</p>
                <div className="analytics-pair-pill">
                  <span>YOUR_TOKEN</span>
                  <strong>×</strong>
                  <span>{selected}</span>
                </div>
              </div>
              <div className="analytics-clawpump-cta">
                <Link href={`/launch?symbol=${encodeURIComponent(selected)}`} className="button button--gradient" style={{ padding: "12px 24px", fontSize: 13, fontWeight: 800 }}>
                  Open launch studio
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
