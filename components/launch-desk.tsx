import { Suspense } from "react";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { LaunchClient } from "@/app/launch/launch-client";
import "@/app/launch/launch.css";

export function LaunchDesk() {
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
      <AppFooterNav />
    </main>
  );
}
