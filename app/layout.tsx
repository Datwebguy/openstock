import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./font-fix.css";
import "./visual-overrides.css";
import "./app-overrides.css";
import "./live-overrides.css";
import "./hero-size.css";
import "./network.css";
import "./stock-character.css";
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

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "OpenStock — Tokenized-stock market context",
  description: "A clear market context layer for tokenized stocks on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>;
}
