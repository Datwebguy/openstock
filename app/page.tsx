import Link from "next/link";
import type { CSSProperties } from "react";
import { StockLogo } from "@/components/stock-logo";
import { CURATED_SYMBOLS, listSolanaAssets } from "@/lib/xstocks";

type LandingAsset = { symbol: string; name: string; logo?: string };

async function getLandingAssets(): Promise<LandingAsset[]> {
  const symbols = CURATED_SYMBOLS.slice(0, 10);
  try {
    const registered = await listSolanaAssets();
    const bySymbol = new Map(registered.map((asset) => [asset.symbol, asset]));
    return symbols.map((symbol) => {
      const asset = bySymbol.get(symbol);
      return { symbol, name: asset?.name?.replace(/ xStock$/, "") ?? symbol.replace(/x$/, ""), logo: asset?.logo };
    });
  } catch { return symbols.map((symbol) => ({ symbol, name: symbol.replace(/x$/, "") })); }
}

const heroSymbols = ["AAPLx", "TSLAx", "AMZNx"];
const signals = [
  ["Reference", "The issuer price gives the starting point."],
  ["Quote", "Pool context shows what is available on Solana."],
  ["Events", "Dividends and adjustments stay connected to the stock."],
];

export default async function HomePage() {
  const assets = await getLandingAssets();
  const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));
  const heroAssets = heroSymbols.map((symbol) => bySymbol.get(symbol) ?? { symbol, name: symbol.replace(/x$/, "") });

  return <main className="page landing">
    <nav className="nav landing-nav" aria-label="Primary navigation">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">◒</span> OpenStock</Link>
      <div className="nav-links"><a href="#read">How it works</a><a href="#names">Stocks</a><a href="#method">Method</a></div>
      <Link className="button button--gradient" href="/app">Browse stocks</Link>
    </nav>

    <section className="landing-hero container" aria-labelledby="landing-title">
      <div className="landing-hero__copy landing-reveal"><span className="eyebrow">Tokenized stocks · Solana</span><h1 id="landing-title">Make a clearer<br />first move.</h1><p>OpenStock puts the price, route, liquidity, and issuer context around a stock in one place.</p><div className="landing-hero__actions"><Link className="button button--gradient" href="/app">Browse stocks</Link><a href="#read" className="landing-inline-link">See the method <span aria-hidden="true">↓</span></a></div><div className="landing-proof"><span><strong>10</strong> listed xStocks</span><span><strong>Live</strong> market context</span><span><strong>0</strong> wallets needed to explore</span></div></div>
      <div className="landing-hero__scene" aria-label="Apple, Tesla, and Amazon tokenized stocks">
        <div className="landing-hero__glow" aria-hidden="true" />
        <div className="landing-hero__route" aria-hidden="true" />
        {heroAssets.map((asset, index) => <div className={`landing-stock landing-stock--${index + 1}`} key={asset.symbol}><StockLogo symbol={asset.symbol} logo={asset.logo} size={index === 1 ? 78 : 58} /><span>{asset.name}</span><small>{asset.symbol}</small></div>)}
        <div className="landing-hero__stamp">xStocks<br />on Solana</div>
      </div>
    </section>

    <section className="landing-read" id="read"><div className="container"><div className="landing-section-intro landing-reveal"><span className="eyebrow">Read the stock</span><h2>One name. Three live checks.</h2><p>Every price deserves context before it becomes a trade.</p></div><div className="landing-signal-steps">{signals.map(([title, copy], index) => <article className="landing-signal-step landing-reveal" style={{ "--step": index } as CSSProperties} key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div><i aria-hidden="true">↗</i></article>)}</div></div></section>

    <section className="landing-method section section--dark" id="method"><div className="container landing-method__grid"><div className="landing-method__copy landing-reveal"><span className="eyebrow">A shorter path</span><h2>Choose a stock.<br />Read the print.<br />Decide.</h2><p>Explore without a wallet. Connect only when you choose to buy or sell.</p><Link className="button button--light" href="/app">Open the market</Link></div><ol className="landing-method__list"><li className="landing-reveal"><strong>Explore</strong><span>Find a listed xStock.</span></li><li className="landing-reveal"><strong>Compare</strong><span>Review quote, depth, and issuer context.</span></li><li className="landing-reveal"><strong>Act</strong><span>Connect a wallet only at the ticket.</span></li></ol></div></section>

    <section className="landing-names container" id="names"><div className="landing-names__head landing-reveal"><div><span className="eyebrow">Listed stocks</span><h2>Start with a name you know.</h2></div><Link href="/app" className="landing-inline-link">View market <span aria-hidden="true">→</span></Link></div><div className="landing-name-grid">{assets.slice(0, 6).map((asset, index) => <Link className="landing-name landing-reveal" style={{ "--step": index } as CSSProperties} href={`/app/asset/${asset.symbol}`} key={asset.symbol}><StockLogo symbol={asset.symbol} logo={asset.logo} size={42} /><div><strong>{asset.name}</strong><span>{asset.symbol}</span></div><i aria-hidden="true">↗</i></Link>)}</div></section>

    <section className="landing-close"><div className="container landing-close__inner landing-reveal"><div><span className="eyebrow">OpenStock market</span><h2>See the context.<br />Then make your move.</h2></div><Link className="button button--gradient" href="/app">Browse stocks</Link></div></section>
    <footer className="landing-footer container"><span className="brand"><span className="brand-mark" aria-hidden="true">◒</span> OpenStock</span><span>Tokenized-stock market context on Solana.</span></footer>
  </main>;
}
