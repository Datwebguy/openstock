import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { MarketNewsFeed } from "@/components/market-news-feed";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "Nvidia", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "S&P 500" };

export default function NewsPage() {
  return <main className="page"><AppNav ctaHref="/app" ctaLabel="Market" /><div className="container app-page news-page"><Link href="/app" className="back-link">← Back to market</Link><header className="news-header"><div className="eyebrow">Market news</div><h1>See what is moving the conversation.</h1><p>Reporting and social posts for the stocks you follow. Official dividends, splits, and other issuer actions stay in the issuer-events feed.</p></header><MarketNewsFeed symbols={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} /></div><AppFooterNav /></main>;
}
