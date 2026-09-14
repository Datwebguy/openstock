import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketDiscovery } from "@/components/market-discovery";
import { StockLogo } from "@/components/stock-logo";
import { CURATED_SYMBOLS, getAsset, hydrateAsset, listSolanaAssets, type OpenStockAsset } from "@/lib/xstocks";

async function getDiscoverAssets(): Promise<{ assets: OpenStockAsset[]; error: boolean }> {
  try {
    const registered = await listSolanaAssets();
    const bySymbol = new Map(registered.map((asset) => [asset.symbol, asset]));
    const selected = CURATED_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    const sourceAssets = selected.length > 0 ? selected : (await Promise.allSettled(CURATED_SYMBOLS.map(getAsset))).flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const assets = await Promise.all(sourceAssets.map(hydrateAsset));
    return { assets, error: assets.length === 0 };
  } catch {
    return { assets: [], error: true };
  }
}
export default async function AppPage() {
  const { assets, error } = await getDiscoverAssets();
  return <main className="page">
<AppNav ctaHref="/" ctaLabel="Back home" />
    <div className="app-page container">
      <section className="market-entry" aria-labelledby="market-entry-heading">
        <div className="market-entry__copy">
          <p className="market-entry__kicker">OpenStock market</p>
          <h1 id="market-entry-heading">Start with the market.</h1>
          <p>See the listed tokenized stocks, then open the one you want to understand before you trade.</p>
          <div className="market-entry__actions"><a className="button button--dark" href="#stock-market">Browse stocks <span aria-hidden="true">↓</span></a><span>10 listed stocks</span></div>
        </div>
        <div className="market-entry__field" aria-label="Apple, Tesla, and Amazon xStocks">
          <div className="market-entry__axis market-entry__axis--one" aria-hidden="true" />
          <div className="market-entry__axis market-entry__axis--two" aria-hidden="true" />
          <div className="market-entry__node market-entry__node--apple"><StockLogo symbol="AAPLx" size={56} /></div>
          <div className="market-entry__node market-entry__node--tesla"><StockLogo symbol="TSLAx" size={84} /></div>
          <div className="market-entry__node market-entry__node--amazon"><StockLogo symbol="AMZNx" size={56} /></div>
          <p className="market-entry__field-note">Three issuers. One market view.</p>
        </div>
      </section>
      <header id="stock-market" className="app-market-header market-browse-header"><div><div className="eyebrow">Tokenized stocks · Solana</div><h1>Browse stocks.</h1><Link className="market-news-link" href="/app/news">Market news ↗</Link></div><p>Choose a stock to see the price, liquidity, and issuer context before you trade.</p></header>
      {error ? <section className="data-state data-state--error" role="alert"><strong>Market data is still loading.</strong><span>Refresh in a moment to see the latest issuers.</span></section> : <MarketDiscovery assets={assets} />}
    </div><AppFooterNav />
  </main>;
}
