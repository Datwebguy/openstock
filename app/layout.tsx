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
  metadataBase: new URL("https://joinopenstock.xyz"),
  title: "OpenStock — Tokenized Stock Market Context & Launchpad",
  description: "Trade tokenized stocks on Solana and launch community token pairs with automated creator royalties.",
  keywords: ["OpenStock", "joinopenstock.xyz", "Solana", "xStocks", "Tokenized Stocks", "ClawPump", "Meteora DBC", "DeFi"],
  authors: [{ name: "OpenStock Team", url: "https://joinopenstock.xyz" }],
  creator: "OpenStock",
  publisher: "OpenStock",
  alternates: {
    canonical: "https://joinopenstock.xyz",
  },
  openGraph: {
    title: "OpenStock — Tokenized Stock Market Context & Launchpad",
    description: "Trade tokenized stocks on Solana and launch community token pairs with automated creator royalties.",
    url: "https://joinopenstock.xyz",
    siteName: "OpenStock",
    images: [
      {
        url: "/logo/openstock-x-banner-nyse-brandmark-1500x500.png",
        width: 1200,
        height: 630,
        alt: "OpenStock — Tokenized Stock Market Context & Launchpad",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenStock — Tokenized Stock Market Context & Launchpad",
    description: "Trade tokenized stocks on Solana and launch community token pairs with automated creator royalties.",
    images: ["/logo/openstock-x-banner-nyse-brandmark-1500x500.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("openstock:theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.setAttribute("data-theme","dark");else document.documentElement.setAttribute("data-theme","light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
