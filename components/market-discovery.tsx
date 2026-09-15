"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/stock-logo";
import { displayPrice, type OpenStockAsset } from "@/lib/xstocks";

type Filter = "all" | "watchlist";
type Sort = "alphabetical" | "price-high" | "price-low";

function issuerName(asset: OpenStockAsset) { return asset.name.replace(/ xStock$/, ""); }
function ticker(asset: OpenStockAsset) { return asset.underlying?.symbol ?? asset.symbol.replace(/x$/, "").toUpperCase(); }
function session(asset: OpenStockAsset) { if (asset.isTradingHalted || asset.trading?.isTradingHalted) return "HALT"; if (asset.trading?.openNow === true) return "OPEN"; return "PENDING"; }

export function MarketDiscovery({ assets }: { assets: OpenStockAsset[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("alphabetical");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem("openstock:watchlist") ?? "[]"); setWatchlist(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []); } catch { setWatchlist([]); }
  }, []);
  function toggleWatchlist(symbol: string) {
    const next = watchlist.includes(symbol) ? watchlist.filter((item) => item !== symbol) : [...watchlist, symbol];
    setWatchlist(next);
    try { localStorage.setItem("openstock:watchlist", JSON.stringify(next)); setStorageMessage(""); } catch { setStorageMessage("Your watchlist is available for this visit, but this browser could not save it."); }
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
    {storageMessage ? <p className="workspace-note" role="status">{storageMessage}</p> : null}
    <div className="discovery-toolbar">
      <div className="discovery-search"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="stock-search">Search stocks</label><input id="stock-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Apple, Tesla, AAPL…" /></div>
      <div className="discovery-filters" role="group" aria-label="Filter stocks">
        {(["all", "watchlist"] as Filter[]).map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item === "all" ? "All stocks" : "Watchlist (" + watchlist.length + ")"}</button>)}
      </div>
      <label className="discovery-sort">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="alphabetical">Name</option><option value="price-high">Price: high to low</option><option value="price-low">Price: low to high</option></select></label>
    </div>

    <div className="discovery-results"><span role="status">{filtered.length} {filtered.length === 1 ? "stock" : "stocks"}{filter === "watchlist" ? " in your watchlist" : " to explore"}</span>{query || filter !== "all" ? <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button> : <span>Issuer reference prices</span>}</div>

    {filtered.length ? <div className="stock-grid" aria-label="Tokenized stocks">{filtered.map((asset) => <article className="stock-card" key={asset.symbol}>
      <Link className="stock-card__main" href={`/app/asset/${asset.symbol}`} aria-label={`${issuerName(asset)}, ${asset.symbol}`}><div className="stock-card__top"><StockLogo symbol={asset.symbol} logo={asset.logo} /><span className="stock-card__ticker">{asset.symbol}</span></div><h2>{issuerName(asset)}</h2><span className="stock-card__price">{asset.price !== null && asset.price !== undefined ? displayPrice(asset.price) : "PENDING"}</span><span className="stock-card__meta">{ticker(asset)} · {session(asset)}</span></Link>
      <div className="stock-card__footer">
        <button type="button" className={watchlist.includes(asset.symbol) ? "is-saved" : ""} aria-label={(watchlist.includes(asset.symbol) ? "Remove " : "Add ") + asset.symbol + " from watchlist"} aria-pressed={watchlist.includes(asset.symbol)} onClick={() => toggleWatchlist(asset.symbol)}>{watchlist.includes(asset.symbol) ? "★" : "☆"}</button>
        <Link href={`/launch?symbol=${asset.symbol}`} className="stock-card__launch-btn" title={`Launch a community token paired with ${asset.symbol}`}>
          Pair & Launch ↗
        </Link>
      </div>
    </article>)}</div> : <div className="discovery-empty"><strong>{filter === "watchlist" && !query ? "Your watchlist starts with a little curiosity." : "No stocks match your search."}</strong><span>{filter === "watchlist" && !query ? "Save a stock using its star to keep it close. Your list stays in this browser." : "Try a company name or ticker, or reset your filters."}</span><button className="button button--light" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Browse all stocks</button></div>}
  </section>;
}
