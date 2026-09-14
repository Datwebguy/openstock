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
      <section id="stock-market" className="market-browse-anchor" aria-label="Available tokenized stocks">
        {error ? <div className="data-state data-state--error" role="alert"><strong>Market unavailable.</strong><span>Refresh.</span></div> : <MarketDiscovery assets={assets} />}
      </section>
    </div><AppFooterNav />
  </main>;
}
