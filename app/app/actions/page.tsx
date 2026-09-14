import Link from "next/link";
import { CorporateActionsWorkspace } from "@/components/corporate-actions-workspace";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SPDR S&P 500" };

export default function CorporateActionsPage() {
  return <main className="page"><AppNav ctaHref="/app" ctaLabel="Market" /><div className="container app-page"><Link href="/app" className="back-link">← Market</Link><header className="app-market-header history-header"><div><h1>Events</h1></div></header><CorporateActionsWorkspace symbols={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} /></div><AppFooterNav /></main>;
}
