"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StockLogo } from "@/components/stock-logo";

type Asset = { symbol: string; name: string; logo?: string };

type StockMeta = {
  price: string;
  change: string;
  isPositive: boolean;
  poolPrice: string;
  spread: string;
  pool: string;
  volume: string;
  oracle: string;
};

const STOCK_DATA: Record<string, StockMeta> = {
  AAPLx: {
    price: "$238.45",
    change: "+1.84%",
    isPositive: true,
    poolPrice: "$238.49",
    spread: "0.01% spread",
    pool: "$4.2M Meteora DLMM",
    volume: "$1.8M 24h",
    oracle: "Pyth Verified",
  },
  NVDAx: {
    price: "$118.20",
    change: "+4.12%",
    isPositive: true,
    poolPrice: "$118.22",
    spread: "0.02% spread",
    pool: "$8.9M Meteora DLMM",
    volume: "$5.4M 24h",
    oracle: "Pyth Verified",
  },
  TSLAx: {
    price: "$242.15",
    change: "-0.92%",
    isPositive: false,
    poolPrice: "$242.10",
    spread: "0.02% spread",
    pool: "$3.1M Meteora DLMM",
    volume: "$1.2M 24h",
    oracle: "Pyth Verified",
  },
  MSFTx: {
    price: "$442.80",
    change: "+0.65%",
    isPositive: true,
    poolPrice: "$442.85",
    spread: "0.01% spread",
    pool: "$2.8M Meteora DLMM",
    volume: "$980K 24h",
    oracle: "Pyth Verified",
  },
};

export function LandingReveals() {
  const [scrollPercent, setScrollPercent] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");

    if (media.matches || !("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-in"));
      return;
    }

    document.documentElement.classList.add("os-motion-ready");

    // Reveal elements currently in initial viewport immediately
    const vh = window.innerHeight;
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.88) {
        el.classList.add("is-in");
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((el) => {
      if (!el.classList.contains("is-in")) {
        observer.observe(el);
      }
    });

    // Scroll progress scrubber and parallax variables
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
      setScrollPercent(progress);

      document.documentElement.style.setProperty("--scroll-y", `${scrollY}px`);
      document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(4));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className="os-scroll-scrubber"
      style={{ transform: `scaleX(${scrollPercent})` }}
      aria-hidden="true"
    />
  );
}

export function LandingStage({ assets }: { assets: Asset[] }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const featured = ["AAPLx", "NVDAx", "TSLAx", "MSFTx"].flatMap((symbol) =>
    assets.filter((asset) => asset.symbol === symbol)
  );

  const [selected, setSelected] = useState<string>("NVDAx");
  const asset = featured.find((item) => item.symbol === selected) ?? featured[0] ?? { symbol: "NVDAx", name: "NVIDIA" };
  const meta = STOCK_DATA[asset.symbol] ?? STOCK_DATA.NVDAx;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reducedMotion) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.5);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.5);
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const update = () => {
      currentX += (targetX - currentX) * 0.09;
      currentY += (targetY - currentY) * 0.09;

      stage.style.setProperty("--tilt-rx", `${(-currentY * 7).toFixed(2)}deg`);
      stage.style.setProperty("--tilt-ry", `${(currentX * 9).toFixed(2)}deg`);
      stage.style.setProperty("--tilt-tx", `${(currentX * 12).toFixed(2)}px`);
      stage.style.setProperty("--tilt-ty", `${(currentY * 8).toFixed(2)}px`);

      rafId = requestAnimationFrame(update);
    };

    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerleave", onPointerLeave);
    rafId = requestAnimationFrame(update);

    return () => {
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={stageRef} className="os-hero-stage" aria-label="Interactive stock showcase">
      <div className="os-stage-glow" aria-hidden="true" />

      {/* Floating Interactive 3D Perspective Card */}
      <div className="os-stage-card" key={asset.symbol}>
        <div className="os-stage-badge-row">
          <span className="os-type-badge">
            <span className="os-type-dot" />
            Tokenized xStock · Solana
          </span>
          <span className="os-stage-oracle">{meta.oracle}</span>
        </div>

        <div className="os-stage-main">
          <div className="os-stage-brand">
            <div className="os-stage-logo-wrap">
              <StockLogo symbol={asset.symbol} logo={asset.logo} size={64} />
            </div>
            <div>
              <span className="os-stage-ticker">{asset.symbol}</span>
              <h3 className="os-stage-name">{asset.name}</h3>
            </div>
          </div>

          <div className="os-stage-quote">
            <span className="os-stage-price">{meta.price}</span>
            <span className={`os-stage-change ${meta.isPositive ? "is-pos" : "is-neg"}`}>
              {meta.change}
            </span>
          </div>
        </div>

        {/* Live Market Spread Widget (High-signal real-time execution) */}
        <div className="os-stage-spread-bar">
          <div className="os-spread-item">
            <span className="os-spread-label">Pyth Oracle</span>
            <span className="os-spread-val">{meta.price}</span>
          </div>
          <div className="os-spread-arrow" aria-hidden="true">↔</div>
          <div className="os-spread-item">
            <span className="os-spread-label">Meteora Pool</span>
            <span className="os-spread-val">{meta.poolPrice}</span>
          </div>
          <div className="os-spread-badge">
            <span className="os-pulse-dot" />
            {meta.spread}
          </div>
        </div>

        <div className="os-stage-metrics">
          <div>
            <small>Liquidity</small>
            <strong>{meta.pool}</strong>
          </div>
          <div>
            <small>Volume</small>
            <strong>{meta.volume}</strong>
          </div>
          <div>
            <small>Execution</small>
            <strong className="os-live-route">Jupiter Route Ready</strong>
          </div>
        </div>

        <div className="os-stage-actions">
          <Link href={`/app/asset/${asset.symbol}`} className="os-button os-button-blue">
            Trade {asset.symbol} on Solana <span aria-hidden="true">→</span>
          </Link>
          <Link href={`/launch?symbol=${asset.symbol}`} className="os-button os-button-ghost">
            Pair &amp; Launch
          </Link>
        </div>
      </div>

      {/* Selector Tabs with logos */}
      <div className="os-stage-choices" role="tablist" aria-label="Featured tokenized stocks">
        {featured.map((item) => {
          const isSelected = item.symbol === asset.symbol;
          return (
            <button
              key={item.symbol}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`os-stage-tab ${isSelected ? "is-active" : ""}`}
              onClick={() => setSelected(item.symbol)}
            >
              <StockLogo symbol={item.symbol} size={28} />
              <div className="os-tab-label">
                <strong>{item.symbol}</strong>
                <span>{item.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
