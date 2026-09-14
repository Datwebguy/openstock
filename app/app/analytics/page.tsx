import Link from "next/link";
import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SP500" };

export default function AnalyticsPage() {
return <main className="page"><AppNav /><div className="container app-page"><Link href="/app" className="back-link">← Back to market</Link><header className="analytics-page-header"><div><div className="eyebrow">Market intelligence · Solana</div><h1>See the move before you make it.</h1></div><p>Real pool candles, reference-price context, liquidity, and volume in one focused analytics workspace.</p></header><AnalyticsWorkspace symbols={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} /></div><AppFooterNav /></main>;
}
