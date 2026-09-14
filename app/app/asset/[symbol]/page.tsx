import Link from "next/link";
import { notFound } from "next/navigation";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { AssetPriceChart } from "@/components/asset-price-chart";
import { MarketVerdictCard } from "@/components/market-verdict";
import { MarketNewsFeed } from "@/components/market-news-feed";
import { PaperOrderForm } from "@/components/paper-order-form";
import { StockLogo } from "@/components/stock-logo";
import { getMarketEvidence, reserveCoverage } from "@/lib/market-evidence";
import { getMarketVerdict } from "@/lib/market-verdict";
import { displayPrice, getHydratedAsset, XStocksApiError } from "@/lib/xstocks";

function multiplier(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value.toFixed(4) + "×" : "Not reported";
}

function number(value: number | null | undefined, digits = 2) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "Not reported";
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
  const marketClosed = asset.trading?.currentPeriod === "closed" || asset.trading?.openNow === false;
  const pool = evidence.meteora.data?.find((item) => typeof item.priceUsd === "number" && item.priceUsd > 0) ?? evidence.meteora.data?.[0] ?? null;
  const executablePrice = evidence.jupiter.data?.executablePrice ?? null;
  const onchainPrice = executablePrice ?? pool?.priceUsd ?? null;
  const priceForTrade = typeof onchainPrice === "number" ? onchainPrice : null;
  const priceIsIndicative = !officialReady && priceForTrade !== null;
  const multiplierReady = Number.isFinite(asset.multiplier?.currentMultiplier);
  const decimals = evidence.tokenDecimals.data;
  const reviewReady = priceForTrade !== null && multiplierReady && decimals !== null && !halted;
  const coverage = reserveCoverage(evidence.reserves.data);
  const verdict = getMarketVerdict(asset, evidence);
  const nextMultiplier = asset.multiplier?.newMultiplier && asset.multiplier.newMultiplier !== asset.multiplier.currentMultiplier ? asset.multiplier.newMultiplier : null;
  const venueStatus = halted ? "Trading paused" : priceForTrade !== null ? "Solana route available" : "Route refreshing";
  const issuerStatus = officialReady ? "Reference live" : marketClosed ? "Reference paused" : "Reference refreshing";
  const facts = [
    { label: "Issuer reference", value: officialReady ? displayPrice(asset.price) : issuerStatus, detail: "xStocks public feed" },
    { label: "Live Solana quote", value: onchainPrice !== null ? "$" + number(onchainPrice) : "Refreshing", detail: executablePrice ? "Jupiter executable quote" : "Pool quote" },
    { label: "Oracle check", value: evidence.pyth.data ? "$" + number(evidence.pyth.data.price) : "Refreshing", detail: evidence.pyth.data ? number(evidence.pyth.data.deviationPct) + "% from route" : "Independent source" },
    { label: "Liquidity", value: pool ? "$" + number(pool.tvl, 0) : "Refreshing", detail: pool ? number(pool.volume24h, 0) + " traded today" : "Pool depth" },
    { label: "Reserve coverage", value: coverage ? number(coverage * 100) + "% covered" : "Not reported", detail: "Issuer reserve report" },
    { label: "Share adjustment", value: multiplier(asset.multiplier?.currentMultiplier), detail: nextMultiplier ? "Change scheduled" : "Current issuer setting" },
  ];

  return <main className="page">
    <AppNav ctaLabel="Choose stock" />
    <div className="app-page container asset-workspace">
      <Link href="/app" className="back-link">← Back to market</Link>
      <header className="asset-detail-header">
        <div className="asset-detail-main">
          <div className="asset-detail-identity"><StockLogo symbol={asset.symbol} logo={asset.logo} size={62} /><div className="asset-detail-title"><div className="eyebrow">Tokenized stock · Solana</div><h1>{asset.name.replace(/ xStock$/, "")}</h1><p>{asset.symbol} · {asset.underlying?.symbol ?? asset.symbol.replace(/x$/, "")}</p></div></div>
          <div className="asset-detail-price"><strong>{officialReady ? displayPrice(asset.price) : priceForTrade !== null ? "$" + number(priceForTrade) : "Refreshing"}</strong><small>{officialReady ? "Official xStocks reference" : priceIsIndicative ? "Live Solana price · indicative" : issuerStatus}</small></div>
        </div>
        <div className="asset-status-row"><span className={halted ? "status-chip status-chip--warn" : "status-chip status-chip--good"}>{venueStatus}</span><span>{issuerStatus}</span><span>{asset.trading?.openNow ? "Underlying market open" : marketClosed ? "Underlying market closed" : "Session updating"}</span></div>
      </header>
      <nav className="asset-detail-tabs" aria-label="Stock sections"><a href="#overview">Overview</a><a href="#chart">Chart</a><a href="#news">News</a><a href="#events">Issuer events</a><a href="#trade">Trade</a></nav>
      <div className="asset-trade-grid"><div className="asset-analysis-stack"><AssetPriceChart symbol={asset.symbol} name={asset.name.replace(/ xStock$/, "")} referencePrice={asset.price} /><div id="news"><MarketNewsFeed compact symbol={asset.symbol} symbols={[{ symbol: asset.symbol, name: asset.name.replace(/ xStock$/, "") }]} /></div></div><section className="asset-order-card" id="trade"><PaperOrderForm symbol={asset.symbol} name={asset.name} price={priceForTrade} solPriceUsd={evidence.solPriceUsd} priceIsIndicative={priceIsIndicative} multiplier={asset.multiplier?.currentMultiplier ?? null} decimals={decimals} halted={halted} ready={reviewReady} /></section></div>
      <section className="asset-overview" id="overview"><div className="asset-section-head"><div><div className="eyebrow">Market context</div><h2>Read the price in context.</h2></div><p>Reference, route, liquidity, reserves, and share adjustment stay together before you trade.</p></div><div className="asset-fact-grid">{facts.map((fact) => <article className="asset-fact" key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong><small>{fact.detail}</small></article>)}</div><MarketVerdictCard verdict={verdict} /></section>
      <section className="asset-event-card" id="events"><div><div className="eyebrow">Issuer events</div><h2>{nextMultiplier ? "A share adjustment is scheduled." : "Keep issuer changes in view."}</h2><p>{nextMultiplier ? `The displayed adjustment can move from ${multiplier(asset.multiplier?.currentMultiplier)} to ${multiplier(nextMultiplier)}. Review the event before creating an order.` : "Dividends, splits, and other issuer actions can affect how a tokenized share is displayed."}</p></div><Link className="button button--dark" href="/app/actions">View issuer events</Link></section>
    </div>
    <AppFooterNav />
  </main>;
}
