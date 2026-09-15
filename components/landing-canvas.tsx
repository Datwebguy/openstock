"use client";

import { useEffect, useRef, useState } from "react";

type Node = {
  symbol: string;
  name: string;
  color: string;
  distance: number;
  angle: number;
  speed: number;
  size: number;
};

const NODES: Node[] = [
  { symbol: "NVDAx", name: "NVIDIA", color: "#76b900", distance: 130, angle: 0.2, speed: 0.0032, size: 30 },
  { symbol: "AAPLx", name: "Apple", color: "#6e7681", distance: 190, angle: 1.8, speed: 0.0025, size: 30 },
  { symbol: "TSLAx", name: "Tesla", color: "#e82127", distance: 250, angle: 3.4, speed: 0.002, size: 28 },
  { symbol: "MSFTx", name: "Microsoft", color: "#00a4ef", distance: 310, angle: 4.9, speed: 0.0016, size: 28 },
  { symbol: "AMZNx", name: "Amazon", color: "#ff9900", distance: 360, angle: 0.9, speed: 0.0013, size: 26 },
  { symbol: "METAx", name: "Meta", color: "#0668e1", distance: 410, angle: 2.7, speed: 0.0011, size: 26 },
];

export function LandingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);

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
    let targetRotX = 0.32;
    let targetRotY = 0;
    let currentRotX = 0.32;
    let currentRotY = 0;
    let isDragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    let time = 0;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

      if (!isDragging && !reducedMotion) {
        targetRotY += 0.0012;
      }

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Mouse influence on origin
      const tiltX = (mouseX / (width * 0.5)) * 14;
      const tiltY = (mouseY / (height * 0.5)) * 10;
      const originX = cx + tiltX;
      const originY = cy + tiltY;

      ctx.save();
      ctx.translate(originX, originY);

      // Central core luminous glow
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
      coreGrad.addColorStop(0, "rgba(153, 69, 255, 0.3)");
      coreGrad.addColorStop(0.5, "rgba(20, 241, 149, 0.15)");
      coreGrad.addColorStop(1, "rgba(153, 69, 255, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.fill();

      // Core center circle with Solana purple
      ctx.fillStyle = "#9945ff";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(20, 241, 149, 0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("xS", 0, 0);

      // Render concentric orbital tracks
      const tracks = [130, 190, 250, 310, 360, 410];
      tracks.forEach((dist, idx) => {
        ctx.beginPath();
        ctx.ellipse(0, 0, dist, dist * Math.cos(currentRotX), currentRotY, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(153, 69, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Traveling photon pulse on track
        if (!reducedMotion) {
          const pulseAngle = (time * (0.8 / (idx + 1)) + idx * 1.5) % (Math.PI * 2);
          const px = Math.cos(pulseAngle + currentRotY) * dist;
          const py = Math.sin(pulseAngle + currentRotY) * dist * Math.cos(currentRotX);

          ctx.fillStyle = idx % 2 === 0 ? "rgba(20, 241, 149, 0.75)" : "rgba(153, 69, 255, 0.75)";
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Render nodes
      let hovered: string | null = null;

      NODES.forEach((node, i) => {
        if (!reducedMotion) {
          angles[i] += node.speed;
        }
        const a = angles[i] + currentRotY;
        const rx = Math.cos(a) * node.distance;
        const ry = Math.sin(a) * node.distance * Math.cos(currentRotX);

        // Perspective scaling
        const z = Math.sin(a) * Math.sin(currentRotX);
        const scale = 1 + z * 0.24;
        const nodeRadius = (node.size / 2) * scale;

        // Check hover
        const distToMouse = Math.hypot(originX + rx - (cx + mouseX), originY + ry - (cy + mouseY));
        const isHover = distToMouse < nodeRadius + 16;
        if (isHover) hovered = node.symbol;

        // Draw connecting ray to core
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = isHover ? "rgba(153, 69, 255, 0.5)" : "rgba(153, 69, 255, 0.08)";
        ctx.lineWidth = isHover ? 1.5 : 1;
        ctx.stroke();

        // Node brand glow
        const glow = ctx.createRadialGradient(rx, ry, nodeRadius * 0.6, rx, ry, nodeRadius * 2.2);
        glow.addColorStop(0, node.color + (isHover ? "55" : "25"));
        glow.addColorStop(1, node.color + "00");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(rx, ry, nodeRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Node background circle
        ctx.fillStyle = isHover ? "#9945ff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(rx, ry, nodeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Brand color border ring
        ctx.strokeStyle = isHover ? "#14f195" : node.color;
        ctx.lineWidth = isHover ? 2 : 1.5;
        ctx.stroke();

        // Symbol label
        ctx.fillStyle = isHover ? "#ffffff" : "#18223c";
        ctx.font = `600 ${Math.max(9, Math.floor(10.5 * scale))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.symbol.replace("x", ""), rx, ry);

        // Company tag above node
        if (isHover || scale > 1.08) {
          const tagText = `${node.name} · ${node.symbol}`;
          ctx.font = "bold 9px monospace";
          const tw = ctx.measureText(tagText).width;

          ctx.fillStyle = isHover ? "#161321" : "rgba(255, 255, 255, 0.95)";
          ctx.beginPath();
          ctx.roundRect(rx - tw / 2 - 6, ry - nodeRadius - 18, tw + 12, 14, 4);
          ctx.fill();

          ctx.strokeStyle = isHover ? "#14f195" : "rgba(153, 69, 255, 0.25)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isHover ? "#14f195" : "#18223c";
          ctx.fillText(tagText, rx, ry - nodeRadius - 11);
        }
      });

      ctx.restore();

      setActiveNode(hovered);

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
  }, []);

  return (
    <div className="os-orbit-stage" aria-label="Interactive market orbit visualization">
      <div className="os-orbit-info">
        <span className="os-micro os-micro-blue">Interactive Liquidity Constellation</span>
        <span className="os-orbit-hint">Drag to rotate orbital plane · Hover nodes to inspect liquidity</span>
        {activeNode ? <span className="os-orbit-active">Selected: {activeNode}</span> : null}
      </div>
      <canvas ref={canvasRef} className="os-orbit-canvas" />
    </div>
  );
}
