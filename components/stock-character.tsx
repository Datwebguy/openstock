"use client";

import { StockLogo } from "@/components/stock-logo";

type StockCharacterProps = { symbol: string; name: string; logo?: string; compact?: boolean };

export function StockCharacter({ symbol, name, logo, compact = false }: StockCharacterProps) {
  return <div className={`stock-character ${compact ? "stock-character--compact" : ""}`} role="img" aria-label={`${name} ${symbol} suspended stock logo`}>
    <div className="stock-character__thread" aria-hidden="true" />
    <div className="stock-character__coin" aria-hidden="true">
      <div className="stock-character__coin-face stock-character__coin-face--front"><StockLogo symbol={symbol} logo={logo} size={100} /></div>
      <div className="stock-character__coin-face stock-character__coin-face--back"><StockLogo symbol={symbol} logo={logo} size={100} /></div>
    </div>
    <div className="stock-character__shadow" aria-hidden="true" />
    <span className="stock-character__tag">{symbol}</span>
  </div>;
}
