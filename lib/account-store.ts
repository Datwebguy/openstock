import { promises as fs } from "node:fs";
import path from "node:path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { isSolanaAddress } from "@/lib/solana";

type Challenge = { message: string; expiresAt: string };
type Account = { wallet: string; createdAt: string; verifiedAt: string };
type Session = { wallet: string; expiresAt: string };
type Store = { version: 1; accounts: Record<string, Account>; challenges: Record<string, Challenge>; sessions: Record<string, Session> };

const STORE_PATH = process.env.OPENSTOCK_ACCOUNT_STORE_PATH ?? path.join(process.cwd(), ".data", "accounts.json");
const EMPTY: Store = { version: 1, accounts: {}, challenges: {}, sessions: {} };

function validWallet(wallet: string) { return isSolanaAddress(wallet); }
async function read(): Promise<Store> { try { const data = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as Partial<Store>; return { version: 1, accounts: data.accounts ?? {}, challenges: data.challenges ?? {}, sessions: data.sessions ?? {} }; } catch { return EMPTY; } }
async function write(store: Store) { await fs.mkdir(path.dirname(STORE_PATH), { recursive: true }); const temporary = STORE_PATH + "." + process.pid + ".tmp"; await fs.writeFile(temporary, JSON.stringify(store, null, 2), "utf8"); await fs.rename(temporary, STORE_PATH); }

export async function createChallenge(wallet: string) {
  if (!validWallet(wallet)) throw new Error("Choose a valid Solana wallet first.");
  const store = await read(); const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = "OpenStock wallet verification\nWallet: " + wallet + "\nNonce: " + crypto.randomUUID() + "\nExpires: " + expiresAt;
  store.challenges[wallet] = { message, expiresAt }; await write(store); return message;
}
export async function verifyChallenge(wallet: string, signature: string) {
  if (!validWallet(wallet)) throw new Error("Choose a valid Solana wallet first.");
  const store = await read(); const challenge = store.challenges[wallet];
  if (!challenge || new Date(challenge.expiresAt).getTime() < Date.now()) throw new Error("Your verification request expired. Try again.");
  let verified = false; try { verified = nacl.sign.detached.verify(new TextEncoder().encode(challenge.message), bs58.decode(signature), bs58.decode(wallet)); } catch { verified = false; }
  if (!verified) throw new Error("That signature could not be verified.");
  const now = new Date().toISOString(); store.accounts[wallet] = store.accounts[wallet] ?? { wallet, createdAt: now, verifiedAt: now }; store.accounts[wallet].verifiedAt = now; delete store.challenges[wallet];
  const sessionId = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""); store.sessions[sessionId] = { wallet, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
  await write(store); return { account: store.accounts[wallet], sessionId };
}
export async function accountFromSession(sessionId: string | null) { if (!sessionId) return null; const store = await read(); const session = store.sessions[sessionId]; if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null; return store.accounts[session.wallet] ?? null; }
