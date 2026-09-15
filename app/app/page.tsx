import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketDiscovery } from "@/components/market-discovery";
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
<AppNav hideCta />
    <div className="app-page container">
      <header className="workspace-heading"><div><span className="workspace-kicker">Your market workspace</span><h1>Find your next perspective.</h1><p>Explore xStocks, save a watchlist, and inspect the context behind each price.</p></div><a className="workspace-help" href="/app/learn/multipliers">New to xStocks? Start here ↗</a></header>
      <section id="stock-market" className="market-browse-anchor" aria-label="Available tokenized stocks">
        {error ? <div className="data-state data-state--error" role="alert"><strong>Market data is temporarily unavailable.</strong><span>We could not load the issuer feed. Try again in a moment.</span><a className="button button--light" href="/app">Try again</a></div> : <MarketDiscovery assets={assets} />}
      </section>
    </div><AppFooterNav />
  </main>;
}
