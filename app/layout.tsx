import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";
import "./font-fix.css";
import "./visual-overrides.css";
import "./app-overrides.css";
import "./live-overrides.css";
import "./hero-size.css";
import "./network.css";
import "./apys-flow.css";
import "./final-type.css";
import "./ticker-fix.css";
import "./ticker-loop.css";
import "./evidence.css";
import "./status-markers.css";
import "./footer-fix.css";
import "./market-verdict.css";
import "./history.css";
import "./accessibility-fixes.css";
import "./discovery.css";
import "./analytics.css";
import "./asset-workspace.css";
import "./landing-flow.css";
import "./landing-story.css";
import "./theme.css";
import "./design-refresh.css";
import "./community-market.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "OpenStock — Tokenized-stock market context",
  description: "A clear market context layer for tokenized stocks on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <body className={`${display.variable} ${body.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("openstock:theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.setAttribute("data-theme","dark");else document.documentElement.setAttribute("data-theme","light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();` }} />
      <AppProviders>{children}</AppProviders>
    </body>
  </html>;
}
