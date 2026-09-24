import type { Metadata } from "next";
import { AppNav, AppFooterNav } from "@/components/app-nav";
import { TokenTradeView } from "@/components/token-trade-view";
import { getCommunityTokenByMint } from "@/lib/community-tokens";
import { getStockCompany, formatStockTicker } from "@/lib/tokenized-stock-wording";
import { isValidHex6, sanitizeHex6 } from "@/lib/og-color-clamping";

interface PageProps {
  params: Promise<{ mint: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { mint } = await params;
  const sParams = await searchParams;
  const rawColor = typeof sParams?.c === "string" ? sParams.c : undefined;
  const validColor = isValidHex6(rawColor) ? sanitizeHex6(rawColor) : null;

  const token = await getCommunityTokenByMint(mint);

  const cleanSymbol = token
    ? token.symbol.startsWith("$")
      ? token.symbol.slice(1).toUpperCase()
      : token.symbol.toUpperCase()
    : "TOKEN";

  const stockSymbol = token?.pairedStockSymbol || "NVDAx";
  const stockConfig = getStockCompany(stockSymbol);
  const stockX = formatStockTicker(stockSymbol);
  const companyName = stockConfig.companyName;

  const canonicalUrl = `https://joinopenstock.xyz/token/${encodeURIComponent(mint)}${
    validColor ? `?c=${validColor}&ref=x` : `?ref=x`
  }`;

  const ogParams = new URLSearchParams();
  ogParams.set("symbol", cleanSymbol);
  ogParams.set("stock", stockSymbol);
  if (token?.imageUrl) {
    ogParams.set("logo", token.imageUrl);
  }
  if (validColor) {
    ogParams.set("c", validColor);
  }

  const ogImageUrl = `https://joinopenstock.xyz/api/og/token?${ogParams.toString()}`;

  const title = `$${cleanSymbol} on OpenStock`;
  const description = `${cleanSymbol} is paired with tokenized ${companyName} stock (${stockX}) on Solana.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${cleanSymbol} paired with ${stockSymbol}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function TokenPage({ params, searchParams }: PageProps) {
  const { mint } = await params;
  const sParams = await searchParams;
  const rawColor = typeof sParams?.c === "string" ? sParams.c : undefined;
  const validColor = isValidHex6(rawColor) ? sanitizeHex6(rawColor) : undefined;

  const token = await getCommunityTokenByMint(mint);

  return (
    <main className="page">
      <AppNav ctaHref="/launch" ctaLabel="Launch Pair" />

      <div className="container app-page">
        <TokenTradeView token={token} mint={mint} initialColor={validColor ?? undefined} />
      </div>

      <AppFooterNav />
    </main>
  );
}
