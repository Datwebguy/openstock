import curated from "@/lib/solana-curated-25.json";
import { fetchJupiterPrices } from "@/lib/jupiter-price";
import {
  DAMM_V2_DEFAULT_FEE_BPS,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  DBC_CURVE_KEYS,
  DBC_CURVE_LABELS,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  listDbcConfigs,
  readDbcConfigSummary,
  resolveDammV2MigrationConfig,
  type DbcConfigSummary,
  type DbcCurveKey,
} from "@/lib/meteora-dbc";

type CuratedEntry = { symbol: string; name: string; mint: string; decimals?: number };

const STOCKS = Object.values(curated as Record<string, CuratedEntry>).filter((entry) => entry?.mint && entry?.symbol);

export type DbcPreset = {
  symbol: string;
  stockName: string;
  quoteMint: string;
  curve: DbcCurveKey;
  name: string;
  blurb: string;
  configAddress: string;
  configUrl: string;
  quoteDecimals: number;
  migrationThresholdUi: number;
  quotePriceUsd: number | null;
  graduationUsd: number | null;
  baseFeeBps: number;
  creatorTradingFeePercent: number;
  dynamicFee: boolean;
  feeClaimer: string;
  migrationTarget: DbcConfigSummary["migrationTarget"];
  dammV2Config: string;
  dammV2FeeBps: number;
};

export function listCatalogSymbols(): Array<{ symbol: string; name: string; mint: string }> {
  return STOCKS.map((s) => ({ symbol: s.symbol, name: s.name, mint: s.mint }));
}

export async function getDbcPresetCatalog(): Promise<{
  program: string;
  dammV2Config: string;
  dammV2FeeBps: number;
  dammV2Configs: Array<{ feeBps: number; address: string }>;
  presets: DbcPreset[];
}> {
  const dammV2Config = resolveDammV2MigrationConfig();
  const rows: Array<{
    symbol: string;
    stockName: string;
    quoteMint: string;
    curve: DbcCurveKey;
    address: string;
  }> = [];

  for (const stock of STOCKS) {
    const configs = listDbcConfigs({ quoteMint: stock.mint, pairedStockSymbol: stock.symbol });
    for (const curve of DBC_CURVE_KEYS) {
      const address = configs[curve];
      if (address) rows.push({ symbol: stock.symbol, stockName: stock.name, quoteMint: stock.mint, curve, address });
    }
  }

  const summaries = await Promise.all(rows.map((row) => readDbcConfigSummary(row.address)));
  const mints = [...new Set(rows.map((row) => row.quoteMint))];
  const prices = mints.length > 0 ? await fetchJupiterPrices(mints, 8_000) : {};

  const presets: DbcPreset[] = [];
  rows.forEach((row, i) => {
    const summary = summaries[i];
    if (!summary || summary.quoteMint !== row.quoteMint) return;
    const quotePriceUsd = Number(prices[row.quoteMint]?.usdPrice);
    const price = Number.isFinite(quotePriceUsd) && quotePriceUsd > 0 ? quotePriceUsd : null;
    presets.push({
      symbol: row.symbol,
      stockName: row.stockName.replace(/ xStock$/, ""),
      quoteMint: row.quoteMint,
      curve: row.curve,
      name: DBC_CURVE_LABELS[row.curve].name,
      blurb: DBC_CURVE_LABELS[row.curve].blurb,
      configAddress: summary.configAddress,
      configUrl: `https://solscan.io/account/${summary.configAddress}`,
      quoteDecimals: summary.quoteDecimals,
      migrationThresholdUi: summary.migrationThresholdUi,
      quotePriceUsd: price,
      graduationUsd: price !== null ? summary.migrationThresholdUi * price : null,
      baseFeeBps: summary.baseFeeBps,
      creatorTradingFeePercent: summary.creatorTradingFeePercent,
      dynamicFee: summary.dynamicFee,
      feeClaimer: summary.feeClaimer,
      migrationTarget: summary.migrationTarget,
      dammV2Config,
      dammV2FeeBps: DAMM_V2_DEFAULT_FEE_BPS,
    });
  });

  const feeBps = [25, 30, 100, 200, 400, 600, 0];
  const programId =
    typeof DYNAMIC_BONDING_CURVE_PROGRAM_ID === "string"
      ? DYNAMIC_BONDING_CURVE_PROGRAM_ID
      : DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58();
  return {
    program: programId,
    dammV2Config,
    dammV2FeeBps: DAMM_V2_DEFAULT_FEE_BPS,
    dammV2Configs: DAMM_V2_MIGRATION_FEE_ADDRESS.map((address, i) => ({
      feeBps: feeBps[i] ?? 0,
      address,
    })),
    presets,
  };
}
