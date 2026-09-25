import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketDiscovery } from "@/components/market-discovery";
import { CURATED_SYMBOLS, getMultiplier, getPrice, type OpenStockAsset } from "@/lib/xstocks";
import { getAllAssetMarketStats, type AssetMarketStats } from "@/lib/market-stats";
import curated25Data from "@/lib/solana-curated-25.json";

const curated25: Record<string, { symbol: string; name: string; mint: string; decimals: number; logo: string }> = curated25Data;

async function getDiscoverAssets(): Promise<{ assets: OpenStockAsset[]; stats: Record<string, AssetMarketStats>; error: boolean }> {
  try {
    const [statsResult, assetsResult] = await Promise.allSettled([
      getAllAssetMarketStats(),
      Promise.all(
        CURATED_SYMBOLS.filter((symbol) => curated25[symbol]).map(async (symbol) => {
          const meta = curated25[symbol];

          const [priceResult, multResult] = await Promise.allSettled([
            getPrice(symbol),
            getMultiplier(symbol),
          ]);

          // Missing data stays null — the desk shows "Unavailable" rather than a made-up price or multiplier.
          const price =
            priceResult.status === "fulfilled" && typeof priceResult.value?.quote === "number" && priceResult.value.quote > 0
              ? priceResult.value.quote
              : null;

          const multiplier = multResult.status === "fulfilled" && multResult.value ? multResult.value : null;

          return {
            id: symbol,
            name: meta.name,
            symbol,
            logo: meta.logo,
            underlying: { symbol: symbol.replace(/x$/, "").toUpperCase(), type: "Equity" as const },
            deployments: [
              {
                network: "Solana",
                address: meta.mint,
                decimals: meta.decimals,
                solanaTokenProgram: "Token2022Program" as const,
              },
            ],
            price,
            multiplier,
            solanaDeployment: {
              network: "Solana",
              address: meta.mint,
              decimals: meta.decimals,
              solanaTokenProgram: "Token2022Program" as const,
            },
          };
        })
      ),
    ]);

    const stats = statsResult.status === "fulfilled" ? statsResult.value : {};
    let assets = assetsResult.status === "fulfilled" ? assetsResult.value : [];

    // Enhance assets with live on-chain prices if available from Jupiter
    if (Object.keys(stats).length > 0) {
      assets = assets.map((a) => {
        const livePrice = stats[a.symbol]?.price;
        return livePrice && livePrice > 0 ? { ...a, price: livePrice } : a;
      });
    }

    return { assets, stats, error: false };
  } catch (err) {
    console.error("Failed to load discover assets:", err);
    return { assets: [], stats: {}, error: true };
  }
}

export default async function AppPage() {
  const { assets, stats, error } = await getDiscoverAssets();
  return (
    <main className="page">
      <AppNav hideCta />
      <div className="app-page container">
        <header className="workspace-heading">
          <div className="workspace-heading__body">
            <div className="workspace-kicker">
              <span className="live-dot" aria-hidden="true" />
              <span>Solana Mainnet · {CURATED_SYMBOLS.length} Tokenized Equities</span>
            </div>
            <h1>Tokenized Equities Desk</h1>
            <p>24/7 tokenized stocks on Solana.</p>
          </div>
          <div className="workspace-heading__actions">
            <Link className="workspace-pill-link" href="/app/community">
              Memes &amp; Pairs ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/launch">
              Pair &amp; Launch Token ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/app/analytics">
              Pool Analytics ↗
            </Link>
          </div>
        </header>
        <section id="stock-market" className="market-browse-anchor" aria-label="Available tokenized stocks">
          {error ? (
            <div className="data-state data-state--error" role="alert">
              <strong>Market data is temporarily unavailable.</strong>
              <span>We could not load the issuer feed. Try again in a moment.</span>
              <a className="button button--light" href="/app">
                Try again
              </a>
            </div>
          ) : (
            <MarketDiscovery assets={assets} initialStats={stats} />
          )}
        </section>
      </div>
      <AppFooterNav />
    </main>
  );
}
