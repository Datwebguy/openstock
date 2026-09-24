/**
 * Single source of truth for tokenized stock descriptions, company names,
 * brand colors, and compliant tweet templates.
 * 
 * COMPLIANCE & LEGAL NOTICE:
 * Tokenized stocks on Solana track an equity's price. Holding a tokenized
 * stock does not confer direct corporate shareholder rights, direct underlying
 * share ownership, voting rights, or direct dividends from the underlying issuer.
 * Phrases such as "a real stock on one side", "real shares", "own Apple stock",
 * "you own", "backed by real shares", or "the stock itself" must NEVER be used.
 */

export interface StockCompanyConfig {
  companyName: string;
  brandColor: string;
  fullName: string;
}

export const STOCK_CONFIGS: Record<string, StockCompanyConfig> = {
  NVDA: { companyName: "Nvidia", brandColor: "#76b900", fullName: "Nvidia Corporation" },
  NVDAX: { companyName: "Nvidia", brandColor: "#76b900", fullName: "Nvidia Corporation" },
  AAPL: { companyName: "Apple", brandColor: "#a2aaad", fullName: "Apple Inc." },
  AAPLX: { companyName: "Apple", brandColor: "#a2aaad", fullName: "Apple Inc." },
  TSLA: { companyName: "Tesla", brandColor: "#e82127", fullName: "Tesla, Inc." },
  TSLAX: { companyName: "Tesla", brandColor: "#e82127", fullName: "Tesla, Inc." },
  MSFT: { companyName: "Microsoft", brandColor: "#00a4ef", fullName: "Microsoft Corporation" },
  MSFTX: { companyName: "Microsoft", brandColor: "#00a4ef", fullName: "Microsoft Corporation" },
  AMZN: { companyName: "Amazon", brandColor: "#ff9900", fullName: "Amazon.com, Inc." },
  AMZNX: { companyName: "Amazon", brandColor: "#ff9900", fullName: "Amazon.com, Inc." },
  GOOGL: { companyName: "Alphabet", brandColor: "#4285f4", fullName: "Alphabet Inc." },
  GOOGLX: { companyName: "Alphabet", brandColor: "#4285f4", fullName: "Alphabet Inc." },
  META: { companyName: "Meta", brandColor: "#0668e1", fullName: "Meta Platforms, Inc." },
  METAX: { companyName: "Meta", brandColor: "#0668e1", fullName: "Meta Platforms, Inc." },
  COIN: { companyName: "Coinbase", brandColor: "#0052ff", fullName: "Coinbase Global, Inc." },
  COINX: { companyName: "Coinbase", brandColor: "#0052ff", fullName: "Coinbase Global, Inc." },
  MSTR: { companyName: "MicroStrategy", brandColor: "#d8232a", fullName: "MicroStrategy Incorporated" },
  MSTRX: { companyName: "MicroStrategy", brandColor: "#d8232a", fullName: "MicroStrategy Incorporated" },
  INTC: { companyName: "Intel", brandColor: "#0071c5", fullName: "Intel Corporation" },
  INTCX: { companyName: "Intel", brandColor: "#0071c5", fullName: "Intel Corporation" },
  SPY: { companyName: "S&P 500", brandColor: "#1e3a8a", fullName: "SPDR S&P 500 ETF Trust" },
  SPYX: { companyName: "S&P 500", brandColor: "#1e3a8a", fullName: "SPDR S&P 500 ETF Trust" },
  QQQ: { companyName: "Nasdaq 100", brandColor: "#0284c7", fullName: "Invesco QQQ Trust" },
  QQQX: { companyName: "Nasdaq 100", brandColor: "#0284c7", fullName: "Invesco QQQ Trust" },
  AMD: { companyName: "AMD", brandColor: "#ed1c24", fullName: "Advanced Micro Devices, Inc." },
  AMDX: { companyName: "AMD", brandColor: "#ed1c24", fullName: "Advanced Micro Devices, Inc." },
  PLTR: { companyName: "Palantir", brandColor: "#3b82f6", fullName: "Palantir Technologies Inc." },
  PLTRX: { companyName: "Palantir", brandColor: "#3b82f6", fullName: "Palantir Technologies Inc." },
  NFLX: { companyName: "Netflix", brandColor: "#e50914", fullName: "Netflix, Inc." },
  NFLXX: { companyName: "Netflix", brandColor: "#e50914", fullName: "Netflix, Inc." },
  DIS: { companyName: "Disney", brandColor: "#113ccf", fullName: "The Walt Disney Company" },
  DISX: { companyName: "Disney", brandColor: "#113ccf", fullName: "The Walt Disney Company" },
  UBER: { companyName: "Uber", brandColor: "#2563eb", fullName: "Uber Technologies, Inc." },
  UBERX: { companyName: "Uber", brandColor: "#2563eb", fullName: "Uber Technologies, Inc." },
  HOOD: { companyName: "Robinhood", brandColor: "#00c805", fullName: "Robinhood Markets, Inc." },
  HOODX: { companyName: "Robinhood", brandColor: "#00c805", fullName: "Robinhood Markets, Inc." },
  ABNB: { companyName: "Airbnb", brandColor: "#ff5a5f", fullName: "Airbnb, Inc." },
  ABNBX: { companyName: "Airbnb", brandColor: "#ff5a5f", fullName: "Airbnb, Inc." },
  PYPL: { companyName: "PayPal", brandColor: "#003087", fullName: "PayPal Holdings, Inc." },
  PYPLX: { companyName: "PayPal", brandColor: "#003087", fullName: "PayPal Holdings, Inc." },
  AVGO: { companyName: "Broadcom", brandColor: "#cc092f", fullName: "Broadcom Inc." },
  AVGOX: { companyName: "Broadcom", brandColor: "#cc092f", fullName: "Broadcom Inc." },
  QCOM: { companyName: "Qualcomm", brandColor: "#3253dc", fullName: "QUALCOMM Incorporated" },
  QCOMX: { companyName: "Qualcomm", brandColor: "#3253dc", fullName: "QUALCOMM Incorporated" },
  ARM: { companyName: "Arm", brandColor: "#0091bd", fullName: "Arm Holdings plc" },
  ARMX: { companyName: "Arm", brandColor: "#0091bd", fullName: "Arm Holdings plc" },
  CRCL: { companyName: "Circle", brandColor: "#0084ff", fullName: "Circle Internet Financial" },
  CRCLX: { companyName: "Circle", brandColor: "#0084ff", fullName: "Circle Internet Financial" },
  GLD: { companyName: "SPDR Gold", brandColor: "#d4af37", fullName: "SPDR Gold Shares" },
  GLDX: { companyName: "SPDR Gold", brandColor: "#d4af37", fullName: "SPDR Gold Shares" },
  AI: { companyName: "C3.ai", brandColor: "#0ea5e9", fullName: "C3.ai, Inc." },
  AIX: { companyName: "C3.ai", brandColor: "#0ea5e9", fullName: "C3.ai, Inc." },
  BETR: { companyName: "Better Home", brandColor: "#00b074", fullName: "Better Home & Finance Holding" },
  BETRX: { companyName: "Better Home", brandColor: "#00b074", fullName: "Better Home & Finance Holding" },
  GDDY: { companyName: "GoDaddy", brandColor: "#1bdbaf", fullName: "GoDaddy Inc." },
  GDDYX: { companyName: "GoDaddy", brandColor: "#1bdbaf", fullName: "GoDaddy Inc." },
  QUBT: { companyName: "Quantum Computing", brandColor: "#6366f1", fullName: "Quantum Computing Inc." },
  QUBTX: { companyName: "Quantum Computing", brandColor: "#6366f1", fullName: "Quantum Computing Inc." },
  MP: { companyName: "MP Materials", brandColor: "#2563eb", fullName: "MP Materials Corp." },
  MPX: { companyName: "MP Materials", brandColor: "#2563eb", fullName: "MP Materials Corp." },
  DVA: { companyName: "DaVita", brandColor: "#059669", fullName: "DaVita Inc." },
  DVAX: { companyName: "DaVita", brandColor: "#059669", fullName: "DaVita Inc." },
  DRS: { companyName: "Leonardo DRS", brandColor: "#b91c1c", fullName: "Leonardo DRS, Inc." },
  DRSX: { companyName: "Leonardo DRS", brandColor: "#b91c1c", fullName: "Leonardo DRS, Inc." },
};

/**
 * Normalizes stock ticker and retrieves company configuration.
 */
export function getStockCompany(symbolOrStock: string): StockCompanyConfig {
  if (!symbolOrStock) {
    return { companyName: "Tokenized Equity", brandColor: "#9945ff", fullName: "Tokenized Equity" };
  }
  const clean = symbolOrStock.toUpperCase().trim();
  const direct = STOCK_CONFIGS[clean];
  if (direct) return direct;

  const noX = clean.endsWith("X") ? clean.slice(0, -1) : clean;
  const matchNoX = STOCK_CONFIGS[noX];
  if (matchNoX) return matchNoX;

  return { companyName: clean, brandColor: "#9945ff", fullName: `${clean} Stock` };
}

/**
 * Format stock symbol with trailing 'x' for display
 */
export function formatStockTicker(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  return upper.endsWith("X") ? upper : `${upper}x`;
}

/**
 * Standard Tokenized Stock definition phrases.
 * Approved safe wording for compliance.
 */
export const TOKENIZED_STOCK_SAFE_WORDING = {
  phraseShort: "tokenized stock",
  phraseSideBySide: "A stock-tracking token on one side, a new token on the other, on Solana.",
  phraseTracking: "a token that tracks {COMPANY} stock",
  phrasePairedAsset: "token tracking {COMPANY} stock",
  disclaimer: "Tokenized stocks track share prices on Solana. They do not confer direct shareholder ownership, voting rights, or corporate dividends.",
};

export type TweetTemplateKey = "plain" | "playful" | "formal";

export interface BuildTweetParams {
  symbol: string;
  pairedStockSymbol: string;
  companyName?: string;
  link: string;
  template?: TweetTemplateKey;
}

/**
 * Builds compliant tweet copy for launched stock-paired tokens.
 * Contains ZERO emojis, zero hashtags, zero royalties, zero raw mint addresses.
 */
export function buildTweetCopy({
  symbol,
  pairedStockSymbol,
  companyName,
  link,
  template = "plain",
}: BuildTweetParams): string {
  const stockX = formatStockTicker(pairedStockSymbol);
  const company = companyName || getStockCompany(pairedStockSymbol).companyName;
  const cleanSymbol = symbol.startsWith("$") ? symbol.slice(1) : symbol;

  switch (template) {
    case "playful":
      return `$${cleanSymbol} just got a ${company} stock partner. Every trade runs against ${stockX}, a token that tracks ${company} stock, on @OpenStock_.\n${link}`;
    case "formal":
      return `$${cleanSymbol} launched on @OpenStock_ with ${stockX}, a token tracking ${company} stock, as its paired asset on Solana.\n${link}`;
    case "plain":
    default:
      return `$${cleanSymbol} is now paired with tokenized ${company} stock (${stockX}). A stock-tracking token on one side, a new token on the other, on Solana.\n${link}`;
  }
}

/**
 * X (Twitter) counts every link as 23 characters using t.co wrapper.
 * This calculates exact character consumption against the 280 limit.
 */
export function calculateXCharacterCount(text: string, link: string): {
  count: number;
  remaining: number;
  isOverLimit: boolean;
} {
  // If the text includes the link, replace link instances with 23 characters
  let textWithoutLink = text;
  if (link && text.includes(link)) {
    textWithoutLink = text.replaceAll(link, "").trim();
    const effectiveLength = textWithoutLink.length + (textWithoutLink.length > 0 ? 1 : 0) + 23;
    return {
      count: effectiveLength,
      remaining: 280 - effectiveLength,
      isOverLimit: effectiveLength > 280,
    };
  }

  // If link is separate
  const effectiveLength = text.length + (link ? 24 : 0);
  return {
    count: effectiveLength,
    remaining: 280 - effectiveLength,
    isOverLimit: effectiveLength > 280,
  };
}
