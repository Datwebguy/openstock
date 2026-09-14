import Link from "next/link";
import { PaperReceipt } from "@/components/paper-receipt";
import { AppNav } from "@/components/app-nav";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="page"><AppNav ctaHref="/app" ctaLabel="Back to market" /><div className="app-page container"><PaperReceipt id={id} /><div className="receipt-actions"><Link className="button button--gradient" href="/app">Review another stock</Link><Link className="button button--outline" href="/app/learn/multipliers">Understand share adjustments</Link></div></div></main>;
}
