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

      if (progress <= 0.01) {
        delete root.dataset.scrollDriven;
        return;
      }

      root.dataset.scrollDriven = "true";
      root.style.setProperty("--hero-camera-y", String(-progress * 8) + "%");
      root.style.setProperty("--hero-camera-scale", String(1 + progress * 0.28));
      root.style.setProperty("--hero-camera-tilt", String(progress * 4) + "deg");
      const copyDistance = window.innerWidth <= 520 ? 70 : window.innerWidth <= 800 ? 82 : 200;
      root.style.setProperty("--hero-copy-pull", String(progress * copyDistance) + "px");
      root.style.setProperty("--hero-cloud-x", String(progress * 12) + "%");
      root.style.setProperty("--hero-cloud-y", String(progress * 6) + "%");
      root.style.setProperty("--hero-cloud-scale", String(1 + progress * 0.15));
      root.style.setProperty("--hero-cloud-opacity", String(1 - progress * 0.15));
      root.style.setProperty("--hero-cluster-y", String(progress * 118) + "px");
      root.style.setProperty("--hero-cluster-scale", String(1 + progress * 1.15));
      root.style.setProperty("--hero-shadow-scale", String(0.7 + progress * 0.4));
      root.style.setProperty("--hero-shadow-opacity", String(0.25 + progress * 0.25));
      root.style.setProperty("--hero-orbit-scale", String(1 + progress * 0.12));
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
