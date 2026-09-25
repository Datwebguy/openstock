import { readJson, writeJson } from "@/lib/json-store";

export type StoredReceipt = { id: string; wallet: string; signature: string; symbol: string; name: string; side: "buy" | "sell"; shares: number; referencePrice: number; multiplier: number; priceSource: "official" | "onchain_pool" | "jupiter_quote"; createdAt: string };
type Store = { version: 1; receipts: Record<string, StoredReceipt> };
async function read(): Promise<Store> { const value = await readJson<Store>("receipts"); return { version: 1, receipts: value?.receipts ?? {} }; }
async function write(store: Store) { await writeJson("receipts", store); }
export async function saveReceipt(receipt: StoredReceipt) { const store = await read(); store.receipts[receipt.id] = receipt; await write(store); return receipt; }
export async function getReceipt(id: string, wallet: string) { const store = await read(); const receipt = store.receipts[id]; return receipt?.wallet === wallet ? receipt : null; }
