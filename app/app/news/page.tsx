import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketNewsFeed } from "@/components/market-news-feed";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "Nvidia", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "S&P 500" };

export default function NewsPage() {
  return <main className="page"><AppNav ctaHref="/app" ctaLabel="Market" /><div className="container app-page news-page"><Link href="/app" className="back-link">← Market</Link><header className="news-header"><h1>News</h1><p className="workspace-description">Follow company headlines and open the source for the full story.</p></header><MarketNewsFeed symbols={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} /></div><AppFooterNav /></main>;
}
