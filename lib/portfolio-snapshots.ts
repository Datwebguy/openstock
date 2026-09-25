import { readJson, writeJson } from "@/lib/json-store";

export type PortfolioSnapshot = { createdAt: string; totalValueUsd: number | null; solValueUsd: number | null; usdcValueUsd: number | null; holdings: Array<{ symbol: string; shares: number; valueUsd: number | null }> };
type SnapshotStore = { version: 1; wallets: Record<string, PortfolioSnapshot[]> };

const INTERVAL_MS = 30 * 60 * 1000;

async function readStore(): Promise<SnapshotStore> {
  const parsed = await readJson<SnapshotStore>("portfolio-snapshots");
  return { version: 1, wallets: parsed?.wallets ?? {} };
}
async function writeStore(store: SnapshotStore) {
  await writeJson("portfolio-snapshots", store);
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
