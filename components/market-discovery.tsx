"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/stock-logo";
import { CURATED_SYMBOLS, displayPrice, solanaProgram, type OpenStockAsset } from "@/lib/xstocks";

type Filter = "all" | "watchlist";
type Sort = "alphabetical" | "price-high" | "price-low";

function issuerName(asset: OpenStockAsset) { return asset.name.replace(/ xStock$/, ""); }
function ticker(asset: OpenStockAsset) { return asset.underlying?.symbol ?? asset.symbol.replace(/x$/, "").toUpperCase(); }
function session(asset: OpenStockAsset) { if (asset.isTradingHalted || asset.trading?.isTradingHalted) return "Trading halted"; if (asset.trading?.openNow === true) return "Issuer market open"; if (asset.trading?.currentPeriod === "closed" || asset.trading?.openNow === false) return "Issuer closed · onchain context"; return "Market phase loading"; }

export function MarketDiscovery({ assets }: { assets: OpenStockAsset[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("alphabetical");
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try { setWatchlist(JSON.parse(localStorage.getItem("openstock:watchlist") ?? "[]")); } catch { setWatchlist([]); }
  }, []);
  function toggleWatchlist(symbol: string) {
    setWatchlist((current) => {
      const next = current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol];
      localStorage.setItem("openstock:watchlist", JSON.stringify(next));
      return next;
    });
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesQuery = !normalized || [asset.symbol, ticker(asset), issuerName(asset)].some((value) => value.toLowerCase().includes(normalized));
      const matchesFilter = filter === "all" || watchlist.includes(asset.symbol);
      return matchesQuery && matchesFilter;
    }).sort((left, right) => {
      if (sort === "price-high" || sort === "price-low") {
        const leftPrice = left.price ?? -1, rightPrice = right.price ?? -1;
        return sort === "price-high" ? rightPrice - leftPrice : leftPrice - rightPrice;
      }
      return issuerName(left).localeCompare(issuerName(right));
    });
  }, [assets, filter, query, sort, watchlist]);

  return <section className="discovery" aria-label="Market discovery">
    <div className="discovery-toolbar">
      <div className="discovery-search"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="stock-search">Search stocks</label><input id="stock-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Apple, Tesla, AAPL…" /></div>
      <div className="discovery-filters" role="group" aria-label="Filter stocks">
        {(["all", "watchlist"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item === "all" ? "All stocks" : "Watchlist"}</button>)}
      </div>
      <label className="discovery-sort">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="alphabetical">Name</option><option value="price-high">Price: high to low</option><option value="price-low">Price: low to high</option></select></label>
    </div>

    <div className="discovery-results"><span>{filtered.length} {filtered.length === 1 ? "stock" : "stocks"}</span>{query || filter !== "all" ? <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button> : <Link href="/app/actions">Issuer events →</Link>}</div>

    {filtered.length ? <div className="stock-grid" aria-label="Tokenized stocks">{filtered.map((asset) => <article className="stock-card" key={asset.symbol}>
      <Link className="stock-card__main" href={`/app/asset/${asset.symbol}`}><div className="stock-card__top"><StockLogo symbol={asset.symbol} logo={asset.logo} /><span className="stock-card__ticker">{asset.symbol}</span></div><h2>{issuerName(asset)}</h2><span className="stock-card__price">{asset.price !== null && asset.price !== undefined ? displayPrice(asset.price) : asset.trading?.currentPeriod === "closed" ? "Reference paused" : "Reference pending"}</span><span className="stock-card__meta">{ticker(asset)} · {session(asset)}</span></Link>
      <div className="stock-card__footer"><Link href={`/app/asset/${asset.symbol}`}>Open stock <span className="stock-card__arrow">↗</span></Link><button type="button" className={watchlist.includes(asset.symbol) ? "is-saved" : ""} aria-label={(watchlist.includes(asset.symbol) ? "Remove " : "Add ") + asset.symbol + " from watchlist"} aria-pressed={watchlist.includes(asset.symbol)} onClick={() => toggleWatchlist(asset.symbol)}>{watchlist.includes(asset.symbol) ? "★" : "☆"}</button></div>
    </article>)}</div> : <div className="discovery-empty"><strong>No issuers match that view.</strong><span>Try another search or clear the filters.</span></div>}
  </section>;
}
