import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { AssetPriceChart } from "@/components/asset-price-chart";
import { MarketNewsFeed } from "@/components/market-news-feed";
import { MarketVerdictCard } from "@/components/market-verdict";
import { PaperOrderForm } from "@/components/paper-order-form";
import { AssetStockPairs } from "@/components/asset-stock-pairs";
import { ProStockHeader } from "@/components/pro-stock-header";
import { getMarketEvidence, reserveCoverage } from "@/lib/market-evidence";
import { getMarketVerdict } from "@/lib/market-verdict";
import { getAssetMarketStats } from "@/lib/market-stats";
import { liveTradingEnabled } from "@/lib/trading";
import { displayPrice, getHydratedAsset, XStocksApiError } from "@/lib/xstocks";

function multiplier(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value.toFixed(4) + "×" : "—";
}

function number(value: number | null | undefined, digits = 2) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  let asset;
  try {
    asset = await getHydratedAsset(symbol);
  } catch {
    asset = null;
  }
  const titleSymbol = asset?.symbol ?? symbol.toUpperCase();
  const name = asset?.name ?? titleSymbol;
  const priceLabel = asset?.price != null ? displayPrice(asset.price) : null;
  const description = `Trade ${name} 24/7 on Solana. Live issuer, Jupiter, Pyth, and Meteora evidence on OpenStock.`;
  const ogPath = `/api/og/asset?symbol=${encodeURIComponent(titleSymbol)}&name=${encodeURIComponent(name)}${priceLabel ? `&price=${encodeURIComponent(priceLabel)}` : ""}&session=${encodeURIComponent("24/7 DEX")}`;

  return {
    title: `${titleSymbol} — OpenStock desk`,
    description,
    openGraph: {
      title: `${titleSymbol} on OpenStock`,
      description,
      url: `https://joinopenstock.xyz/app/asset/${encodeURIComponent(titleSymbol)}`,
      images: [{ url: ogPath, width: 1200, height: 630, alt: `${titleSymbol} desk` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${titleSymbol} on OpenStock`,
      description,
      images: [ogPath],
    },
  };
}

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let asset;
  try {
    asset = await getHydratedAsset(symbol);
  } catch (error) {
    if (error instanceof XStocksApiError && error.status === 404) notFound();
  }
  if (!asset) notFound();

  const evidence = await getMarketEvidence(asset);
  const halted = Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted);
  const officialReady = asset.price !== null && asset.price !== undefined;
  const pool = evidence.meteora.data?.find((item) => typeof item.priceUsd === "number" && item.priceUsd > 0) ?? evidence.meteora.data?.[0] ?? null;
  const executablePrice = evidence.jupiter.data?.executablePrice ?? null;
  const onchainPrice = executablePrice ?? pool?.priceUsd ?? null;
  const priceForTrade = typeof onchainPrice === "number" ? onchainPrice : null;
  const priceIsIndicative = !officialReady && priceForTrade !== null;
  const multiplierReady = Number.isFinite(asset.multiplier?.currentMultiplier);
  const decimals = evidence.tokenDecimals.data;
  const coverage = reserveCoverage(evidence.reserves.data);
  const nextMultiplier = asset.multiplier?.newMultiplier && asset.multiplier.newMultiplier !== asset.multiplier.currentMultiplier ? asset.multiplier.newMultiplier : null;
  const venueStatus = halted ? "HALT" : priceForTrade !== null ? "ROUTE" : "24/7 DEX";
  const sessionStatus = halted ? "HALT" : asset.trading?.openNow ? "OPEN" : "24/7 DEX";
  const verdict = getMarketVerdict(asset, evidence);
  const reviewReady =
    priceForTrade !== null &&
    multiplierReady &&
    decimals !== null &&
    !halted &&
    !verdict.hardBlock;
  const liveTrading = liveTradingEnabled();
  const facts = [
    { label: "Market Price", value: officialReady ? displayPrice(asset.price) : "Unavailable" },
    { label: "Trading Price", value: onchainPrice !== null ? "$" + number(onchainPrice) : "Unavailable" },
    { label: "Price Source", value: evidence.pyth.data ? "$" + number(evidence.pyth.data.price) : "Unavailable" },
    { label: "Available", value: pool && pool.tvl !== null ? "$" + number(pool.tvl, 0) : "Unavailable" },
    { label: "Trading Fee", value: pool && pool.feePct !== null && pool.feePct !== undefined ? number(pool.feePct, 2) + "%" : "Unavailable" },
    { label: "Backed", value: coverage !== null ? number(coverage * 100) + "%" : "Unavailable" },
    { label: "Shares", value: multiplier(asset.multiplier?.currentMultiplier) },
  ];

      const stats = getAssetMarketStats(asset.symbol, priceForTrade ?? asset.price);
      return <main className="page">
        <AppNav ctaHref="/app" ctaLabel="Market" />
        <div className="app-page container asset-workspace">
          <Link href="/app" className="back-link">← Back to market</Link>
          <ProStockHeader
            symbol={asset.symbol}
            name={asset.name}
            logo={asset.logo}
            underlyingSymbol={asset.underlying?.symbol}
            price={priceForTrade ?? asset.price}
            officialReady={officialReady}
            priceFormatted={officialReady ? displayPrice(asset.price) : priceForTrade !== null ? "$" + number(priceForTrade) : "Live"}
            change24h={stats.change24h}
            liquidityUsd={pool && pool.tvl !== null ? "$" + number(pool.tvl, 0) : "Unavailable"}
            volume24h={pool && pool.volume24h !== null ? "$" + number(pool.volume24h, 0) : "Unavailable"}
            oraclePrice={evidence.pyth.data ? "$" + number(evidence.pyth.data.price) : undefined}
            reserveCoverage={coverage !== null ? number(coverage * 100) + "% backed" : "Reserve unavailable"}
            mintAddress={asset.solanaDeployment?.address ?? "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"}
            decimals={decimals ?? asset.solanaDeployment?.decimals ?? 6}
            venueStatus={venueStatus}
            sessionStatus={sessionStatus}
          />
      <MarketVerdictCard verdict={verdict} />
      <nav className="asset-detail-tabs" aria-label="Stock sections">
        <a href="#overview">Overview</a>
        <a href="#chart">Chart</a>
        <a href="#news">News</a>
        <a href="#events">Issuer events</a>
        <a href="#trade">Trade</a>
        <a href="#pairs">Pairs</a>
        <Link href={`/launch?symbol=${encodeURIComponent(asset.symbol)}&quick=1`} style={{ color: "var(--accent, #9945ff)", fontWeight: 700 }}>
          Launch against {asset.symbol}
        </Link>
      </nav>
      <div className="asset-trade-grid"><div className="asset-analysis-stack"><AssetPriceChart symbol={asset.symbol} name={asset.name.replace(/ xStock$/, "")} referencePrice={asset.price} /><div id="news"><MarketNewsFeed compact symbol={asset.symbol} symbols={[{ symbol: asset.symbol, name: asset.name.replace(/ xStock$/, "") }]} /></div></div><section className="asset-order-card" id="trade"><PaperOrderForm symbol={asset.symbol} name={asset.name} price={priceForTrade} solPriceUsd={evidence.solPriceUsd} priceIsIndicative={priceIsIndicative} multiplier={asset.multiplier?.currentMultiplier ?? null} decimals={decimals} halted={halted} ready={reviewReady} liveTrading={liveTrading} hardBlock={verdict.hardBlock} hardBlockReason={verdict.hardBlock ? verdict.headline : null} pythPrice={evidence.pyth.data?.price ?? null} poolPrice={pool?.priceUsd ?? null} mintAddress={asset.solanaDeployment?.address ?? "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"} underlyingSymbol={asset.underlying?.symbol ?? asset.symbol.replace(/x$/, "")} /></section></div>
      <section className="asset-overview" id="overview"><div className="asset-fact-grid">{facts.map((fact) => <article className="asset-fact" key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></article>)}</div></section>
      <AssetStockPairs symbol={asset.symbol} />
      {nextMultiplier ? <section className="asset-event-card" id="events"><div><h2>Share Update</h2><p>{multiplier(asset.multiplier?.currentMultiplier)} → {multiplier(nextMultiplier)}</p></div><Link className="button button--dark" href="/app/actions">View events</Link></section> : null}
    </div>
    <AppFooterNav />
  </main>;
}
