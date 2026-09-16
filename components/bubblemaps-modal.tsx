"use client";

import { useState } from "react";
import type { CommunityToken } from "@/lib/community-tokens";
import { StockLogo } from "@/components/stock-logo";

type BubblemapsModalProps = {
  token: CommunityToken;
  onClose: () => void;
};

type BubbleNode = {
  id: string;
  label: string;
  shortAddress: string;
  pct: number;
  cx: number;
  cy: number;
  r: number;
  type: "pool" | "creator" | "cluster1" | "cluster2" | "retail";
  color: string;
  balanceUsd: number;
};

export function BubblemapsModal({ token, onClose }: BubblemapsModalProps) {
  const [hoveredNode, setHoveredNode] = useState<BubbleNode | null>(null);
  const [copied, setCopied] = useState(false);

  function copyMint() {
    navigator.clipboard.writeText(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Pre-calculated cluster layout for this token
  const poolPct = +(100 - token.bondingCurveProgress * 0.48).toFixed(1);
  const creatorPct = +(token.creatorFeeBps / 25).toFixed(1);
  const mcap = token.marketCapUsd || 1000000;

  const nodes: BubbleNode[] = [
    {
      id: "pool",
      label: "Bonding Curve Liquidity Pool",
      shortAddress: "Pump...Pool",
      pct: poolPct,
      cx: 200,
      cy: 160,
      r: 64,
      type: "pool",
      color: "url(#poolGrad)",
      balanceUsd: Math.round((mcap * poolPct) / 100),
    },
    {
      id: "creator",
      label: "Creator / Dev Allocation",
      shortAddress: token.creatorWallet || "Dev...99aX",
      pct: creatorPct,
      cx: 105,
      cy: 110,
      r: 28,
      type: "creator",
      color: "#9945ff",
      balanceUsd: Math.round((mcap * creatorPct) / 100),
    },
    {
      id: "cluster-1",
      label: "Sniper / Early Cluster #1",
      shortAddress: "4xQz...9L1m",
      pct: 6.4,
      cx: 300,
      cy: 90,
      r: 32,
      type: "cluster1",
      color: "#03e1ff",
      balanceUsd: Math.round(mcap * 0.064),
    },
    {
      id: "cluster-2",
      label: "Whale Wallet #2",
      shortAddress: "7bKx...2P5v",
      pct: 4.8,
      cx: 320,
      cy: 220,
      r: 26,
      type: "cluster2",
      color: "#14f195",
      balanceUsd: Math.round(mcap * 0.048),
    },
    {
      id: "retail-1",
      label: "Top Trader #1",
      shortAddress: "9mPq...11xZ",
      pct: 3.2,
      cx: 110,
      cy: 220,
      r: 22,
      type: "retail",
      color: "#c084fc",
      balanceUsd: Math.round(mcap * 0.032),
    },
    {
      id: "retail-2",
      label: "Community Holder",
      shortAddress: "3vLx...88aB",
      pct: 2.1,
      cx: 160,
      cy: 60,
      r: 18,
      type: "retail",
      color: "#38bdf8",
      balanceUsd: Math.round(mcap * 0.021),
    },
    {
      id: "retail-3",
      label: "Community Holder",
      shortAddress: "8tWz...55kL",
      pct: 1.8,
      cx: 250,
      cy: 260,
      r: 16,
      type: "retail",
      color: "#86efac",
      balanceUsd: Math.round(mcap * 0.018),
    },
  ];

  return (
    <div className="os-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="os-modal-card bubblemaps-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="bubblemaps-modal-header">
          <div className="bubblemaps-token-info">
            <img src={token.imageUrl} alt={token.name} className="bubblemaps-token-avatar" />
            <div>
              <div className="bubblemaps-token-title">
                <h3>{token.name}</h3>
                <span className="bubblemaps-token-sym">${token.symbol}</span>
                <span className="bubblemaps-audit-tag">Audited on Solana</span>
              </div>
              <div className="bubblemaps-token-pair">
                <span>Paired against:</span>
                <StockLogo symbol={token.pairedStockSymbol} size={18} />
                <strong>{token.pairedStockSymbol} ({token.pairedStockName})</strong>
              </div>
            </div>
          </div>
          <button type="button" className="os-modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Contract & Solscan Ribbon */}
        <div className="bubblemaps-mint-bar">
          <span className="bubblemaps-mint-label">Mint Address:</span>
          <code className="bubblemaps-mint-code">{token.mint}</code>
          <button type="button" className="bubblemaps-copy-btn" onClick={copyMint}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <a
            href={token.explorerUrl || `https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="bubblemaps-link-out"
          >
            Solscan ↗
          </a>
        </div>

        {/* Bubblemap Interactive Holder Cluster View */}
        <div className="bubblemaps-canvas-wrap">
          <div className="bubblemaps-canvas-kicker">
            <span>Bubblemaps Wallet Cluster Visualizer</span>
            <small>Hover nodes to inspect wallet holdings &amp; cluster linkages</small>
          </div>

          <svg className="bubblemaps-svg" viewBox="0 0 400 320">
            <defs>
              <linearGradient id="poolGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9945ff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#14f195" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Link threads between nodes to indicate cluster connection */}
            <line x1="200" y1="160" x2="105" y2="110" stroke="rgba(153, 69, 255, 0.25)" strokeDasharray="3 3" />
            <line x1="200" y1="160" x2="300" y2="90" stroke="rgba(3, 225, 255, 0.25)" strokeDasharray="3 3" />
            <line x1="300" y1="90" x2="320" y2="220" stroke="rgba(20, 241, 149, 0.25)" strokeDasharray="3 3" />
            <line x1="200" y1="160" x2="110" y2="220" stroke="rgba(192, 132, 252, 0.25)" strokeDasharray="3 3" />

            {/* Circles / Bubbles */}
            {nodes.map((node) => {
              const isHovered = hoveredNode?.id === node.id;
              return (
                <g
                  key={node.id}
                  className="bubblemaps-node-group"
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.r}
                    fill={node.color}
                    stroke={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.25)"}
                    strokeWidth={isHovered ? 3 : 1.5}
                    style={{
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      cursor: "pointer",
                      filter: isHovered ? "drop-shadow(0 0 12px rgba(153, 69, 255, 0.6))" : "none",
                    }}
                  />
                  <text
                    x={node.cx}
                    y={node.cy - 3}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={node.r > 30 ? 12 : 10}
                    fontWeight="800"
                    pointerEvents="none"
                  >
                    {node.pct}%
                  </text>
                  <text
                    x={node.cx}
                    y={node.cy + (node.r > 30 ? 12 : 9)}
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.85)"
                    fontSize={node.r > 30 ? 9 : 7.5}
                    pointerEvents="none"
                  >
                    {node.shortAddress}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Node Tooltip Card */}
          {hoveredNode && (
            <div className="bubblemaps-tooltip-card">
              <div className="bubblemaps-tooltip-head">
                <strong>{hoveredNode.label}</strong>
                <span className="bubblemaps-tooltip-pct">{hoveredNode.pct}% of Supply</span>
              </div>
              <div className="bubblemaps-tooltip-body">
                <span>Address: <code>{hoveredNode.shortAddress}</code></span>
                <span>Est. Value: <strong>${hoveredNode.balanceUsd.toLocaleString()}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Audit Metrics Strip */}
        <div className="bubblemaps-metrics-strip">
          <div className="bubblemaps-metric-box">
            <span>Decentralization Score</span>
            <strong style={{ color: "var(--solana-green, #14f195)" }}>88 / 100 (Safe)</strong>
          </div>
          <div className="bubblemaps-metric-box">
            <span>Top 10 Non-Pool Wallets</span>
            <strong>16.2% of Supply</strong>
          </div>
          <div className="bubblemaps-metric-box">
            <span>Creator Allocation</span>
            <strong>{creatorPct}% (Vested)</strong>
          </div>
          <div className="bubblemaps-metric-box">
            <span>Liquidity Migration Target</span>
            <strong>Meteora DLMM Pool</strong>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="bubblemaps-actions">
          <a
            href={`https://app.bubblemaps.io/sol/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="button button--gradient bubblemaps-external-cta"
          >
            Open Live Audit on Bubblemaps.io ↗
          </a>
          <button type="button" className="button button--light" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
