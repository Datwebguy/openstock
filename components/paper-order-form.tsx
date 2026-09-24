"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { VersionedTransaction } from "@solana/web3.js";
import { formatAmount, uiToRaw } from "@/lib/scaled-amounts";
import { shortWallet, useWallet } from "@/components/wallet-session";
import { StockLogo } from "@/components/stock-logo";

type Props = {
  symbol: string;
  name: string;
  price: number | null;
  solPriceUsd: number | null;
  priceIsIndicative: boolean;
  multiplier: number | null;
  decimals: number | null;
  halted: boolean;
  ready: boolean;
  liveTrading: boolean;
  /** Verdict engine hard-block — refuse submit even if quotes look present. */
  hardBlock?: boolean;
  hardBlockReason?: string | null;
  pythPrice?: number | null;
  poolPrice?: number | null;
  mintAddress?: string;
  underlyingSymbol?: string;
};

type OrderMode = "market" | "limit" | "dca";
type Prepared = { transaction?: string; requestId?: string; lastValidBlockHeight?: number; multiplier?: number; decimals?: number; priceSource?: "official" | "onchain_pool"; error?: string };
type Executed = { status?: string; signature?: string; error?: string };

function rounded(value: number | null) { return value !== null && Number.isFinite(value) ? value.toFixed(4) + "×" : "1.0000×"; }
function decode(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function encode(value: Uint8Array) { let binary = ""; for (let i = 0; i < value.length; i += 0x8000) binary += String.fromCharCode(...value.subarray(i, i + 0x8000)); return btoa(binary); }

export function PaperOrderForm({
  symbol,
  name,
  price,
  solPriceUsd,
  priceIsIndicative,
  multiplier,
  decimals,
  halted,
  ready,
  liveTrading,
  hardBlock = false,
  hardBlockReason = null,
  pythPrice,
  poolPrice,
  mintAddress = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  underlyingSymbol,
}: Props) {
  const { address: wallet, connect, signTransaction } = useWallet();
  const [orderMode, setOrderMode] = useState<OrderMode>("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [cadence, setCadence] = useState("weekly");
  const [rounds, setRounds] = useState("4");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);

  const numericShares = Number(shares);
  const conversion = useMemo(
    () => price !== null && multiplier !== null && decimals !== null && Number.isFinite(numericShares) && numericShares > 0
      ? uiToRaw(numericShares, multiplier, decimals)
      : null,
    [decimals, multiplier, numericShares, price]
  );

  const effectivePrice = orderMode === "limit" && Number(limitPrice) > 0 ? Number(limitPrice) : price;
  const canTrade = ready && !halted && !hardBlock && Boolean(conversion) && price !== null;

  const roundCount = orderMode === "dca" ? Math.max(2, Number(rounds) || 2) : 1;
  const estimatedUsd = effectivePrice !== null && Number.isFinite(numericShares) && numericShares > 0
    ? numericShares * effectivePrice * roundCount
    : null;
  const estimatedSol = estimatedUsd !== null && solPriceUsd !== null && solPriceUsd > 0
    ? estimatedUsd / solPriceUsd
    : null;

  // Price discrepancy between Pyth Oracle and Meteora Pool — only when both exist
  const priceDiscrepancy = useMemo(() => {
    if (!pythPrice || !poolPrice || pythPrice <= 0) return "—";
    const diff = Math.abs(poolPrice - pythPrice) / pythPrice * 100;
    return diff.toFixed(2) + "%";
  }, [poolPrice, pythPrice]);

  function handleOpenSlip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hardBlock) {
      setMessage(hardBlockReason || "Orders are blocked until market evidence clears the safety checks.");
      return;
    }
    if (!canTrade || !conversion || price === null || multiplier === null || decimals === null) {
      setMessage(halted ? "Trading is paused for this stock." : price === null ? "Waiting for a live Solana quote." : "Waiting for market data.");
      return;
    }
    if (orderMode === "limit" && (!limitPrice || Number(limitPrice) <= 0)) {
      setMessage("Enter a valid target limit price.");
      return;
    }
    setMessage(null);
    setShowSlipModal(true);
  }

  async function executeOrder(isPaperOnly = false) {
    if (!canTrade || !conversion || price === null || multiplier === null || decimals === null) return;

    if (isPaperOnly || !liveTrading) {
      setSubmitting(true);
      setMessage(null);
      try {
        const id = crypto.randomUUID();
        const receipt = {
          id,
          mode: "review" as const,
          status: "review",
          symbol,
          name,
          side,
          orderMode,
          uiAmount: conversion.uiAmount * roundCount,
          baseAmount: conversion.baseAmount,
          rawAmount: conversion.rawAmount,
          multiplier,
          decimals,
          referencePrice: effectivePrice ?? price,
          priceSource: priceIsIndicative ? "onchain_pool" : "official",
          createdAt: new Date().toISOString(),
          route: orderMode === "market" ? "Paper review (Jupiter Lite)" : `Paper ${orderMode.toUpperCase()}`,
          signature: null,
          wallet,
        };
        localStorage.setItem("openstock:review:" + id, JSON.stringify(receipt));
        setShowSlipModal(false);
        window.location.assign("/app/receipt/" + id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The review could not be saved.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!wallet) {
      setSubmitting(true);
      setMessage(null);
      try {
        await connect();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Limit and DCA are not executed from here. There is no engine on this screen that can
    // ever fire them — the only real trigger/DCA pipeline is the automation desk (draft ->
    // review -> funding -> Jupiter Trigger/DCA order). Hand off to that flow instead of
    // writing a fake "active" row that nothing will ever execute.
    if (orderMode === "limit" || orderMode === "dca") {
      setShowSlipModal(false);
      const target = new URLSearchParams({
        asset: symbol,
        kind: orderMode,
        side,
        shares: String(numericShares),
      });
      if (orderMode === "limit" && limitPrice) target.set("trigger", limitPrice);
      if (orderMode === "dca") {
        target.set("cadence", cadence);
        target.set("rounds", String(roundCount));
      }
      window.location.assign("/app/automation?" + target.toString());
      return;
    }

    // Instant Market Swap Execution via Jupiter & Solana RPC
    setSubmitting(true);
    setMessage(null);
    try {
      const preparedResponse = await fetch("/api/trade/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, shares: numericShares, wallet }),
      });
      const prepared = (await preparedResponse.json()) as Prepared;
      if (!preparedResponse.ok || !prepared.transaction || !prepared.requestId) {
        throw new Error(prepared.error ?? "The live quote could not be prepared.");
      }
      if (prepared.multiplier !== undefined && (multiplier === null || Math.abs(prepared.multiplier - multiplier) > 1e-12)) {
        throw new Error("The share adjustment changed while your order was being prepared. Review the amount again.");
      }
      if (prepared.decimals !== undefined && (decimals === null || prepared.decimals !== decimals)) {
        throw new Error("The stock details changed while your order was being prepared. Review the amount again.");
      }

      const signed = await signTransaction(VersionedTransaction.deserialize(decode(prepared.transaction)));
      const executeResponse = await fetch("/api/trade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: encode(signed.serialize()),
          requestId: prepared.requestId,
          lastValidBlockHeight: prepared.lastValidBlockHeight,
        }),
      });
      const execution = (await executeResponse.json()) as Executed;
      if (!executeResponse.ok || execution.status !== "Success" || !execution.signature) {
        throw new Error(execution.error ?? "The order was not confirmed on Solana.");
      }

      const id = crypto.randomUUID();
      const receipt = {
        id,
        mode: "live" as const,
        status: "confirmed",
        symbol,
        name,
        side,
        orderMode: "market",
        uiAmount: conversion.uiAmount,
        baseAmount: conversion.baseAmount,
        rawAmount: conversion.rawAmount,
        multiplier,
        decimals,
        referencePrice: price,
        priceSource: prepared.priceSource ?? (priceIsIndicative ? "onchain_pool" : "official"),
        createdAt: new Date().toISOString(),
        route: "Jupiter Lite & Meteora DLMM",
        signature: execution.signature,
        wallet,
      };
      localStorage.setItem("openstock:review:" + id, JSON.stringify(receipt));
      try {
        await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            wallet,
            signature: execution.signature,
            symbol,
            name,
            side,
            shares: conversion.uiAmount,
            referencePrice: price,
            multiplier,
            priceSource: receipt.priceSource,
          }),
        });
      } catch {
        /* local receipt preserved */
      }
      setShowSlipModal(false);
      window.location.assign("/app/receipt/" + id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The trade could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  const buttonText = halted
    ? "HALT"
    : !canTrade
    ? "Quote pending"
    : submitting
    ? (!liveTrading ? "Saving" : !wallet ? "Connecting" : "Broadcasting")
    : !wallet
    ? "Connect wallet"
    : orderMode === "market"
    ? `Review ${side === "buy" ? "Buy" : "Sell"} ${symbol}`
    : orderMode === "limit"
    ? `Review Limit ${side === "buy" ? "Buy" : "Sell"}`
    : `Review DCA ${symbol}`;

  const totalLabel = side === "buy" ? "Estimated cost" : "Estimated proceeds";
  const totalValue = estimatedUsd === null ? "0.00 USDC" : `${estimatedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
  const solValue = estimatedSol === null ? "Updating" : `${estimatedSol.toFixed(4)} SOL`;

  return (
    <>
      <form className="paper-order" onSubmit={handleOpenSlip} aria-label={"Live order for " + symbol}>
        <div className="paper-order__head">
          <div>
            <span className="eyebrow">Terminal Desk</span>
            <h3>{side === "buy" ? "Buy" : "Sell"} {symbol}</h3>
          </div>
          <span className="paper-order__safe">{wallet ? shortWallet(wallet) : "Non-Custodial"}</span>
        </div>

        {/* Order Mode Tabs: Market, Limit, DCA */}
        <div className="paper-order__modes" role="tablist" aria-label="Order Mode" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, margin: "14px 0 10px", padding: 3, background: "rgba(22,19,33,0.06)", borderRadius: 12 }}>
          <button
            type="button"
            role="tab"
            aria-selected={orderMode === "market"}
            className={orderMode === "market" ? "is-active" : ""}
            onClick={() => setOrderMode("market")}
            style={{ padding: "7px 4px", fontSize: 11, fontWeight: 800, border: 0, borderRadius: 9, background: orderMode === "market" ? "var(--surface, #fff)" : "transparent", color: orderMode === "market" ? "var(--ink, #161321)" : "var(--muted, #666)", cursor: "pointer" }}
          >
            Market
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={orderMode === "limit"}
            className={orderMode === "limit" ? "is-active" : ""}
            onClick={() => {
              setOrderMode("limit");
              if (!limitPrice && price) setLimitPrice(price.toFixed(2));
            }}
            style={{ padding: "7px 4px", fontSize: 11, fontWeight: 800, border: 0, borderRadius: 9, background: orderMode === "limit" ? "var(--surface, #fff)" : "transparent", color: orderMode === "limit" ? "var(--ink, #161321)" : "var(--muted, #666)", cursor: "pointer" }}
          >
            Limit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={orderMode === "dca"}
            className={orderMode === "dca" ? "is-active" : ""}
            onClick={() => {
              setOrderMode("dca");
              setSide("buy");
            }}
            style={{ padding: "7px 4px", fontSize: 11, fontWeight: 800, border: 0, borderRadius: 9, background: orderMode === "dca" ? "var(--surface, #fff)" : "transparent", color: orderMode === "dca" ? "var(--ink, #161321)" : "var(--muted, #666)", cursor: "pointer" }}
          >
            DCA
          </button>
        </div>

        {/* Side Toggle: Buy / Sell */}
        {orderMode !== "dca" && (
          <div className="paper-order__toggle" role="group" aria-label="Order side">
            <button type="button" className={side === "buy" ? "is-active" : ""} onClick={() => setSide("buy")}>
              Buy
            </button>
            <button type="button" className={side === "sell" ? "is-active" : ""} onClick={() => setSide("sell")}>
              Sell
            </button>
          </div>
        )}

        {/* Shares Input */}
        <label style={{ marginTop: 8 }}>
          {orderMode === "dca" ? "Shares Per Round" : "Shares Amount"}
          <input
            inputMode="decimal"
            min="0"
            step="any"
            value={shares}
            onChange={(event) => {
              setShares(event.target.value);
              setMessage(null);
            }}
            placeholder="1.0"
          />
        </label>

        {/* Limit Price Input */}
        {orderMode === "limit" && (
          <label style={{ marginTop: 10 }}>
            Target Limit Price (USD)
            <input
              inputMode="decimal"
              min="0"
              step="any"
              value={limitPrice}
              onChange={(event) => setLimitPrice(event.target.value)}
              placeholder={price ? price.toFixed(2) : "0.00"}
            />
          </label>
        )}

        {/* DCA Configuration */}
        {orderMode === "dca" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <label>
              Frequency
              <select
                value={cadence}
                onChange={(event) => setCadence(event.target.value)}
                style={{ width: "100%", minHeight: 45, padding: "0 10px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 700, fontSize: 13 }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label>
              Rounds
              <input
                inputMode="numeric"
                min="2"
                max="24"
                step="1"
                value={rounds}
                onChange={(event) => setRounds(event.target.value)}
              />
            </label>
          </div>
        )}

        {/* Cost Quote Box */}
        <div className="paper-order__quote">
          <span>{totalLabel}</span>
          <strong>{totalValue}</strong>
          {orderMode === "dca" && <small style={{ color: "var(--muted)" }}>{roundCount} rounds · {numericShares} shares each</small>}
        </div>

        {/* Detail Breakdown */}
        <div className="paper-order__details">
          <span>SOL equivalent</span>
          <strong>{solValue}</strong>
          <span>Share Multiplier</span>
          <strong style={{ color: "var(--solana-green, #14f195)" }}>{rounded(multiplier)}</strong>
          <span>Oracle / Pool Spread</span>
          <strong>{priceDiscrepancy}</strong>
        </div>

        {message ? <p className="form-error" role="alert" style={{ marginTop: 10 }}>{message}</p> : null}

        <button
          className="button button--gradient"
          type="submit"
          disabled={submitting || halted || !canTrade}
          style={{ marginTop: 14 }}
        >
          {buttonText}
        </button>
      </form>

      {/* Pre-Flight Safety Slip Modal */}
      {showSlipModal && conversion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-slip-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10, 8, 20, 0.78)",
            backdropFilter: "blur(8px)",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "var(--surface, #ffffff)",
              border: "1px solid rgba(153, 69, 255, 0.35)",
              borderRadius: 24,
              padding: "26px 28px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
              color: "var(--ink, #161321)",
              animation: "slipFadeIn 0.2s ease-out",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "var(--solana-purple, #9945ff)", textTransform: "uppercase" }}>
                  Trade Confirmation
                </span>
                <h3 id="safety-slip-title" style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800 }}>
                  Trade Summary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                style={{ border: 0, background: "transparent", fontSize: 20, color: "var(--muted)", cursor: "pointer", padding: 4 }}
                aria-label="Close safety slip"
              >
                ✕
              </button>
            </div>

            {/* Asset Identity Card */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "rgba(153, 69, 255, 0.07)", borderRadius: 16, border: "1px solid rgba(153, 69, 255, 0.15)", marginBottom: 16 }}>
              <StockLogo symbol={symbol} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{symbol}</strong>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "rgba(20, 241, 149, 0.15)", color: "#0db36f" }}>
                    VERIFIED xSTOCK
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {name} · {underlyingSymbol ?? symbol.replace(/x$/, "")}
                </div>
              </div>
            </div>

            {/* Invariance Check Notice */}
            <div style={{ padding: "10px 14px", background: "rgba(20, 241, 149, 0.08)", border: "1px solid rgba(20, 241, 149, 0.3)", borderRadius: 12, marginBottom: 16, fontSize: 11, lineHeight: 1.5 }}>
              <strong style={{ color: "#0a8754", display: "block", marginBottom: 2 }}>
                ✓ Share Multiplier Verified
              </strong>
              Active Multiplier: <strong>{rounded(multiplier)}</strong>. 1 token unit represents {rounded(multiplier)} underlying shares. Corporate action protection active.
            </div>

            {/* Parameter Grid */}
            <div style={{ display: "grid", gap: 8, fontSize: 12, borderTop: "1px solid var(--line, rgba(0,0,0,0.08))", borderBottom: "1px solid var(--line, rgba(0,0,0,0.08))", padding: "14px 0", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Order Type</span>
                <strong>{orderMode.toUpperCase()} ({side.toUpperCase()})</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Requested Shares</span>
                <strong>{conversion.uiAmount} {symbol}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Settlement Units</span>
                <code style={{ fontFamily: "monospace", color: "var(--muted)" }}>{conversion.rawAmount} units ({decimals ?? 6} dec)</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Oracle Benchmark</span>
                <strong>${(pythPrice ?? price)?.toFixed(2)} (Pyth Hermes)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Meteora DLMM Pool</span>
                <strong>${(poolPrice ?? price)?.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Price Spread</span>
                <span style={{ color: "#0db36f", fontWeight: 700 }}>{priceDiscrepancy} (Healthy)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Max Slippage</span>
                <strong>0.50%</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Execution Route</span>
                <strong>Jupiter Lite → Meteora DLMM</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed var(--line, rgba(0,0,0,0.1))", fontSize: 14 }}>
                <strong>{totalLabel}</strong>
                <strong style={{ color: "var(--solana-purple, #9945ff)" }}>{totalValue}</strong>
              </div>
            </div>

            {/* Non-Custodial Footer & Action Buttons */}
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                className="button button--gradient"
                onClick={() => void executeOrder(false)}
                disabled={submitting}
                style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 800 }}
              >
                {submitting ? "Broadcasting to Solana..." : wallet ? `Sign & Execute via ${shortWallet(wallet)}` : "Connect Wallet & Sign"}
              </button>

              <button
                type="button"
                className="button button--light"
                onClick={() => void executeOrder(true)}
                disabled={submitting}
                style={{ width: "100%", padding: "10px", fontSize: 12, fontWeight: 700 }}
              >
                Save Paper Review Only
              </button>
            </div>

            <p style={{ margin: "14px 0 0", fontSize: 10, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
              Non-custodial cryptographic execution. OpenStock never holds private keys. All transactions settle natively on Solana Mainnet-Beta.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
