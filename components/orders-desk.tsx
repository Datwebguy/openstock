"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StockLogo } from "@/components/stock-logo";
import { shortWallet, useWallet } from "@/components/wallet-session";

type TabMode = "active" | "history" | "paper";

interface AutomatedOrder {
  id: string;
  symbol: string;
  name?: string;
  kind: "limit" | "dca" | "stop" | "oco";
  side: "buy" | "sell";
  shares: number;
  trigger?: number;
  targetPrice?: number;
  cadence?: string;
  rounds?: number;
  wallet?: string;
  createdAt: string;
  status: "active" | "cancelled" | "filled";
}

interface TradeReceipt {
  id: string;
  mode: "live" | "review";
  status: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  uiAmount: number;
  multiplier: number;
  referencePrice: number;
  signature: string | null;
  route: string;
  createdAt: string;
  wallet?: string;
}

export function OrdersDesk() {
  const { address: wallet, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<TabMode>("active");
  const [orders, setOrders] = useState<AutomatedOrder[]>([]);
  const [receipts, setReceipts] = useState<TradeReceipt[]>([]);
  const [paperReviews, setPaperReviews] = useState<TradeReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      // 1. Load active automated orders from localStorage
      const savedOrders = JSON.parse(localStorage.getItem("openstock:automation-orders") ?? "[]") as AutomatedOrder[];
      setOrders(Array.isArray(savedOrders) ? savedOrders.filter((o) => o.status !== "cancelled") : []);

      // 2. Load trade receipts from localStorage keys
      const loadedLive: TradeReceipt[] = [];
      const loadedPaper: TradeReceipt[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("openstock:review:")) {
          try {
            const item = JSON.parse(localStorage.getItem(key) ?? "{}") as TradeReceipt;
            if (item.id && item.symbol) {
              if (item.mode === "live" || item.signature) {
                loadedLive.push(item);
              } else {
                loadedPaper.push(item);
              }
            }
          } catch {
            // skip unreadable
          }
        }
      }

      // Sort newest first
      loadedLive.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      loadedPaper.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setReceipts(loadedLive);
      setPaperReviews(loadedPaper);
    } catch {
      setOrders([]);
      setReceipts([]);
      setPaperReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function cancelOrder(id: string) {
    try {
      const updated = orders.map((o) => (o.id === id ? { ...o, status: "cancelled" as const } : o));
      localStorage.setItem("openstock:automation-orders", JSON.stringify(updated));
      setOrders(updated.filter((o) => o.status !== "cancelled"));
      setMessage("Order cancelled successfully.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Failed to cancel order.");
    }
  }

  return (
    <div className="container app-page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <header className="workspace-heading" style={{ marginBottom: 24 }}>
        <div className="workspace-heading__body">
          <div className="workspace-kicker">
            <span className="live-dot" aria-hidden="true" />
            <span>Non-Custodial Order Management · Solana Mainnet</span>
          </div>
          <h1>Orders &amp; Automations</h1>
          <p>
            Real-time monitor for active limit orders, recurring DCA schedules, and verifiable on-chain trade receipts.
          </p>
        </div>
        <div className="workspace-heading__actions">
          <Link className="button button--gradient" href="/app">
            + New Trade Order
          </Link>
          <Link className="workspace-pill-link workspace-pill-link--secondary" href="/app/portfolio">
            View Portfolio ↗
          </Link>
        </div>
      </header>

      {message && (
        <div style={{ padding: "12px 18px", borderRadius: 12, background: "rgba(20, 241, 149, 0.12)", border: "1px solid rgba(20, 241, 149, 0.3)", color: "#0a8754", fontWeight: 700, marginBottom: 20 }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--line, rgba(0,0,0,0.08))", marginBottom: 24, overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          style={{
            padding: "10px 18px",
            border: 0,
            background: "transparent",
            borderBottom: activeTab === "active" ? "2px solid var(--solana-purple, #9945ff)" : "2px solid transparent",
            color: activeTab === "active" ? "var(--ink, #161321)" : "var(--muted, #666)",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Active Orders &amp; Rules ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            padding: "10px 18px",
            border: 0,
            background: "transparent",
            borderBottom: activeTab === "history" ? "2px solid var(--solana-purple, #9945ff)" : "2px solid transparent",
            color: activeTab === "history" ? "var(--ink, #161321)" : "var(--muted, #666)",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Executed Receipts ({receipts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("paper")}
          style={{
            padding: "10px 18px",
            border: 0,
            background: "transparent",
            borderBottom: activeTab === "paper" ? "2px solid var(--solana-purple, #9945ff)" : "2px solid transparent",
            color: activeTab === "paper" ? "var(--ink, #161321)" : "var(--muted, #666)",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Paper Reviews ({paperReviews.length})
        </button>
      </div>

      {/* Tab 1: Active Orders */}
      {activeTab === "active" && (
        <section>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>Checking active orders...</div>
          ) : orders.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {orders.map((order) => {
                const isLimit = order.kind === "limit";
                const isDca = order.kind === "dca";
                return (
                  <div
                    key={order.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "18px 22px",
                      borderRadius: 18,
                      border: "1px solid var(--line, rgba(0,0,0,0.08))",
                      background: "var(--surface, #ffffff)",
                      boxShadow: "0 4px 18px rgba(0,0,0,0.03)",
                      flexWrap: "wrap",
                      gap: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <StockLogo symbol={order.symbol} size={42} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong style={{ fontSize: 16 }}>{order.symbol}</strong>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: isLimit ? "rgba(153, 69, 255, 0.14)" : "rgba(20, 241, 149, 0.15)",
                              color: isLimit ? "var(--solana-purple, #9945ff)" : "#0db36f",
                              textTransform: "uppercase",
                            }}
                          >
                            {order.kind.toUpperCase()} {order.side.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            • {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                          {isLimit
                            ? `Wake condition: ${order.side === "buy" ? "Price ≤" : "Price ≥"} $${order.targetPrice?.toFixed(2) ?? "—"} • Size: ${order.shares} shares`
                            : isDca
                            ? `Accumulate: ${order.shares} shares every ${order.cadence ?? "week"} (${order.rounds ?? 4} rounds)`
                            : `Size: ${order.shares} shares`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#0db36f" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#14f195" }} />
                        Active Monitoring
                      </span>
                      <button
                        type="button"
                        onClick={() => cancelOrder(order.id)}
                        className="button button--light"
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 56, textAlign: "center", background: "var(--surface, #fff)", borderRadius: 20, border: "1px solid var(--line, rgba(0,0,0,0.08))" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No Active Automated Orders</h3>
              <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 20px", fontSize: 13, lineHeight: 1.6 }}>
                Set a target Limit Order or recurring DCA accumulation schedule directly from any stock terminal to trade without staying glued to the screen.
              </p>
              <Link href="/app" className="button button--gradient" style={{ padding: "10px 24px", fontSize: 13 }}>
                Explore the stocks desk
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Executed Receipts */}
      {activeTab === "history" && (
        <section>
          {receipts.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {receipts.map((rcpt) => (
                <div
                  key={rcpt.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "18px 22px",
                    borderRadius: 18,
                    border: "1px solid var(--line, rgba(0,0,0,0.08))",
                    background: "var(--surface, #ffffff)",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.03)",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <StockLogo symbol={rcpt.symbol} size={42} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 16 }}>{rcpt.symbol}</strong>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: rcpt.side === "buy" ? "rgba(20, 241, 149, 0.15)" : "rgba(244, 63, 94, 0.15)",
                            color: rcpt.side === "buy" ? "#0db36f" : "#e11d48",
                            textTransform: "uppercase",
                          }}
                        >
                          {rcpt.side.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {new Date(rcpt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {rcpt.uiAmount} shares @ ${rcpt.referencePrice.toFixed(2)} • Total: ${(rcpt.uiAmount * rcpt.referencePrice).toFixed(2)} USDC
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {rcpt.signature ? (
                      <a
                        href={`https://solscan.io/tx/${rcpt.signature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--light"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                      >
                        Solscan ↗
                      </a>
                    ) : null}
                    <Link
                      href={`/app/receipt/${rcpt.id}`}
                      className="button button--gradient"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                    >
                      View Receipt ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 56, textAlign: "center", background: "var(--surface, #fff)", borderRadius: 20, border: "1px solid var(--line, rgba(0,0,0,0.08))" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No Executed Trades Yet</h3>
              <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 20px", fontSize: 13, lineHeight: 1.6 }}>
                Completed trades generate cryptographic on-chain receipts with full proof of reserves, oracle benchmark consensus, and Solscan transaction links.
              </p>
              <Link href="/app" className="button button--gradient" style={{ padding: "10px 24px", fontSize: 13 }}>
                Trade Now
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Paper Reviews */}
      {activeTab === "paper" && (
        <section>
          {paperReviews.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {paperReviews.map((rcpt) => (
                <div
                  key={rcpt.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "18px 22px",
                    borderRadius: 18,
                    border: "1px solid var(--line, rgba(0,0,0,0.08))",
                    background: "var(--surface, #ffffff)",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.03)",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <StockLogo symbol={rcpt.symbol} size={42} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 16 }}>{rcpt.symbol}</strong>
                        <span style={{ fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)", color: "var(--muted)" }}>
                          PAPER REVIEW
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {new Date(rcpt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {rcpt.uiAmount} shares @ ${rcpt.referencePrice.toFixed(2)} • Risk-free review
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Link
                      href={`/app/receipt/${rcpt.id}`}
                      className="button button--light"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                    >
                      Inspect Review
                    </Link>
                    <Link
                      href={`/app/asset/${rcpt.symbol}`}
                      className="button button--gradient"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                    >
                      Trade Live ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 56, textAlign: "center", background: "var(--surface, #fff)", borderRadius: 20, border: "1px solid var(--line, rgba(0,0,0,0.08))" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No Paper Reviews Saved</h3>
              <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 20px", fontSize: 13, lineHeight: 1.6 }}>
                You can generate paper reviews without connecting a wallet to stress-test your strategy against live Pyth and Meteora data.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
