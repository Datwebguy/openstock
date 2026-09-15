"use client";

import { useState } from "react";
import { siApple, siCircle, siCoinbase, siGoogle, siMeta, siNvidia, siTesla } from "simple-icons/icons";

type StockLogoProps = {
  symbol: string;
  size?: number;
  logo?: string;
  className?: string;
};

const simpleIcons: Record<string, { path: string }> = {
  AAPLx: siApple,
  GOOGLx: siGoogle,
  NVDAx: siNvidia,
  TSLAx: siTesla,
  METAx: siMeta,
  COINx: siCoinbase,
  CRCLx: siCircle,
};

const brandColors: Record<string, string> = {
  AAPLx: "#111111",
  AMZNx: "#ff9900",
  GOOGLx: "#4285f4",
  NVDAx: "#76b900",
  TSLAx: "#e82127",
  METAx: "#0866ff",
  MSFTx: "#00a4ef",
  COINx: "#0052ff",
  CRCLx: "#635bff",
  SPYx: "#7140c8",
  MSTRx: "#d82424",
  INTCx: "#0068b5",
  SPCXx: "#0052ff",
};

function AmazonMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "70%", height: "70%", fill: "currentColor" }}>
      <path d="M2.4 16.2c2.9 2.15 7.05 3.45 11.35 3.45 2.7 0 5.85-.75 8.35-2.2.38-.22.1-.66-.32-.46-2.4 1.28-5.5 2.05-8.03 2.05-3.75 0-7.45-1.2-10.3-3.25-.28-.2-.52.16-.05.41z" />
      <path d="M20.7 15.35c-.2-.24-.55-.1-.72.1l-.1.95c0 .7.16 1.45.5 2 .1.16.02.22.2.12 1.4-.4 2.45-1.05 3.35-1.85.14-.12.04-.26-.1-.24-.85.55-1.9 1.15-3.15 1.45.02-.55-.02-1.35-.08-2.53z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "65%", height: "65%", fill: "currentColor" }}>
      <path d="M3 3h8.2v8.2H3z" fill="#f25022" />
      <path d="M12.8 3H21v8.2h-8.2z" fill="#7fba00" />
      <path d="M3 12.8h8.2V21H3z" fill="#00a4ef" />
      <path d="M12.8 12.8H21V21h-8.2z" fill="#ffb900" />
    </svg>
  );
}

export function StockLogo({ symbol, size = 42, logo, className = "" }: StockLogoProps) {
  const [failed, setFailed] = useState(false);

  // Normalize symbol (e.g. AAPL -> AAPLx)
  const normSymbol = symbol.endsWith("x") ? symbol : `${symbol}x`;
  const baseTicker = normSymbol.replace(/x$/, "");

  // Real official token logo hosted on Backed CDN
  const tokenLogoUrl = logo || `https://xstocks-metadata.backed.fi/logos/tokens/${normSymbol}.png`;
  const color = brandColors[normSymbol] ?? "#9945ff";
  const simple = simpleIcons[normSymbol];

  return (
    <span
      className={`stock-logo ${className}`.trim()}
      style={{
        width: size,
        minWidth: size,
        maxWidth: size,
        height: size,
        minHeight: size,
        maxHeight: size,
        borderRadius: Math.max(8, Math.round(size * 0.28)),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        border: "1px solid rgba(22, 19, 33, 0.08)",
        boxShadow: "0 2px 8px rgba(15, 7, 34, 0.05)",
        flexShrink: 0,
      }}
      role="img"
      aria-label={`${symbol} token logo`}
    >
      {!failed ? (
        <img
          src={tokenLogoUrl}
          alt={symbol}
          width={size}
          height={size}
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
          loading="lazy"
        />
      ) : simple ? (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ width: "58%", height: "58%", fill: color }}
          dangerouslySetInnerHTML={{ __html: `<path d="${simple.path}"/>` }}
        />
      ) : normSymbol === "AMZNx" ? (
        <AmazonMark />
      ) : normSymbol === "MSFTx" ? (
        <MicrosoftMark />
      ) : (
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: Math.max(9, Math.floor(size * 0.3)),
            fontWeight: 700,
            color,
            letterSpacing: "-0.02em",
          }}
        >
          {baseTicker.slice(0, 4)}
        </span>
      )}
    </span>
  );
}
