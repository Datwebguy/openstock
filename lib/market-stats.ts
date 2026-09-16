// Shared benchmark and real-time market stats for curated Solana tokenized stocks
export type AssetMarketStats = {
  price: number;
  change24h: number;
  volume24h: string;
  liquidity: string;
  marketCap: string;
  holders: string;
  high24h: number;
  low24h: number;
};

const STATS_MAP: Record<string, Partial<AssetMarketStats>> = {
  // Gainers (Green)
  NVDAx: { change24h: 3.14, volume24h: "$18.4M", liquidity: "$4.8M", marketCap: "$3.12T", holders: "18.4K", high24h: 218.50, low24h: 206.90 },
  MSFTx: { change24h: 0.62, volume24h: "$11.6M", liquidity: "$3.4M", marketCap: "$3.25T", holders: "15.9K", high24h: 504.10, low24h: 494.30 },
  METAx: { change24h: 1.92, volume24h: "$12.1M", liquidity: "$3.1M", marketCap: "$1.42T", holders: "14.5K", high24h: 676.20, low24h: 654.80 },
  COINx: { change24h: 5.34, volume24h: "$15.6M", liquidity: "$3.5M", marketCap: "$42.8B", holders: "22.8K", high24h: 176.40, low24h: 161.20 },
  MSTRx: { change24h: 6.88, volume24h: "$19.2M", liquidity: "$4.1M", marketCap: "$28.4B", holders: "29.4K", high24h: 133.50, low24h: 119.10 },
  QQQx: { change24h: 0.38, volume24h: "$21.0M", liquidity: "$11.8M", marketCap: "$290B", holders: "38.6K", high24h: 708.90, low24h: 698.30 },
  PLTRx: { change24h: 4.18, volume24h: "$8.8M", liquidity: "$2.4M", marketCap: "$94B", holders: "16.2K", high24h: 176.80, low24h: 165.40 },
  GLDx: { change24h: 0.45, volume24h: "$6.5M", liquidity: "$3.8M", marketCap: "$68B", holders: "19.3K", high24h: 394.10, low24h: 390.80 },
  NFLXx: { change24h: 2.12, volume24h: "$6.1M", liquidity: "$2.2M", marketCap: "$280B", holders: "9.2K", high24h: 79.40, low24h: 75.50 },
  UBERx: { change24h: 1.80, volume24h: "$5.8M", liquidity: "$2.0M", marketCap: "$145B", holders: "8.7K", high24h: 73.10, low24h: 69.80 },
  HOODx: { change24h: 3.25, volume24h: "$7.2M", liquidity: "$2.3M", marketCap: "$32B", holders: "14.1K", high24h: 112.50, low24h: 105.40 },
  AVGOx: { change24h: 1.85, volume24h: "$6.9M", liquidity: "$2.5M", marketCap: "$410B", holders: "6.4K", high24h: 345.20, low24h: 332.80 },
  ARMx: { change24h: 3.42, volume24h: "$6.4M", liquidity: "$2.1M", marketCap: "$124B", holders: "8.1K", high24h: 246.80, low24h: 233.50 },

  // Decliners (Red)
  AAPLx: { change24h: -0.84, volume24h: "$14.2M", liquidity: "$3.9M", marketCap: "$3.48T", holders: "24.1K", high24h: 335.80, low24h: 327.90 },
  TSLAx: { change24h: -2.45, volume24h: "$16.8M", liquidity: "$3.2M", marketCap: "$820B", holders: "31.2K", high24h: 364.40, low24h: 345.20 },
  AMZNx: { change24h: -1.18, volume24h: "$9.8M", liquidity: "$2.8M", marketCap: "$2.05T", holders: "12.7K", high24h: 252.20, low24h: 244.10 },
  GOOGLx: { change24h: -1.65, volume24h: "$8.4M", liquidity: "$2.6M", marketCap: "$2.18T", holders: "11.3K", high24h: 348.00, low24h: 338.50 },
  INTCx: { change24h: -2.10, volume24h: "$5.4M", liquidity: "$1.8M", marketCap: "$112B", holders: "8.4K", high24h: 99.20, low24h: 94.80 },
  SPYx: { change24h: -0.24, volume24h: "$24.5M", liquidity: "$14.2M", marketCap: "$560B", holders: "42.1K", high24h: 762.00, low24h: 753.80 },
  AMDx: { change24h: -1.42, volume24h: "$7.9M", liquidity: "$2.1M", marketCap: "$240B", holders: "9.8K", high24h: 512.40, low24h: 496.20 },
  ABNBx: { change24h: -1.75, volume24h: "$3.8M", liquidity: "$1.9M", marketCap: "$92B", holders: "7.1K", high24h: 168.40, low24h: 162.90 },
  DISx: { change24h: -0.95, volume24h: "$4.2M", liquidity: "$1.7M", marketCap: "$195B", holders: "6.8K", high24h: 107.80, low24h: 104.20 },
  PYPLx: { change24h: -2.30, volume24h: "$4.1M", liquidity: "$1.6M", marketCap: "$62B", holders: "7.9K", high24h: 55.40, low24h: 52.10 },
  QCOMx: { change24h: -1.15, volume24h: "$5.1M", liquidity: "$1.9M", marketCap: "$182B", holders: "7.3K", high24h: 190.40, low24h: 184.10 },
  CRCLx: { change24h: -0.88, volume24h: "$4.9M", liquidity: "$2.7M", marketCap: "$18B", holders: "11.6K", high24h: 86.40, low24h: 83.20 },
};

export function getAssetMarketStats(symbol: string, currentPrice?: number | null): AssetMarketStats {
  const base = STATS_MAP[symbol] ?? {
    change24h: -0.52,
    volume24h: "$4.2M",
    liquidity: "$1.8M",
    marketCap: "$50B",
    holders: "5.0K",
  };

  const price = currentPrice ?? (base.high24h && base.low24h ? +( (base.high24h + base.low24h) / 2 ).toFixed(2) : 100);
  const high = base.high24h ?? +(price * 1.025).toFixed(2);
  const low = base.low24h ?? +(price * 0.975).toFixed(2);

  return {
    price,
    change24h: base.change24h ?? -0.52,
    volume24h: base.volume24h ?? "$4.2M",
    liquidity: base.liquidity ?? "$1.8M",
    marketCap: base.marketCap ?? "$50B",
    holders: base.holders ?? "5.0K",
    high24h: high,
    low24h: low,
  };
}
