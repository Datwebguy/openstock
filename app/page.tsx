import Link from "next/link";
import { LandingStage, LandingReveals } from "@/components/landing-stage";
import { LandingCanvas } from "@/components/landing-canvas";
import { StockLogo } from "@/components/stock-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = {
  AAPLx: "Apple",
  NVDAx: "NVIDIA",
  TSLAx: "Tesla",
  MSFTx: "Microsoft",
  AMZNx: "Amazon",
  GOOGLx: "Alphabet",
  METAx: "Meta",
  COINx: "Coinbase",
  CRCLx: "Circle",
  SPYx: "S&P 500",
};

const questions = [
  [
    "What is OpenStock?",
    "OpenStock brings market context and execution tools together for tokenized xStocks on Solana. Explore assets, compare issuer references with on-chain pool quotes, follow corporate events, and review orders before approving them in your own wallet.",
  ],
  [
    "Do I need a wallet to explore?",
    "No. Browse all tokenized stocks, inspect real-time analytics, and review news without connecting. You only connect Phantom or Solflare when you are ready to prepare or sign a live order.",
  ],
  [
    "Is an xStock the same as a company share?",
    "An xStock is an on-chain tokenized product linked to an underlying stock or ETF. Holding a token is different from direct legal ownership of an equity share. Review issuer terms, reserves, and eligibility before trading.",
  ],
  [
    "Why can reference prices differ from pool quotes?",
    "The official issuer reference reflects primary market valuations, while decentralized on-chain pools (like Meteora DLMM) reflect immediate 24/7 liquidity on Solana. OpenStock places both sources side-by-side so you can inspect spreads and liquidity gaps transparently.",
  ],
  [
    "What happens before a live trade?",
    "You review the amount, effective multiplier, price impact, and Jupiter route. You then explicitly approve the transaction in your wallet. OpenStock never holds keys or asks for seed phrases.",
  ],
  [
    "What can I automate?",
    "Our rule builder lets you set limit, stop-loss, paired exit (OCO), and recurring DCA purchases. Every rule includes plain-language previews and funding verification before activation.",
  ],
  [
    "Where do my watchlists and receipts live?",
    "Your watchlist and paper review records stay stored locally in your browser. Wallet holdings are retrieved directly from your connected address on Solana. Receipts are saved to Activity for permanent reference.",
  ],
];

export default function HomePage() {
  const assets = CURATED_SYMBOLS.map((symbol) => ({
    symbol,
    name: names[symbol] ?? symbol,
  }));

  return (
    <main className="os-landing" id="top">
      <a href="#landing-title" className="os-skip">
        Skip to content
      </a>

      {/* Navigation */}
      <nav className="os-site-nav" aria-label="OpenStock navigation">
        <div className="os-shell os-nav-inner">
          <Link className="os-wordmark" href="/" aria-label="OpenStock home">
            <span className="os-brand-mark" aria-hidden="true">
              ◒
            </span>
            <span>OpenStock</span>
          </Link>
          <div className="os-site-links">
            <a href="#experience">The experience</a>
            <a href="#markets">Live stocks</a>
            <a href="#constellation">Constellation</a>
            <a href="#workspace">Workspace</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="os-nav-actions">
            <ThemeToggle />
            <Link className="os-nav-cta" href="/app">
              Open app <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </nav>

      <LandingReveals />

      {/* Hero Section */}
      <section className="os-hero" aria-labelledby="landing-title">
        <div className="os-shell os-hero-grid">
          <div className="os-hero-copy" data-reveal>
            <span className="os-micro os-micro-blue">Tokenized Stocks on Solana</span>
            <h1 id="landing-title">
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Know more.</span>
                </span>
                <span className="os-line" style={{ "--i": 2 } as React.CSSProperties}>
                  <span>Trade with clarity.</span>
                </span>
              </span>
            </h1>
            <p style={{ "--i": 3 } as React.CSSProperties}>
              Explore tokenized stocks on Solana through real-time issuer data, Meteora liquidity
              pools, and verified market intelligence.
            </p>
            <div className="os-hero-actions" style={{ "--i": 4 } as React.CSSProperties}>
              <Link className="os-button os-button-blue" href="/app">
                Explore stocks <span aria-hidden="true">→</span>
              </Link>
              <a className="os-button os-button-ghost" href="#experience">
                How it works <span aria-hidden="true">↓</span>
              </a>
            </div>
            <span className="os-caption" style={{ "--i": 5 } as React.CSSProperties}>
              Explore first. Connect a wallet only when you choose to trade.
            </span>
          </div>

          <div className="os-hero-stage-wrap" data-reveal>
            <LandingStage assets={assets} />
          </div>
        </div>
      </section>

      {/* Proof Band (High-contrast Electric Blue) */}
      <section className="os-proof os-band-blue" aria-label="Key highlights">
        <div className="os-shell os-proof-row" data-reveal>
          <div className="os-proof-item" style={{ "--i": 0 } as React.CSSProperties}>
            <strong>
              <span>15+</span>
            </strong>
            <span className="os-micro os-micro-light">Tokenized xStocks on Solana</span>
          </div>
          <div className="os-proof-item" style={{ "--i": 1 } as React.CSSProperties}>
            <strong>
              <span>&lt; 400ms</span>
            </strong>
            <span className="os-micro os-micro-light">Sub-second block finality</span>
          </div>
          <div className="os-proof-item" style={{ "--i": 2 } as React.CSSProperties}>
            <strong>
              <span>Jupiter & Meteora</span>
            </strong>
            <span className="os-micro os-micro-light">Aggregated pool liquidity</span>
          </div>
          <div className="os-proof-item" style={{ "--i": 3 } as React.CSSProperties}>
            <strong>
              <span>0</span>
            </strong>
            <span className="os-micro os-micro-light">Wallets needed to explore</span>
          </div>
        </div>
      </section>

      {/* Section 1: Every stock, an on-chain token */}
      <section id="experience" className="os-section">
        <div className="os-shell">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-blue">Global equities on Solana</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>Every stock,</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>an on-chain asset.</span>
                </span>
              </span>
            </h2>
            <p>
              Browse liquid tokenized shares like AAPLx and NVDAx with live on-chain prices,
              underlying reserve audits, and direct decentralized swap routing.
            </p>
            <Link className="os-text-link" href="/app">
              Explore the full market collection <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="os-card-row">
            <article className="os-card" data-reveal style={{ "--i": 0 } as React.CSSProperties}>
              <div className="os-card-art art-apple">
                <StockLogo symbol="AAPLx" size={56} />
              </div>
              <span className="os-card-tag">Consumer & Cloud</span>
              <h3>Everyday giants</h3>
              <p>
                From smartphones to enterprise platforms. Gain 24/7 exposure to Apple, Microsoft,
                and Amazon without traditional brokerage barriers.
              </p>
              <Link href="/app/asset/AAPLx" className="os-card-link">
                View AAPLx data <span aria-hidden="true">↗</span>
              </Link>
            </article>

            <article className="os-card" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
              <div className="os-card-art art-nvidia">
                <StockLogo symbol="NVDAx" size={56} />
              </div>
              <span className="os-card-tag">Accelerated Computing</span>
              <h3>Tomorrow&apos;s silicon</h3>
              <p>
                Follow the infrastructure powering artificial intelligence and data centers. Real-time
                Pyth benchmarks cross-checked with Meteora pools.
              </p>
              <Link href="/app/asset/NVDAx" className="os-card-link">
                View NVDAx data <span aria-hidden="true">↗</span>
              </Link>
            </article>

            <article className="os-card" data-reveal style={{ "--i": 2 } as React.CSSProperties}>
              <div className="os-card-art art-tesla">
                <StockLogo symbol="TSLAx" size={56} />
              </div>
              <span className="os-card-tag">Autonomous & Energy</span>
              <h3>Clean energy & mobility</h3>
              <p>
                Electric vehicles, robotics, and battery grids. Transparent share split multipliers
                ensure accurate Token-2022 accounting at all times.
              </p>
              <Link href="/app/asset/TSLAx" className="os-card-link">
                View TSLAx data <span aria-hidden="true">↗</span>
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Section 2: Live Market Intelligence (Electric Blue Band) */}
      <section id="markets" className="os-section os-band-blue">
        <div className="os-shell os-split">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-light">Market Context</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>Different sectors.</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Shared intelligence.</span>
                </span>
              </span>
            </h2>
            <p>
              Compare official primary quotes against on-chain liquidity depth. See where Jupiter
              routes orders and how liquidity providers earn fees on Meteora.
            </p>
            <Link className="os-button os-button-white" href="/app">
              Browse market desk <span aria-hidden="true">→</span>
            </Link>
            <span className="os-section-note">
              No simulated transactions. Live rates reflect verified Solana mainnet pools.
            </span>
          </div>

          <ul className="os-stock-list">
            {[
              {
                symbol: "NVDAx",
                name: "NVIDIA Corporation",
                sub: "Accelerated computing & AI chips",
                price: "$118.20",
                route: "Jupiter Swap v2",
                status: "Active DLMM Pool",
              },
              {
                symbol: "AAPLx",
                name: "Apple Inc.",
                sub: "Consumer hardware & global services",
                price: "$238.45",
                route: "Jupiter Swap v2",
                status: "Active DLMM Pool",
              },
              {
                symbol: "TSLAx",
                name: "Tesla, Inc.",
                sub: "Autonomous systems & energy grid",
                price: "$242.15",
                route: "Jupiter Swap v2",
                status: "Active DLMM Pool",
              },
              {
                symbol: "MSFTx",
                name: "Microsoft Corporation",
                sub: "Enterprise hyperscale cloud & AI",
                price: "$442.80",
                route: "Jupiter Swap v2",
                status: "Active DLMM Pool",
              },
            ].map((item, idx) => (
              <li
                key={item.symbol}
                className="os-stock-row"
                data-reveal
                style={{ "--i": idx } as React.CSSProperties}
              >
                <div className="os-stock-row-brand">
                  <StockLogo symbol={item.symbol} size={44} />
                  <div>
                    <div className="os-stock-row-top">
                      <strong>{item.symbol}</strong>
                      <span className="os-chip">{item.status}</span>
                    </div>
                    <span>{item.sub}</span>
                  </div>
                </div>
                <div className="os-stock-row-meta">
                  <strong>{item.price}</strong>
                  <small>{item.route}</small>
                </div>
                <Link
                  href={`/app/asset/${item.symbol}`}
                  className="os-stock-row-action"
                  aria-label={`Open ${item.symbol}`}
                >
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 3: Interactive Constellation Orbit Stage */}
      <section id="constellation" className="os-section os-section-tint">
        <div className="os-shell">
          <div className="os-section-head os-head-center" data-reveal>
            <span className="os-micro os-micro-blue">Tactile Market Physics</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>The on-chain constellation.</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Touch the liquidity.</span>
                </span>
              </span>
            </h2>
            <p>
              Equities on Solana share the exact same ledger, liquidity channels, and atomic
              composability as USDC and SOL. Drag to rotate the orbital plane.
            </p>
          </div>

          <div className="os-orbit-wrapper" data-reveal>
            <LandingCanvas />
          </div>
        </div>
      </section>

      {/* Section 4: Connected Workspace Bento Grid */}
      <section id="workspace" className="os-section">
        <div className="os-shell">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-blue">The OpenStock Workspace</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>Less searching.</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>More understanding.</span>
                </span>
              </span>
            </h2>
            <p>
              A unified suite from your initial discovery to order verification and automated execution.
            </p>
          </div>

          <div className="os-bento-grid">
            <Link
              href="/app/analytics"
              className="os-bento-card"
              data-reveal
              style={{ "--i": 0 } as React.CSSProperties}
            >
              <div className="os-bento-tags">
                <span>Pyth Oracle</span>
                <span>Meteora DLMM</span>
                <span>Issuer Books</span>
              </div>
              <h3>Multi-Source Analytics</h3>
              <p>
                Compare primary issuer reference prices against on-chain liquidity pools and real-time
                oracle deviation in one interactive dashboard.
              </p>
              <div className="os-widget-preview">
                <div className="os-widget-row">
                  <span>Pyth Benchmark</span>
                  <strong>$118.20</strong>
                </div>
                <div className="os-widget-row">
                  <span>Meteora DLMM Pool</span>
                  <strong>$118.22 <small className="os-spread-pill">+0.02% spread</small></strong>
                </div>
              </div>
              <span className="os-bento-link">
                Open analytics workspace <span aria-hidden="true">↗</span>
              </span>
            </Link>

            <Link
              href="/app/alerts"
              className="os-bento-card"
              data-reveal
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <span className="os-bento-symbol" aria-hidden="true">
                ↗
              </span>
              <h3>Intelligent Watches</h3>
              <p>
                Set threshold watches for pool price shifts, spread divergence, and liquidity drops.
                Revisit triggers anytime in your inbox.
              </p>
              <div className="os-widget-preview">
                <div className="os-watch-chip">
                  <span className="os-watch-dot" />
                  <span>NVDAx Price &gt; $125.00</span>
                  <strong>Active Watch</strong>
                </div>
              </div>
              <span className="os-bento-link">
                Configure watches <span aria-hidden="true">↗</span>
              </span>
            </Link>

            <Link
              href="/app/automation"
              className="os-bento-card"
              data-reveal
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <div className="os-rule-indicators" aria-hidden="true">
                <span>Plan</span>
                <span>Review</span>
                <span>Activate</span>
              </div>
              <h3>Plain-Language Automation</h3>
              <p>
                Construct limit, stop-loss, OCO, or DCA recurring buy rules. Plain English previews
                guarantee no ambiguity before funding.
              </p>
              <div className="os-widget-preview">
                <div className="os-rule-pill">
                  <span>IF AAPLx dips -2.5% → BUY 50 USDC</span>
                </div>
              </div>
              <span className="os-bento-link">
                Build a rule <span aria-hidden="true">↗</span>
              </span>
            </Link>

            <Link
              href="/app/activity"
              className="os-bento-card"
              data-reveal
              style={{ "--i": 3 } as React.CSSProperties}
            >
              <span className="os-bento-symbol" aria-hidden="true">
                ↶
              </span>
              <h3>Receipts & Audit Trail</h3>
              <p>
                Every paper simulation and live transaction generates an immutable receipt
                retaining both display shares and Token-2022 raw amounts.
              </p>
              <div className="os-widget-preview">
                <div className="os-receipt-chip">
                  <span>Receipt #4A81 · Solana Mainnet</span>
                  <strong>Verified</strong>
                </div>
              </div>
              <span className="os-bento-link">
                View activity & receipts <span aria-hidden="true">↗</span>
              </span>
            </Link>
          </div>

          <div className="os-quick-links" data-reveal>
            <Link href="/app/news">
              Market news feed <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/app/actions">
              Corporate stock splits & dividends <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/app/wallet">
              Wallet session & balances <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/app/learn/multipliers">
              Share adjustment guide <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 5: Decision Path (Electric Blue Band) */}
      <section className="os-section os-band-blue" aria-labelledby="path-title">
        <div className="os-shell os-path-grid">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-light">Clear Roadmap</span>
            <h2 id="path-title">
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>At your pace.</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Always your decision.</span>
                </span>
              </span>
            </h2>
            <p>
              Transparent execution with zero dark patterns or forced sign-ins. You retain total
              sovereignty over keys and transaction signatures.
            </p>
          </div>

          <ol className="os-path-steps" data-reveal>
            <li>
              <strong>01. Explore</strong>
              <p>
                Browse all 15+ curated tokenized stocks, track live order depth, and read news. Zero
                wallet connections required.
              </p>
            </li>
            <li>
              <strong>02. Understand</strong>
              <p>
                Verify quotes against issuer announcements, Pyth feeds, and active stock split
                multipliers so amounts always match reality.
              </p>
            </li>
            <li>
              <strong>03. Decide</strong>
              <p>
                Prepare an order ticket, review exact fees and slippage, and authorize execution
                directly in your Phantom or Solflare wallet.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Section 6: FAQ (Porcelain Accordion) */}
      <section id="faq" className="os-section os-section-tint" aria-labelledby="faq-title">
        <div className="os-shell os-faq-layout">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-blue">Common Inquiries</span>
            <h2 id="faq-title">
              A few good
              <br />
              questions.
            </h2>
            <p>Everything you need to understand tokenized equities on Solana.</p>
          </div>

          <div className="os-faq-list" data-reveal>
            {questions.map(([question, answer]) => (
              <details key={question} className="os-faq-item">
                <summary>
                  <span>{question}</span>
                  <span className="os-faq-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="os-faq-answer">
                  <p>{answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: Final Closing CTA (Electric Blue Band) */}
      <section className="os-cta os-band-blue">
        <div className="os-shell os-cta-inner" data-reveal>
          <div>
            <span className="os-micro os-micro-light">Take a closer look</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>Your next discovery</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>starts here.</span>
                </span>
              </span>
            </h2>
          </div>
          <div className="os-hero-actions" style={{ "--i": 2 } as React.CSSProperties}>
            <Link className="os-button os-button-white" href="/app">
              Open OpenStock <span aria-hidden="true">→</span>
            </Link>
            <Link className="os-button os-button-ghost" href="/app/analytics">
              Explore Analytics <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="os-footer">
        <div className="os-shell os-footer-top">
          <div className="os-footer-brand">
            <Link className="os-wordmark" href="/">
              <span className="os-brand-mark" aria-hidden="true">
                ◒
              </span>
              <span>OpenStock</span>
            </Link>
            <p>
              Market intelligence and trade context for tokenized stocks.
              <br />
              Built on Solana for sovereign decisions.
            </p>
            <div className="os-footer-status">
              <span className="os-status-dot" aria-hidden="true" />
              <span>Solana Mainnet feeds operational</span>
            </div>
          </div>

          <nav aria-label="Explore" className="os-footer-col">
            <h3>Explore</h3>
            <Link href="/app">Market desk</Link>
            <Link href="/app/analytics">Analytics</Link>
            <Link href="/app/automation">Automation</Link>
            <Link href="/app/asset/AAPLx">Apple (AAPLx)</Link>
            <Link href="/app/asset/NVDAx">NVIDIA (NVDAx)</Link>
          </nav>

          <nav aria-label="Learn" className="os-footer-col">
            <h3>Resources</h3>
            <Link href="/app/news">Market news</Link>
            <Link href="/app/actions">Corporate events</Link>
            <Link href="/app/alerts">Watches & alerts</Link>
            <Link href="/app/learn/multipliers">Share multipliers</Link>
          </nav>

          <nav aria-label="Workspace" className="os-footer-col">
            <h3>Workspace</h3>
            <Link href="/app/wallet">Wallet & holdings</Link>
            <Link href="/app/activity">Activity & receipts</Link>
            <a href="https://solana.com" target="_blank" rel="noreferrer">
              Built on Solana ↗
            </a>
          </nav>
        </div>

        <div className="os-shell os-footer-bottom">
          <span>© {new Date().getFullYear()} OpenStock</span>
          <p>
            Market information is not investment advice. Tokenized assets carry risk. Review issuer
            terms and eligibility; prices and execution are not guaranteed.
          </p>
          <a href="#top" className="os-back-top">
            Back to top ↑
          </a>
        </div>
      </footer>
    </main>
  );
}
