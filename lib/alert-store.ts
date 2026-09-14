import { promises as fs } from "node:fs";
import path from "node:path";

export type AlertWatch = { eventId: string; symbol: string; enabled: boolean; updatedAt: string };
export type AlertHistoryItem = AlertWatch & { action: "enabled" | "disabled" };
export type MarketWatch = { id: string; symbol: string; kind: "price" | "liquidity"; direction: "above" | "below"; threshold: number; enabled: boolean; updatedAt: string; lastTriggeredAt?: string | null };
export type MarketAlert = { id: string; watchId: string; symbol: string; kind: "price" | "liquidity"; direction: "above" | "below"; threshold: number; currentValue: number; createdAt: string };
type AlertStore = { version: 3; watches: Record<string, AlertWatch[]>; marketWatches: Record<string, MarketWatch[]>; marketAlerts: Record<string, MarketAlert[]>; history: Record<string, AlertHistoryItem[]> };

const STORE_PATH = process.env.OPENSTOCK_ALERT_STORE_PATH ?? path.join(process.cwd(), ".data", "alerts.json");
const EMPTY_STORE: AlertStore = { version: 3, watches: {}, marketWatches: {}, marketAlerts: {}, history: {} };

async function readStore(): Promise<AlertStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AlertStore>;
    return { version: 3, watches: parsed.watches ?? {}, marketWatches: parsed.marketWatches ?? {}, marketAlerts: parsed.marketAlerts ?? {}, history: parsed.history ?? {} };
  } catch { return EMPTY_STORE; }
}

async function writeStore(store: AlertStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const temporaryPath = STORE_PATH + "." + process.pid + ".tmp";
  await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(temporaryPath, STORE_PATH);
}

export async function getAlertState(sessionId: string) {
  const store = await readStore();
  return { watches: store.watches[sessionId] ?? [], history: (store.history[sessionId] ?? []).slice(0, 30) };
}

export async function setAlertWatch(sessionId: string, eventId: string, symbol: string, enabled: boolean) {
  const store = await readStore();
  const current = store.watches[sessionId] ?? [];
  const updatedAt = new Date().toISOString();
  const next = current.filter((watch) => watch.eventId !== eventId);
  if (enabled) next.unshift({ eventId, symbol, enabled: true, updatedAt });
  store.watches[sessionId] = next.slice(0, 100);
  const history = store.history[sessionId] ?? [];
  const historyItem: AlertHistoryItem = { eventId, symbol, enabled, updatedAt, action: enabled ? "enabled" : "disabled" };
  store.history[sessionId] = [historyItem, ...history].slice(0, 30);
  await writeStore(store);
  return { watches: store.watches[sessionId], history: store.history[sessionId] };
}

export async function getMarketWatchState(sessionId: string, symbol?: string) {
  const store = await readStore();
  const watches = store.marketWatches[sessionId] ?? [];
  return { watches: symbol ? watches.filter((watch) => watch.symbol === symbol) : watches };
}

export async function setMarketWatch(sessionId: string, input: Omit<MarketWatch, "id" | "updatedAt" | "lastTriggeredAt">) {
  const store = await readStore();
  const current = store.marketWatches[sessionId] ?? [];
  const id = input.symbol + ":" + input.kind;
  const next = current.filter((watch) => watch.id !== id);
  if (input.enabled) next.unshift({ ...input, id, updatedAt: new Date().toISOString() });
  store.marketWatches[sessionId] = next.slice(0, 40);
  await writeStore(store);
  return { watches: store.marketWatches[sessionId] };
}

export async function getMarketAlerts(sessionId: string) {
  const store = await readStore();
  return { alerts: store.marketAlerts[sessionId] ?? [] };
}

export async function recordMarketAlerts(sessionId: string, hits: Array<{ watch: MarketWatch; currentValue: number }>) {
  const store = await readStore();
  const now = new Date();
  const watches = store.marketWatches[sessionId] ?? [];
  const existing = store.marketAlerts[sessionId] ?? [];
  const nextAlerts = [...existing];
  const nextWatches = watches.map((watch) => {
    const hit = hits.find((item) => item.watch.id === watch.id);
    if (!hit) return watch;
    const last = watch.lastTriggeredAt ? new Date(watch.lastTriggeredAt).getTime() : 0;
    if (last && now.getTime() - last < 60 * 60 * 1000) return watch;
    const createdAt = now.toISOString();
    nextAlerts.unshift({ id: crypto.randomUUID(), watchId: watch.id, symbol: watch.symbol, kind: watch.kind, direction: watch.direction, threshold: watch.threshold, currentValue: hit.currentValue, createdAt });
    return { ...watch, lastTriggeredAt: createdAt };
  });
  store.marketWatches[sessionId] = nextWatches;
  store.marketAlerts[sessionId] = nextAlerts.slice(0, 100);
  await writeStore(store);
  return { alerts: store.marketAlerts[sessionId] };
}
