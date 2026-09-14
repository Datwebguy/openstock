"use client";

import { siSolana } from "simple-icons/icons";
import { StockLogo } from "@/components/stock-logo";

type NetworkAsset = { symbol: string; name: string; logo?: string };
const positions = [[13, 18], [50, 8], [86, 19], [92, 57], [72, 88], [28, 88], [8, 58], [50, 94]] as const;
const ringFor = (index: number) => index % 2 === 0 ? "outer" : "inner";

export function StockNetwork({ assets }: { assets: NetworkAsset[] }) {
  const nodes = assets.slice(0, positions.length);
  const renderNodes = (ring: "outer" | "inner") => nodes.map((asset, index) => ringFor(index) === ring ? <div className="stock-network__node" key={asset.symbol} style={{ left: `${positions[index][0]}%`, top: `${positions[index][1]}%` }}><span className="stock-network__node-content"><span className="stock-network__node-inner"><StockLogo symbol={asset.symbol} logo={asset.logo} size={42} /></span><small>{asset.symbol}</small></span></div> : null);
  return <div className="stock-network-shell" aria-label="Solana connected to tokenized stock assets">
    <div className="stock-network">
      <svg className="stock-network__links" viewBox="0 0 100 100" aria-hidden="true">
        {nodes.map((asset, index) => <line key={`center-${asset.symbol}`} x1="50" y1="50" x2={positions[index][0]} y2={positions[index][1]} />)}
        {nodes.map((asset, index) => { const next = positions[(index + 1) % nodes.length]; return <line className="stock-network__link--outer" key={`outer-${asset.symbol}`} x1={positions[index][0]} y1={positions[index][1]} x2={next[0]} y2={next[1]} />; })}
      </svg>
      <div className="stock-network__solana"><svg viewBox="0 0 24 24" role="img" aria-label="Solana" dangerouslySetInnerHTML={{ __html: `<path d="${siSolana.path}"/>` }} /></div>
      <div className="stock-network__orbit stock-network__orbit--outer" aria-hidden="true">{renderNodes("outer")}</div>
      <div className="stock-network__orbit stock-network__orbit--inner" aria-hidden="true">{renderNodes("inner")}</div>
    </div>
    <div className="stock-network__caption">xStocks · connected on Solana</div>
  </div>;
}
