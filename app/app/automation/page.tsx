import Link from "next/link";
import { Suspense } from "react";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { OrderAutomation } from "@/components/order-automation";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = {
  AAPLx: "Apple",
  AMZNx: "Amazon",
  GOOGLx: "Alphabet",
  NVDAx: "NVIDIA",
  TSLAx: "Tesla",
  METAx: "Meta",
  MSFTx: "Microsoft",
  COINx: "Coinbase",
  CRCLx: "Circle",
  SPYx: "SP500",
};

export default function AutomationPage() {
  return (
    <main className="page">
      <AppNav />
      <Suspense fallback={<div className="container app-page"><section className="panel"><strong>Loading automation…</strong></section></div>}><OrderAutomation assets={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} /></Suspense>
      <AppFooterNav />
    </main>
  );
}
