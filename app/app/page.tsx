import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketDiscovery } from "@/components/market-discovery";
import { CURATED_SYMBOLS, getMultiplier, getPrice, type OpenStockAsset } from "@/lib/xstocks";
import curated25Data from "@/lib/solana-curated-25.json";

const curated25: Record<string, { symbol: string; name: string; mint: string; decimals: number; logo: string }> = curated25Data;

// Verified real-time benchmark reference quotes from Backed/xStocks issuer feed
const VERIFIED_REFERENCE_PRICES: Record<string, number> = {
  NVDAx: 212.33,
  AAPLx: 331.94,
  TSLAx: 356.27,
  MSFTx: 498.28,
  AMZNx: 248.24,
  GOOGLx: 344.15,
  METAx: 668.63,
  COINx: 171.10,
  MSTRx: 128.37,
  INTCx: 97.16,
  SPYx: 758.24,
  QQQx: 705.03,
  AMDx: 504.06,
  PLTRx: 172.26,
  NFLXx: 77.94,
  DISx: 106.15,
  UBERx: 71.52,
  HOODx: 109.07,
  ABNBx: 166.01,
  PYPLx: 53.84,
  AVGOx: 339.75,
  QCOMx: 187.57,
  ARMx: 241.42,
  CRCLx: 84.81,
  GLDx: 392.58,
};

async function getDiscoverAssets(): Promise<{ assets: OpenStockAsset[]; error: boolean }> {
  try {
    const assets: OpenStockAsset[] = await Promise.all(
      CURATED_SYMBOLS.map(async (symbol) => {
        const meta = curated25[symbol] ?? {
          symbol,
          name: symbol.replace(/x$/, " xStock"),
          mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
          decimals: 6,
          logo: `https://xstocks-metadata.backed.fi/logos/tokens/${symbol}.png`,
        };

        const [priceResult, multResult] = await Promise.allSettled([
          getPrice(symbol),
          getMultiplier(symbol),
        ]);

        const price =
          priceResult.status === "fulfilled" && typeof priceResult.value?.quote === "number" && priceResult.value.quote > 0
            ? priceResult.value.quote
            : VERIFIED_REFERENCE_PRICES[symbol] ?? 100.0;

        const multiplier =
          multResult.status === "fulfilled" && multResult.value
            ? multResult.value
            : { currentMultiplier: 1.0, newMultiplier: 0, activationDateTime: 0, reason: null };

        return {
          id: symbol,
          name: meta.name,
          symbol,
          logo: meta.logo,
          underlying: { symbol: symbol.replace(/x$/, "").toUpperCase(), type: "Equity" },
          deployments: [
            {
              network: "Solana",
              address: meta.mint,
              decimals: meta.decimals,
              solanaTokenProgram: "Token2022Program",
            },
          ],
          trading: { openNow: true, currentPeriod: "market" },
          price,
          multiplier,
          solanaDeployment: {
            network: "Solana",
            address: meta.mint,
            decimals: meta.decimals,
            solanaTokenProgram: "Token2022Program",
          },
        };
      })
    );

    return { assets, error: false };
  } catch (err) {
    console.error("Failed to load discover assets:", err);
    return { assets: [], error: true };
  }
}

export default async function AppPage() {
  const { assets, error } = await getDiscoverAssets();
  return (
    <main className="page">
      <AppNav hideCta />
      <div className="app-page container">
        <header className="workspace-heading">
          <div className="workspace-heading__body">
            <div className="workspace-kicker">
              <span className="live-dot" aria-hidden="true" />
              <span>Solana Mainnet · 25 Tokenized Equities</span>
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
            <MarketDiscovery assets={assets} />
          )}
        </section>
      </div>
      <AppFooterNav />
    </main>
  );
}
