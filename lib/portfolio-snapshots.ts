import { promises as fs } from "node:fs";
import path from "node:path";

export type PortfolioSnapshot = { createdAt: string; totalValueUsd: number | null; solValueUsd: number | null; usdcValueUsd: number | null; holdings: Array<{ symbol: string; shares: number; valueUsd: number | null }> };
type SnapshotStore = { version: 1; wallets: Record<string, PortfolioSnapshot[]> };

const STORE_PATH = process.env.OPENSTOCK_PORTFOLIO_STORE_PATH ?? path.join(process.cwd(), ".data", "portfolio-snapshots.json");
const EMPTY_STORE: SnapshotStore = { version: 1, wallets: {} };
const INTERVAL_MS = 30 * 60 * 1000;

async function readStore(): Promise<SnapshotStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as Partial<SnapshotStore>;
    return { version: 1, wallets: parsed.wallets ?? {} };
  } catch { return EMPTY_STORE; }
}
async function writeStore(store: SnapshotStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const temporary = STORE_PATH + "." + process.pid + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(temporary, STORE_PATH);
}

export async function getPortfolioSnapshots(wallet: string) {
  const store = await readStore();
  return store.wallets[wallet] ?? [];
}

export async function recordPortfolioSnapshot(wallet: string, snapshot: PortfolioSnapshot) {
  const store = await readStore();
  const current = store.wallets[wallet] ?? [];
  const last = current.at(-1);
  if (last && new Date(snapshot.createdAt).getTime() - new Date(last.createdAt).getTime() < INTERVAL_MS) return { recorded: false, snapshots: current };
  const next = [...current, snapshot].slice(-1_000);
  store.wallets[wallet] = next;
  await writeStore(store);
  return { recorded: true, snapshots: next };
}

export function portfolioChange(snapshots: PortfolioSnapshot[], currentValueUsd: number | null) {
  const baseline = snapshots.find((snapshot) => snapshot.totalValueUsd !== null) ?? null;
  if (baseline?.totalValueUsd === null || baseline?.totalValueUsd === undefined || currentValueUsd === null) return { available: false, changeUsd: null, since: baseline?.createdAt ?? null, snapshots: snapshots.length };
  return { available: snapshots.length > 1, changeUsd: Number((currentValueUsd - baseline.totalValueUsd).toFixed(2)), since: baseline.createdAt, snapshots: snapshots.length };
}
