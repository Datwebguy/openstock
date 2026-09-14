"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function LandingHeroMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = root.querySelector<HTMLElement>(".landing-eclipse-hero");
      if (!hero) return;

      const range = Math.max(hero.offsetHeight * 0.4, 1);
      const progress = Math.min(Math.max(window.scrollY / range, 0), 1);
      const compact = window.matchMedia("(max-width: 800px)").matches;

      if (progress <= 0.01) {
        delete root.dataset.scrollDriven;
        return;
      }

      root.dataset.scrollDriven = "true";
      root.style.setProperty("--hero-camera-y", String(-progress * (compact ? 3 : 8)) + "%");
      root.style.setProperty("--hero-camera-scale", String(1 + progress * (compact ? 0.08 : 0.28)));
      root.style.setProperty("--hero-camera-tilt", String(progress * (compact ? 0 : 4)) + "deg");
      root.style.setProperty("--hero-cloud-x", String(progress * (compact ? 5 : 12)) + "%");
      root.style.setProperty("--hero-cloud-y", String(progress * (compact ? 2 : 6)) + "%");
      root.style.setProperty("--hero-cloud-scale", String(1 + progress * (compact ? 0.05 : 0.15)));
      root.style.setProperty("--hero-cloud-opacity", String(1 - progress * (compact ? 0.06 : 0.15)));
      root.style.setProperty("--hero-cluster-y", String(progress * (compact ? 18 : 78)) + "px");
      root.style.setProperty("--hero-cluster-scale", String(1 + progress * (compact ? 0.15 : 1.15)));
      root.style.setProperty("--hero-shadow-scale", String(0.7 + progress * (compact ? 0.1 : 0.4)));
      root.style.setProperty("--hero-shadow-opacity", String(0.25 + progress * (compact ? 0.08 : 0.25)));
      root.style.setProperty("--hero-orbit-scale", String(1 + progress * (compact ? 0.04 : 0.12)));
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="landing-eclipse-motion" ref={rootRef}>{children}</div>;
}
