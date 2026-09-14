import { CURATED_SYMBOLS } from "@/lib/xstocks";

export type MarketNewsItem = {
  id: string;
  symbol: string | null;
  channel: "news" | "social";
  source: string;
  author: string | null;
  headline: string;
  url: string;
  publishedAt: string;
};

type BlueskyResponse = { posts?: Array<{ uri?: string; record?: { text?: string; createdAt?: string }; author?: { handle?: string; displayName?: string } }> };

const TERMS: Record<string, { company: string; ticker: string }> = {
  AAPLx: { company: "Apple", ticker: "AAPL" }, AMZNx: { company: "Amazon", ticker: "AMZN" }, GOOGLx: { company: "Alphabet Google", ticker: "GOOGL" }, NVDAx: { company: "Nvidia", ticker: "NVDA" }, TSLAx: { company: "Tesla", ticker: "TSLA" }, METAx: { company: "Meta", ticker: "META" }, MSFTx: { company: "Microsoft", ticker: "MSFT" }, COINx: { company: "Coinbase", ticker: "COIN" }, CRCLx: { company: "Circle", ticker: "CRCL" }, SPYx: { company: "S&P 500 SPY", ticker: "SPY" },
};

function clean(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
function part(value: string, tag: string) {
  return clean(value.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"))?.[1] ?? "");
}
function queryFor(symbol?: string) {
  if (symbol && TERMS[symbol]) return TERMS[symbol].company + " " + TERMS[symbol].ticker + " stock";
  return "xStocks OR tokenized stocks Solana OR (Apple Amazon Alphabet Nvidia Tesla Meta Microsoft Coinbase Circle) stock";
}
function date(value: string | null | undefined) {
  const stamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : new Date().toISOString();
}

async function googleNews(symbol?: string): Promise<MarketNewsItem[]> {
  const response = await fetch("https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=" + encodeURIComponent(queryFor(symbol) + " when:7d"), { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("News feed returned " + response.status);
  const xml = await response.text();
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((match, index) => {
    const item = match[1];
    const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const source = clean(sourceMatch?.[1] ?? "News source") || "News source";
    const title = part(item, "title").replace(new RegExp("\\s+-\\s+" + source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"), "");
    const url = part(item, "link");
    return { id: "news-" + (part(item, "guid") || url || index), symbol: symbol ?? null, channel: "news" as const, source, author: null, headline: title, url, publishedAt: date(part(item, "pubDate")) };
  }).filter((item) => Boolean(item.headline && item.url));
}

async function blueskyPosts(symbol?: string): Promise<MarketNewsItem[]> {
  const response = await fetch("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=" + encodeURIComponent(symbol && TERMS[symbol] ? TERMS[symbol].company + " " + TERMS[symbol].ticker : "xStocks") + "&limit=12", { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Social feed returned " + response.status);
  const payload = await response.json() as BlueskyResponse;
  return (payload.posts ?? []).map((post) => {
    const handle = post.author?.handle ?? "unknown";
    const rkey = post.uri?.split("/").pop() ?? "";
    return { id: "bsky-" + (post.uri ?? rkey), symbol: symbol ?? null, channel: "social" as const, source: "Bluesky", author: "@" + handle, headline: (post.record?.text ?? "").replace(/\s+/g, " ").trim(), url: rkey ? "https://bsky.app/profile/" + handle + "/post/" + rkey : "", publishedAt: date(post.record?.createdAt) };
  }).filter((item) => Boolean(item.headline && item.url));
}

export async function getMarketNews(symbol?: string) {
  const safeSymbol = symbol && CURATED_SYMBOLS.includes(symbol) ? symbol : undefined;
  const results = await Promise.allSettled([googleNews(safeSymbol), blueskyPosts(safeSymbol)]);
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = item.channel + ":" + item.headline.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 24);
  return { items: unique, social: { bluesky: results[1].status === "fulfilled" }, failures: results.flatMap((result, index) => result.status === "rejected" ? [["news", "Bluesky"][index]] : []) };
}
