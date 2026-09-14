import Link from "next/link";
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
<AppNav ctaHref="/" ctaLabel="Back home" />
    <div className="app-page container">
      <header className="app-market-header market-browse-header"><div><div className="eyebrow">Tokenized stocks · Solana</div><h1>Browse stocks.</h1><Link className="market-news-link" href="/app/news">Market news ↗</Link></div><p>Choose a stock to see the price, liquidity, and issuer context before you trade.</p></header>
      {error ? <section className="data-state data-state--error" role="alert"><strong>Market data is still loading.</strong><span>Refresh in a moment to see the latest issuers.</span></section> : <MarketDiscovery assets={assets} />}
    </div><AppFooterNav />
  </main>;
}
