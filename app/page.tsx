import Link from "next/link";
import type { CSSProperties } from "react";
import { siSolana } from "simple-icons/icons";
import { LandingHeroMotion } from "@/components/landing-hero-motion";
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

const orbitSymbols = ["AAPLx", "TSLAx", "AMZNx", "NVDAx", "MSFTx", "GOOGLx", "METAx", "COINx"];
const tickerSymbols = ["AAPLx", "TSLAx", "NVDAx", "MSFTx", "AMZNx", "GOOGLx", "METAx", "COINx", "CRCLx", "SPYx"];
const signals = [
  ["Reference", "The issuer price gives the starting point."],
  ["Quote", "Pool context shows what is available on Solana."],
  ["Events", "Dividends and adjustments stay connected to the stock."],
];

export default async function HomePage() {
  const assets = await getLandingAssets();
  const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));
  const orbitAssets = orbitSymbols.map((symbol) => bySymbol.get(symbol) ?? { symbol, name: symbol.replace(/x$/, "") });

  return <main className="page landing">
    <nav className="nav landing-nav landing-nav--hero" aria-label="Primary navigation">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">◒</span> OpenStock</Link>
      <div className="nav-links"><Link href="/app">Market</Link><Link href="/app/analytics">Analyze</Link><Link href="/app/automation">Automate</Link><Link href="/app/activity">Activity</Link><Link href="/app/you">You</Link></div>
      <Link className="button button--gradient" href="/app">Browse stocks</Link>
    </nav>

    <LandingHeroMotion><section className="landing-eclipse-hero" aria-labelledby="landing-title">
      <div className="landing-eclipse-hero__stars" aria-hidden="true" />
      <div className="landing-eclipse-hero__camera" aria-hidden="true">
        <div className="landing-eclipse-hero__ring" />
        <div className="landing-eclipse-hero__ridge" />
        <div className="landing-eclipse-hero__cloud landing-eclipse-hero__cloud--left"><i /><i /><i /><i /></div>
        <div className="landing-eclipse-hero__cloud landing-eclipse-hero__cloud--right"><i /><i /><i /><i /></div>
        <div className="landing-eclipse-cluster">
          <div className="landing-eclipse-cluster__arrival">
            <span className="landing-eclipse-cluster__shadow" />
            <div className="landing-eclipse-cube"><div className="landing-eclipse-cube__yaw"><div className="landing-eclipse-cube__face landing-eclipse-cube__face--front"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<path d="${siSolana.path}"/>` }} /></div><div className="landing-eclipse-cube__face landing-eclipse-cube__face--right" /><div className="landing-eclipse-cube__face landing-eclipse-cube__face--top" /></div></div>
            <div className="landing-eclipse-orbit landing-eclipse-orbit--inner">
              {orbitAssets.slice(0, 4).map((asset, index) => <div className="landing-eclipse-orbit__carrier" style={{ "--angle": `${index * 90}deg`, "--counter": `${-index * 90}deg`, "--delay": `${120 + index * 40}ms` } as CSSProperties} key={asset.symbol}><div className="landing-eclipse-orbit__arrival"><div className="landing-eclipse-orbit__disc"><StockLogo symbol={asset.symbol} logo={asset.logo} size={32} /></div></div></div>)}
            </div>
            <div className="landing-eclipse-orbit landing-eclipse-orbit--outer">
              {orbitAssets.slice(4).map((asset, index) => <div className="landing-eclipse-orbit__carrier" style={{ "--angle": `${index * 90 + 45}deg`, "--counter": `${-(index * 90 + 45)}deg`, "--delay": `${280 + index * 40}ms` } as CSSProperties} key={asset.symbol}><div className="landing-eclipse-orbit__arrival"><div className="landing-eclipse-orbit__disc"><StockLogo symbol={asset.symbol} logo={asset.logo} size={28} /></div></div></div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="landing-eclipse-hero__content">
        <span className="eyebrow">OpenStock</span>
        <h1 id="landing-title"><span>Tokenized</span><span>Stocks</span><span className="landing-eclipse-hero__on">On <b>Solana</b></span></h1>
        <p>XStocks on Solana · Live market</p>
        <div className="landing-eclipse-hero__actions"><Link href="/app">Browse stocks</Link><Link href="/app/you">Connect wallet</Link></div>
      </div>
      <div className="landing-eclipse-ticker" aria-label="Listed xStocks"><div className="landing-eclipse-ticker__track">{[...tickerSymbols, ...tickerSymbols].map((symbol, index) => <span key={`${symbol}-${index}`}>{symbol}</span>)}</div></div>
    </section></LandingHeroMotion>

    <section className="landing-read" id="read"><div className="container"><div className="landing-section-intro landing-reveal"><span className="eyebrow">Read the stock</span><h2>One name. Three live checks.</h2><p>Every price deserves context before it becomes a trade.</p></div><div className="landing-signal-steps">{signals.map(([title, copy], index) => <article className="landing-signal-step landing-reveal" style={{ "--step": index } as CSSProperties} key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div><i aria-hidden="true">↗</i></article>)}</div></div></section>

    <section className="landing-method section section--dark" id="method"><div className="container landing-method__grid"><div className="landing-method__copy landing-reveal"><span className="eyebrow">A shorter path</span><h2>Choose a stock.<br />Read the print.<br />Decide.</h2><p>Explore without a wallet. Connect only when you choose to buy or sell.</p><Link className="button button--light" href="/app">Open the market</Link></div><ol className="landing-method__list"><li className="landing-reveal"><strong>Explore</strong><span>Find a listed xStock.</span></li><li className="landing-reveal"><strong>Compare</strong><span>Review quote, depth, and issuer context.</span></li><li className="landing-reveal"><strong>Act</strong><span>Connect a wallet only at the ticket.</span></li></ol></div></section>

    <section className="landing-names container" id="names"><div className="landing-names__head landing-reveal"><div><span className="eyebrow">Listed stocks</span><h2>Start with a name you know.</h2></div><Link href="/app" className="landing-inline-link">View market <span aria-hidden="true">→</span></Link></div><div className="landing-name-grid">{assets.slice(0, 6).map((asset, index) => <Link className="landing-name landing-reveal" style={{ "--step": index } as CSSProperties} href={`/app/asset/${asset.symbol}`} key={asset.symbol}><StockLogo symbol={asset.symbol} logo={asset.logo} size={42} /><div><strong>{asset.name}</strong><span>{asset.symbol}</span></div><i aria-hidden="true">↗</i></Link>)}</div></section>

    <section className="landing-close"><div className="container landing-close__inner landing-reveal"><div><span className="eyebrow">OpenStock market</span><h2>See the context.<br />Then make your move.</h2></div><Link className="button button--gradient" href="/app">Browse stocks</Link></div></section>
    <footer className="landing-footer container"><span className="brand"><span className="brand-mark" aria-hidden="true">◒</span> OpenStock</span><span>Tokenized-stock market context on Solana.</span></footer>
  </main>;
}
