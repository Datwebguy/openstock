import { Suspense } from "react";
import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { LaunchClient } from "./launch-client";
import "./launch.css";

export const metadata: Metadata = {
  title: "Launch Token Pair — OpenStock × ClawPump",
  description: "Create an independent community token and launch it directly paired against a tokenized stock on Solana.",
};

export default function LaunchPage() {
  return (
    <main className="launch-page">
      <AppNav ctaHref="/app" ctaLabel="Browse market" />
      <Suspense
        fallback={
          <div className="launch-container" style={{ padding: "64px 0", textAlign: "center", color: "var(--os-muted)" }}>
            Loading launch desk...
          </div>
        }
      >
        <LaunchClient />
      </Suspense>
    </main>
  );
}
