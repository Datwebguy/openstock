import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketDiscovery } from "@/components/market-discovery";
import { CURATED_SYMBOLS, getAsset, hydrateAsset, listSolanaAssets, type OpenStockAsset } from "@/lib/xstocks";

import curated25Data from "@/lib/solana-curated-25.json";

const curated25: Record<string, { symbol: string; name: string; mint: string; decimals: number; logo: string }> = curated25Data;

async function getDiscoverAssets(): Promise<{ assets: OpenStockAsset[]; error: boolean }> {
  try {
    let registered: OpenStockAsset[] = [];
    try {
      const solanaAssets = await listSolanaAssets();
      registered = await Promise.all(solanaAssets.map(hydrateAsset));
    } catch {
      registered = [];
    }

    const bySymbol = new Map(registered.map((asset) => [asset.symbol, asset]));

    const assets: OpenStockAsset[] = CURATED_SYMBOLS.map((symbol) => {
      const live = bySymbol.get(symbol);
      if (live) return live;

      const fallbackMeta = curated25[symbol] ?? {
        symbol,
        name: symbol.replace(/x$/, " xStock"),
        mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
        decimals: 6,
        logo: `https://xstocks-metadata.backed.fi/logos/tokens/${symbol}.png`,
      };

      return {
        id: symbol,
        name: fallbackMeta.name,
        symbol: symbol,
        logo: fallbackMeta.logo,
        underlying: { symbol: symbol.replace(/x$/, "").toUpperCase(), type: "Equity" },
        deployments: [
          {
            network: "Solana",
            address: fallbackMeta.mint,
            decimals: fallbackMeta.decimals,
            solanaTokenProgram: "Token2022Program",
          },
        ],
        trading: { openNow: true, currentPeriod: "market" },
        price: null,
        multiplier: null,
        solanaDeployment: {
          network: "Solana",
          address: fallbackMeta.mint,
          decimals: fallbackMeta.decimals,
          solanaTokenProgram: "Token2022Program",
        },
      };
    });

    return { assets, error: false };
  } catch (err) {
    console.error("Failed to load discover assets:", err);
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
