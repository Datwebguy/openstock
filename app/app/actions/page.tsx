import Link from "next/link";
import { CorporateActionsWorkspace } from "@/components/corporate-actions-workspace";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SPDR S&P 500" };

export default function CorporateActionsPage() {
  return <main className="page"><AppNav /><div className="container app-page"><Link href="/app" className="back-link">← Market</Link><header className="app-market-header history-header"><div><div className="eyebrow">Issuer events</div><h1>See what can change a share.</h1></div><p>Dividends, splits, and other issuer actions can change the shape of a tokenized stock. Follow the event, then review the market before you trade.</p></header><CorporateActionsWorkspace symbols={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} /></div><AppFooterNav /></main>;
}
