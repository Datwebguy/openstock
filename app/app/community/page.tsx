import type { Metadata } from "next";
import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CommunityMarketHub } from "@/components/community-market-hub";
import { getCommunityTokens } from "@/lib/community-tokens";
import curatedSymbols from "@/lib/curated-symbols.json";

export const metadata: Metadata = {
  title: "Community Stock Pairs & Memes — OpenStock × ClawPump",
  description: "Tokens launched on OpenStock and existing pools quoted directly in tokenized stocks (xStocks) on Solana.",
};

export default async function CommunityMarketPage() {
  const tokens = await getCommunityTokens();

  return (
    <main className="page">
      <AppNav ctaHref="/launch" ctaLabel="Launch Pair" />

      <div className="container app-page">
        <header className="workspace-heading">
          <div className="workspace-heading__body">
            <div className="workspace-kicker">
              <span className="live-dot" aria-hidden="true" />
              <span>Solana mainnet · pools quoted in xStocks</span>
            </div>
            <h1>Community Stock Pairs &amp; Memes</h1>
            <p>
              Tokens launched on OpenStock, plus existing pools found on DexScreener that trade directly against a tokenized stock. Prices and volume come from DexScreener; holders come from Solana.
            </p>
          </div>
          <div className="workspace-heading__actions">
            <Link className="button button--gradient" href="/launch">
              Launch Token Pair ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/app">
              {curatedSymbols.length} tokenized stocks ↗
            </Link>
          </div>
        </header>

        <CommunityMarketHub initialTokens={tokens} />
      </div>

      <AppFooterNav />
    </main>
  );
}
