"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type OrbitNode = {
  symbol: string;
  name: string;
  color: string;
  distRatio: number;
  angle: number;
  speed: number;
  size: number;
  price: string;
  change: string;
  poolTvl: string;
  oracleStatus: string;
};

const NODES: OrbitNode[] = [
  {
    symbol: "NVDAx",
    name: "NVIDIA",
    color: "#76b900",
    distRatio: 0.28,
    angle: 0.3,
    speed: 0.0034,
    size: 34,
    price: "$212.33",
    change: "+4.12%",
    poolTvl: "$8.9M",
    oracleStatus: "Pyth Verified",
  },
  {
    symbol: "AAPLx",
    name: "Apple",
    color: "#9ca3af",
    distRatio: 0.42,
    angle: 1.9,
    speed: 0.0026,
    size: 32,
    price: "$331.94",
    change: "+1.84%",
    poolTvl: "$6.4M",
    oracleStatus: "Pyth Verified",
  },
  {
    symbol: "TSLAx",
    name: "Tesla",
    color: "#e82127",
    distRatio: 0.56,
    angle: 3.5,
    speed: 0.0021,
    size: 32,
    price: "$356.27",
    change: "-0.92%",
    poolTvl: "$4.8M",
    oracleStatus: "Pyth Verified",
  },
  {
    symbol: "MSFTx",
    name: "Microsoft",
    color: "#00a4ef",
    distRatio: 0.7,
    angle: 4.8,
    speed: 0.0017,
    size: 30,
    price: "$498.28",
    change: "+0.65%",
    poolTvl: "$3.7M",
    oracleStatus: "Pyth Verified",
  },
  {
    symbol: "AMZNx",
    name: "Amazon",
    color: "#ff9900",
    distRatio: 0.83,
    angle: 1.1,
    speed: 0.0014,
    size: 30,
    price: "$248.24",
    change: "+1.15%",
    poolTvl: "$3.2M",
    oracleStatus: "Pyth Verified",
  },
  {
    symbol: "METAx",
    name: "Meta",
    color: "#0668e1",
    distRatio: 0.95,
    angle: 2.8,
    speed: 0.0012,
    size: 28,
    price: "$668.63",
    change: "+2.38%",
    poolTvl: "$2.9M",
    oracleStatus: "Pyth Verified",
  },
];

const ARCHITECTURE_STEPS = [
  {
    id: 1,
    step: "01",
    label: "Curated Equities",
    tag: "Token-2022",
    desc: "1:1 backed shares with transparent corporate split multipliers.",
  },
  {
    id: 2,
    step: "02",
    label: "Dual Oracles",
    tag: "Pyth & DLMM",
    desc: "Real-time benchmark feeds cross-checked with on-chain pool quotes.",
  },
  {
    id: 3,
    step: "03",
    label: "Token Pairing",
    tag: "ClawPump Engine",
    desc: "Launch community tokens paired directly against liquid xStocks.",
  },
  {
    id: 4,
    step: "04",
    label: "24/7 Execution",
    tag: "Meteora DLMM",
    desc: "Sub-second block finality with non-custodial wallet signatures.",
  },
];

export function LandingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeNode, setActiveNode] = useState<OrbitNode | null>(NODES[0]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0.36;
    let targetRotY = 0;
    let currentRotX = 0.36;
    let currentRotY = 0;
    let isDragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    let time = 0;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Background starfield
    const stars = Array.from({ length: 48 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.2,
      speed: Math.random() * 0.02 + 0.01,
    }));

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx?.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left - width / 2;
      mouseY = e.clientY - rect.top - height / 2;

      if (isDragging) {
        const dx = e.clientX - lastDragX;
        const dy = e.clientY - lastDragY;
        targetRotY += dx * 0.006;
        targetRotX = Math.max(0.12, Math.min(0.65, targetRotX + dy * 0.004));
        lastDragX = e.clientX;
        lastDragY = e.clientY;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      if (canvas) canvas.style.cursor = "grab";
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerdown", onPointerDown);

    const angles = NODES.map((n) => n.angle);

    function render() {
      if (!ctx || width === 0 || height === 0) return;

      time += 0.02;

      // Inertia update
      currentRotX += (targetRotX - currentRotX) * 0.08;
      currentRotY += (targetRotY - currentRotY) * 0.08;

      if (!isDragging && !reducedMotion && !isPaused) {
        targetRotY += 0.0014;
      }

      ctx.clearRect(0, 0, width, height);

      // Deep dark cosmic canvas background
      const bgGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.65
      );
      bgGrad.addColorStop(0, "#130f28");
      bgGrad.addColorStop(0.5, "#0b081b");
      bgGrad.addColorStop(1, "#070512");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Background shimmering stars
      stars.forEach((star) => {
        const sx = width / 2 + star.x * (width * 0.48);
        const sy = height / 2 + star.y * (height * 0.48);
        const shimmer = star.alpha + Math.sin(time * 2 + star.speed * 100) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, shimmer)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      const cx = width / 2;
      const cy = height / 2;

      // Adaptive orbital radius based on stage dimensions (prevents any clipping)
      const maxOrbitRadius = Math.min(width * 0.44, height * 0.44);

      // Mouse parallax tilt
      const tiltX = (mouseX / (width * 0.5)) * 12;
      const tiltY = (mouseY / (height * 0.5)) * 8;
      const originX = cx + tiltX;
      const originY = cy + tiltY;

      ctx.save();
      ctx.translate(originX, originY);

      // Central core luminous glow (Solana purple & emerald)
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxOrbitRadius * 0.35);
      coreGrad.addColorStop(0, "rgba(153, 69, 255, 0.32)");
      coreGrad.addColorStop(0.4, "rgba(20, 241, 149, 0.12)");
      coreGrad.addColorStop(1, "rgba(153, 69, 255, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, maxOrbitRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Concentric orbital tracks with adaptive scaling
      NODES.forEach((node, idx) => {
        const dist = node.distRatio * maxOrbitRadius;

        ctx.beginPath();
        ctx.ellipse(0, 0, dist, dist * Math.cos(currentRotX), currentRotY, 0, Math.PI * 2);
        ctx.strokeStyle =
          activeStep === 1
            ? "rgba(153, 69, 255, 0.22)"
            : activeStep === 2
            ? "rgba(0, 194, 255, 0.2)"
            : activeStep === 3
            ? "rgba(20, 241, 149, 0.22)"
            : "rgba(153, 69, 255, 0.14)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling photon pulse on track
        if (!reducedMotion && !isPaused) {
          const pulseAngle = (time * (0.9 / (idx + 1)) + idx * 1.6) % (Math.PI * 2);
          const px = Math.cos(pulseAngle + currentRotY) * dist;
          const py = Math.sin(pulseAngle + currentRotY) * dist * Math.cos(currentRotX);

          ctx.fillStyle = idx % 2 === 0 ? "rgba(20, 241, 149, 0.9)" : "rgba(153, 69, 255, 0.9)";
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();

          // Photon glow
          const pGlow = ctx.createRadialGradient(px, py, 1, px, py, 8);
          pGlow.addColorStop(0, idx % 2 === 0 ? "rgba(20, 241, 149, 0.6)" : "rgba(153, 69, 255, 0.6)");
          pGlow.addColorStop(1, "transparent");
          ctx.fillStyle = pGlow;
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Central Solana Core Node
      const corePulse = Math.sin(time * 3) * 2;
      const coreRadius = Math.max(18, maxOrbitRadius * 0.08) + corePulse;

      // Outer ring
      ctx.strokeStyle = "rgba(20, 241, 149, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius + 6, 0, Math.PI * 2);
      ctx.stroke();

      // Inner disc
      const solanaCoreDisc = ctx.createLinearGradient(-coreRadius, -coreRadius, coreRadius, coreRadius);
      solanaCoreDisc.addColorStop(0, "#9945ff");
      solanaCoreDisc.addColorStop(1, "#14f195");
      ctx.fillStyle = solanaCoreDisc;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SOL", 0, 0);

      // Render nodes
      let hovered: OrbitNode | null = null;

      NODES.forEach((node, i) => {
        if (!reducedMotion && !isPaused) {
          angles[i] += node.speed;
        }
        const a = angles[i] + currentRotY;
        const dist = node.distRatio * maxOrbitRadius;
        const rx = Math.cos(a) * dist;
        const ry = Math.sin(a) * dist * Math.cos(currentRotX);

        // Perspective scaling
        const z = Math.sin(a) * Math.sin(currentRotX);
        const scale = 1 + z * 0.22;
        const nodeRadius = (node.size / 2) * scale;

        // Check hover
        const distToMouse = Math.hypot(originX + rx - (cx + mouseX), originY + ry - (cy + mouseY));
        const isHover = distToMouse < nodeRadius + 14;
        if (isHover) hovered = node;

        const isSelected = activeNode?.symbol === node.symbol;

        // Draw connecting ray to core
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = isHover || isSelected ? "rgba(20, 241, 149, 0.7)" : "rgba(153, 69, 255, 0.12)";
        ctx.lineWidth = isHover || isSelected ? 1.5 : 1;
        ctx.stroke();

        // Node brand glow
        const glow = ctx.createRadialGradient(rx, ry, nodeRadius * 0.5, rx, ry, nodeRadius * 2.4);
        glow.addColorStop(0, node.color + (isHover || isSelected ? "66" : "28"));
        glow.addColorStop(1, node.color + "00");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(rx, ry, nodeRadius * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Node background circle
        ctx.fillStyle = isHover || isSelected ? "#140f28" : "#0d091e";
        ctx.beginPath();
        ctx.arc(rx, ry, nodeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Brand color border ring
        ctx.strokeStyle = isHover || isSelected ? "#14f195" : node.color;
        ctx.lineWidth = isHover || isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // Symbol label
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.max(10, Math.floor(11 * scale))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.symbol.replace("x", ""), rx, ry);

        // Price badge tag
        if (isHover || isSelected || scale > 1.05) {
          const tagText = `${node.symbol} · ${node.price}`;
          ctx.font = "bold 9px monospace";
          const tw = ctx.measureText(tagText).width;

          ctx.fillStyle = isHover || isSelected ? "#181430" : "rgba(13, 9, 30, 0.85)";
          ctx.beginPath();
          ctx.roundRect(rx - tw / 2 - 6, ry - nodeRadius - 20, tw + 12, 16, 4);
          ctx.fill();

          ctx.strokeStyle = isHover || isSelected ? "#14f195" : "rgba(153, 69, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isHover || isSelected ? "#14f195" : "#a5b4fc";
          ctx.fillText(tagText, rx, ry - nodeRadius - 12);
        }
      });

      ctx.restore();

      if (hovered) {
        setActiveNode(hovered);
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [activeNode?.symbol, activeStep, isPaused]);

  return (
    <div className="os-orbit-stage" aria-label="Interactive market orbit visualization">
      {/* 4-Step Architecture Navigation Bar */}
      <div className="os-orbit-arch-bar" role="tablist" aria-label="OpenStock On-Chain Architecture Flow">
        {ARCHITECTURE_STEPS.map((step) => {
          const isActive = activeStep === step.id;
          return (
            <button
              type="button"
              key={step.id}
              role="tab"
              aria-selected={isActive}
              className={`os-arch-step-btn ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveStep(step.id)}
            >
              <div className="os-arch-step-num">{step.step}</div>
              <div className="os-arch-step-info">
                <strong>{step.label}</strong>
                <span>{step.tag}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Architecture Context Banner */}
      <div className="os-arch-step-desc">
        <span className="os-arch-badge">
          Step {ARCHITECTURE_STEPS[activeStep - 1]?.step}: {ARCHITECTURE_STEPS[activeStep - 1]?.label}
        </span>
        <span className="os-arch-desc-text">{ARCHITECTURE_STEPS[activeStep - 1]?.desc}</span>
      </div>

      {/* Top Header Controls */}
      <div className="os-orbit-info">
        <div className="os-orbit-status">
          <span className="os-orbit-pulse-dot" />
          <span className="os-orbit-title">24/7 Solana Liquidity Constellation</span>
        </div>
        <div className="os-orbit-actions">
          <button
            type="button"
            className="os-orbit-btn"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume Orbit" : "Pause Orbit"}
          >
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <span className="os-orbit-hint">Drag to rotate plane · Click or hover nodes</span>
        </div>
      </div>

      {/* Orbit Canvas Viewport */}
      <div className="os-orbit-canvas-viewport">
        <canvas ref={canvasRef} className="os-orbit-canvas" />

        {/* Live Telemetry Floating HUD Card */}
        {activeNode && (
          <div className="os-orbit-telemetry-card">
            <div className="os-telemetry-head">
              <div className="os-telemetry-brand">
                <span className="os-telemetry-dot" style={{ backgroundColor: activeNode.color }} />
                <strong>{activeNode.symbol}</strong>
                <small>{activeNode.name}</small>
              </div>
              <span className={`os-telemetry-change ${activeNode.change.startsWith("+") ? "is-up" : "is-down"}`}>
                {activeNode.change}
              </span>
            </div>

            <div className="os-telemetry-stats">
              <div className="os-telemetry-item">
                <span>Oracle Ref</span>
                <strong>{activeNode.price}</strong>
              </div>
              <div className="os-telemetry-item">
                <span>DLMM Depth</span>
                <strong>{activeNode.poolTvl}</strong>
              </div>
              <div className="os-telemetry-item">
                <span>Status</span>
                <strong className="os-highlight">{activeNode.oracleStatus}</strong>
              </div>
            </div>

            <div className="os-telemetry-actions">
              <Link href={`/app/asset/${activeNode.symbol}`} className="os-telemetry-link">
                Trade {activeNode.symbol} ↗
              </Link>
              <Link href={`/launch?symbol=${activeNode.symbol}`} className="os-telemetry-pair">
                Pair on Launch ✦
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Node Ticker Selector Pills */}
      <div className="os-orbit-node-chips">
        <span className="os-orbit-chip-label">Quick Select:</span>
        {NODES.map((node) => {
          const isSel = activeNode?.symbol === node.symbol;
          return (
            <button
              type="button"
              key={node.symbol}
              className={`os-node-chip ${isSel ? "is-selected" : ""}`}
              onClick={() => setActiveNode(node)}
            >
              <span className="os-chip-dot" style={{ backgroundColor: node.color }} />
              <strong>{node.symbol}</strong>
              <small>{node.price}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
