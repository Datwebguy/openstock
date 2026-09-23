import Link from "next/link";
import { LandingStage, LandingReveals } from "@/components/landing-stage";
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
    "OpenStock pairs tokenized equities (xStocks) on Solana with Meteora DLMM liquidity, Pyth benchmark oracles, and community token launch capability.",
  ],
  [
    "Do I need a wallet to explore?",
    "No. Browse all 25 equities, live pools, and news freely. Connect Phantom or Solflare only when executing a swap or launching a token.",
  ],
  [
    "Is an xStock the same as a company share?",
    "xStocks are tokenized equities backed 1:1 by underlying shares with on-chain oracle verification.",
  ],
  [
    "Why can reference prices differ from pool quotes?",
    "Issuer reference reflects primary market valuations, while Meteora DLMM pools trade 24/7 on Solana. Spreads show immediate liquidity conditions.",
  ],
  [
    "How does token pairing and launching work?",
    "Use our Launch studio to create a community token paired directly against any xStock (e.g. YOUR_TOKEN × AAPLx) on Solana via ClawPump.",
  ],
  [
    "What orders can I automate?",
    "Configure limit, stop-loss, paired exit (OCO), and recurring DCA rules with clear funding verification.",
  ],
  [
    "Where do receipts and keys live?",
    "OpenStock is 100% non-custodial. We never hold keys or seed phrases. Transaction receipts are permanently indexed to your wallet address.",
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
            <img src="/logo/openstock-icon-transparent.png" alt="OpenStock" width={28} height={28} className="os-brand-logo-img" />
            <span>OpenStock</span>
          </Link>
          <div className="os-site-links">
            <a href="#signal">Signal</a>
            <a href="#reference">Reference</a>
            <a href="#liquidity">Liquidity</a>
            <a href="#multiplier">Multiplier</a>
            <a href="#receipt">Receipt</a>
            <Link href="/launch" style={{ color: "var(--solana-purple)", fontWeight: 700 }}>
              Launch
            </Link>
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

      {/* Hero Section — Signal */}
      <section id="signal" className="os-hero" aria-labelledby="landing-title">
        <div className="os-shell os-hero-grid">
          <div className="os-hero-copy" data-reveal>
            <span className="os-micro os-micro-blue">24/7 Tokenized Equities · Solana</span>
            <h1 id="landing-title">
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Real Stocks.</span>
                </span>
                <span className="os-line" style={{ "--i": 2 } as React.CSSProperties}>
                  <span>On Solana.</span>
                </span>
              </span>
            </h1>
            <p style={{ "--i": 3 } as React.CSSProperties}>
              Trade tokenized equities 24/7 with live Meteora DLMM pools, Pyth benchmarks, and community token launches.
            </p>
            <div className="os-hero-actions" style={{ "--i": 4 } as React.CSSProperties}>
              <Link className="os-button os-button-blue" href="/app">
                Explore Markets <span aria-hidden="true">→</span>
              </Link>
              <Link className="os-button os-button-ghost" href="/launch">
                Launch Token
              </Link>
            </div>
            <div className="os-hero-live-pill" style={{ "--i": 5 } as React.CSSProperties}>
              <span className="live-dot" />
              <span>25 Curated Equities Live · Sub-Second Block Finality</span>
            </div>
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
              <span>25</span>
            </strong>
            <span className="os-micro os-micro-light">Tokenized Equities on Solana</span>
          </div>
          <div className="os-proof-item" style={{ "--i": 1 } as React.CSSProperties}>
            <strong>
              <span>&lt; 400ms</span>
            </strong>
            <span className="os-micro os-micro-light">Sub-second block finality</span>
          </div>
          <div className="os-proof-item" style={{ "--i": 2 } as React.CSSProperties}>
            <strong>
              <span>DLMM Pools</span>
            </strong>
            <span className="os-micro os-micro-light">Aggregated Meteora liquidity</span>
          </div>
          <div className="os-proof-item" style={{ "--i": 3 } as React.CSSProperties}>
            <strong>
              <span>0%</span>
            </strong>
            <span className="os-micro os-micro-light">Custodial risk · Non-custodial</span>
          </div>
        </div>
      </section>

      {/* Reference — source comparison story */}
      <section id="reference" className="os-section">
        <div className="os-shell">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-blue">Reference</span>
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
            <p>24/7 liquid tokenized equities backed 1:1 with transparent share reserves.</p>
            <Link className="os-text-link" href="/app">
              Explore 25 tokenized stocks <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="os-card-row">
            <article className="os-card" data-reveal style={{ "--i": 0 } as React.CSSProperties}>
              <div className="os-card-art art-apple">
                <StockLogo symbol="AAPLx" size={56} />
              </div>
              <span className="os-card-tag">Mega-Cap Tech</span>
              <h3>Everyday giants</h3>
              <p>24/7 exposure to Apple, Microsoft, and Amazon on Solana.</p>
              <Link href="/app/asset/AAPLx" className="os-card-link">
                View AAPLx desk <span aria-hidden="true">↗</span>
              </Link>
            </article>

            <article className="os-card" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
              <div className="os-card-art art-nvidia">
                <StockLogo symbol="NVDAx" size={56} />
              </div>
              <span className="os-card-tag">AI Infrastructure</span>
              <h3>Silicon leaders</h3>
              <p>NVIDIA GPUs & datacenter silicon with real-time Pyth oracles.</p>
              <Link href="/app/asset/NVDAx" className="os-card-link">
                View NVDAx desk <span aria-hidden="true">↗</span>
              </Link>
            </article>

            <article className="os-card" data-reveal style={{ "--i": 2 } as React.CSSProperties}>
              <div className="os-card-art art-tesla">
                <StockLogo symbol="TSLAx" size={56} />
              </div>
              <span className="os-card-tag">Robotics & Energy</span>
              <h3>Clean energy</h3>
              <p>Tesla EVs, energy storage, and 24/7 on-chain equity trading.</p>
              <Link href="/app/asset/TSLAx" className="os-card-link">
                View TSLAx desk <span aria-hidden="true">↗</span>
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Liquidity — pools & depth */}
      <section id="liquidity" className="os-section os-band-blue">
        <div className="os-shell os-split">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-light">Liquidity</span>
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
            <p>Real-time Pyth benchmarks cross-checked against Meteora DLMM pool depth.</p>
            <Link className="os-button os-button-white" href="/app">
              Browse market desk <span aria-hidden="true">→</span>
            </Link>
            <span className="os-section-note">
              Verified Solana mainnet liquidity.
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

      {/* Multiplier — share adjustments & Token-2022 amounts */}
      <section id="multiplier" className="os-section os-section-tint">
        <div className="os-shell">
          <div className="os-section-head os-head-center" data-reveal>
            <span className="os-micro os-micro-green">Multiplier</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>UI shares stay honest.</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Raw Token-2022 amounts settle.</span>
                </span>
              </span>
            </h2>
            <p>Corporate actions and multipliers are applied at display and order layers — never as a decorative afterthought.</p>
          </div>

          <div className="os-arch-grid" data-reveal>
            {/* Card 1: Token-2022 Equities with Apple and NVIDIA real logos */}
            <article className="os-arch-card">
              <div className="os-arch-card__top">
                <div className="os-arch-card__logos">
                  <StockLogo symbol="AAPLx" size={32} />
                  <StockLogo symbol="NVDAx" size={32} />
                </div>
                <span className="os-arch-card__badge os-badge-green">1:1 Backed</span>
              </div>
              <h3>Tokenized Equities</h3>
              <p>25 curated blue-chip stocks backed by physical custodian shares.</p>
              <div className="os-arch-card__meta">
                <span>Depository</span>
                <strong>Backed Finance AG</strong>
              </div>
            </article>

            {/* Card 2: Dual Oracles with Microsoft and Alphabet real logos */}
            <article className="os-arch-card">
              <div className="os-arch-card__top">
                <div className="os-arch-card__logos">
                  <StockLogo symbol="MSFTx" size={32} />
                  <StockLogo symbol="GOOGLx" size={32} />
                </div>
                <span className="os-arch-card__badge os-badge-purple">Sub-Second</span>
              </div>
              <h3>Dual-Oracle Consensus</h3>
              <p>Pyth benchmarks cross-verified with on-chain DLMM pool depth.</p>
              <div className="os-arch-card__meta">
                <span>Oracles</span>
                <strong>Pyth + Meteora</strong>
              </div>
            </article>

            {/* Card 3: ClawPump Pairing with Tesla and Coinbase real logos */}
            <article className="os-arch-card">
              <div className="os-arch-card__top">
                <div className="os-arch-card__logos">
                  <StockLogo symbol="TSLAx" size={32} />
                  <StockLogo symbol="COINx" size={32} />
                </div>
                <span className="os-arch-card__badge os-badge-blue">ClawPump</span>
              </div>
              <h3>Stock Pair Launches</h3>
              <p>Launch community tokens paired directly against xStocks.</p>
              <div className="os-arch-card__meta">
                <span>Pairing</span>
                <strong>YOUR_TOKEN × TSLAx</strong>
              </div>
            </article>

            {/* Card 4: 24/7 Execution with Amazon and Meta real logos */}
            <article className="os-arch-card">
              <div className="os-arch-card__top">
                <div className="os-arch-card__logos">
                  <StockLogo symbol="AMZNx" size={32} />
                  <StockLogo symbol="METAx" size={32} />
                </div>
                <span className="os-arch-card__badge os-badge-green">24/7 DEX</span>
              </div>
              <h3>Continuous Settlement</h3>
              <p>Instant on-chain execution with zero market closing halts.</p>
              <div className="os-arch-card__meta">
                <span>Settlement</span>
                <strong>Solana Mainnet</strong>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Receipt — proof & workspace modules */}
      <section id="receipt" className="os-section">
        <div className="os-shell">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-blue">Receipt</span>
            <h2>
              <span className="os-lines">
                <span className="os-line" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>Less searching.</span>
                </span>
                <span className="os-line" style={{ "--i": 1 } as React.CSSProperties}>
                  <span>More verifiable proof.</span>
                </span>
              </span>
            </h2>
            <p>Discovery, pool telemetry, automation, and receipts that keep UI shares and raw settlement amounts together.</p>
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
              <p>Compare primary reference prices with on-chain pool depth and spread divergence.</p>
              <div className="os-widget-preview">
                <div className="os-widget-row">
                  <span>Pyth Benchmark</span>
                  <strong>$212.33</strong>
                </div>
                <div className="os-widget-row">
                  <span>Meteora DLMM Pool</span>
                  <strong>$212.37 <small className="os-spread-pill">+0.02% spread</small></strong>
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
              <p>Threshold watches for pool price shifts, spread divergence, and liquidity drops.</p>
              <div className="os-widget-preview">
                <div className="os-watch-chip">
                  <span className="os-watch-dot" />
                  <span>NVDAx Price &gt; $220.00</span>
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
              <h3>Rule Automation</h3>
              <p>Build limit, stop-loss, OCO, or DCA recurring buy rules with zero ambiguity.</p>
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
              <p>Cryptographic receipts retaining display shares and verifiable settlement amounts.</p>
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
            <Link href="/app/analytics">
              Liquidity &amp; pool analytics <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 5: Decision Path (Electric Blue Band) */}
      <section className="os-section os-band-blue" aria-labelledby="path-title">
        <div className="os-shell os-path-grid">
          <div className="os-section-head" data-reveal>
            <span className="os-micro os-micro-light">Non-Custodial Flow</span>
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
            <p>Transparent execution with non-custodial wallet signatures.</p>
          </div>

          <ol className="os-path-steps" data-reveal>
            <li>
              <strong>01. Explore</strong>
              <p>Browse 25+ verified tokenized equities and live DLMM depth with zero wallet needed.</p>
            </li>
            <li>
              <strong>02. Verify</strong>
              <p>Cross-check Pyth benchmarks, pool spreads, and verified reserve coverage.</p>
            </li>
            <li>
              <strong>03. Execute</strong>
              <p>Review exact fees, route, and sign directly in Phantom or Solflare.</p>
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
              <img src="/logo/openstock-icon-transparent.png" alt="OpenStock" width={28} height={28} className="os-brand-logo-img" />
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
            <Link href="/app/alerts">Watches &amp; alerts</Link>
            <Link href="/app/analytics">Pool analytics</Link>
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
