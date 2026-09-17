import type { Metadata } from "next";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { OrdersDesk } from "@/components/orders-desk";

export const metadata: Metadata = {
  title: "Orders & Automations — OpenStock",
  description: "Monitor active limit orders, DCA recurring schedules, and verified on-chain trade receipts for tokenized equities on Solana.",
};

export default function OrdersPage() {
  return (
    <main className="page">
      <AppNav ctaHref="/app" ctaLabel="Trade Market" />
      <OrdersDesk />
      <AppFooterNav />
    </main>
  );
}
