import { promises as fs } from "node:fs";
import path from "node:path";

export type StoredReceipt = { id: string; wallet: string; signature: string; symbol: string; name: string; side: "buy" | "sell"; shares: number; referencePrice: number; multiplier: number; priceSource: "official" | "onchain_pool"; createdAt: string };
type Store = { version: 1; receipts: Record<string, StoredReceipt> };
const PATH = process.env.OPENSTOCK_RECEIPT_STORE_PATH ?? path.join(process.cwd(), ".data", "receipts.json");
async function read(): Promise<Store> { try { const value = JSON.parse(await fs.readFile(PATH, "utf8")) as Partial<Store>; return { version: 1, receipts: value.receipts ?? {} }; } catch { return { version: 1, receipts: {} }; } }
async function write(store: Store) { await fs.mkdir(path.dirname(PATH), { recursive: true }); const temporary = PATH + "." + process.pid + ".tmp"; await fs.writeFile(temporary, JSON.stringify(store, null, 2), "utf8"); await fs.rename(temporary, PATH); }
export async function saveReceipt(receipt: StoredReceipt) { const store = await read(); store.receipts[receipt.id] = receipt; await write(store); return receipt; }
export async function getReceipt(id: string, wallet: string) { const store = await read(); const receipt = store.receipts[id]; return receipt?.wallet === wallet ? receipt : null; }
