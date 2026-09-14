import Link from "next/link";
import { MarketWatchWorkspace } from "@/components/market-watch-workspace";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SPDR S&P 500" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const initialSymbol = symbol && CURATED_SYMBOLS.includes(symbol) ? symbol : undefined;
  return <main className="page"><AppNav ctaLabel="Choose stock" /><div className="container app-page"><Link className="back-link" href="/app">← Market</Link><header className="app-market-header history-header"><div><div className="eyebrow">Market watches</div><h1>Keep an eye on the move.</h1></div><p>Save price and liquidity levels for the stocks you follow. Use the market view to review context before you trade.</p></header><Link className="text-link" href="/app/alerts/inbox">Open alert inbox →</Link><MarketWatchWorkspace symbols={CURATED_SYMBOLS.map((item) => ({ symbol: item, name: names[item] ?? item }))} initialSymbol={initialSymbol} /></div><AppFooterNav /></main>;
}
