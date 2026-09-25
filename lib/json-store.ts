import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Durable JSON document store.
 * - Production: Upstash Redis REST (UPSTASH_REDIS_REST_URL/TOKEN, or the Vercel KV aliases KV_REST_API_URL/TOKEN).
 * - Local dev: JSON files under .data/.
 * - Serverless without Redis: throws StoreUnavailableError — never writes to a read-only or ephemeral disk.
 */

export class StoreUnavailableError extends Error {
  constructor() {
    super("Storage is not configured on this deployment. Try again later.");
    this.name = "StoreUnavailableError";
  }
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const KEY_PREFIX = "openstock:";
const DATA_DIR = path.join(process.cwd(), ".data");

export function redisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

function serverless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function redis<T>(command: (string | number)[]): Promise<T> {
  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!response.ok || payload.error) {
    console.error("Redis command failed", command[0], response.status, payload.error);
    throw new StoreUnavailableError();
  }
  return payload.result as T;
}

function filePath(name: string) {
  return path.join(DATA_DIR, name.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".json");
}

export async function readRaw(name: string): Promise<string | null> {
  if (redisConfigured()) return redis<string | null>(["GET", KEY_PREFIX + name]);
  if (serverless()) throw new StoreUnavailableError();
  try {
    return await fs.readFile(filePath(name), "utf8");
  } catch {
    return null;
  }
}

export async function writeRaw(name: string, value: string): Promise<void> {
  if (redisConfigured()) {
    await redis(["SET", KEY_PREFIX + name, value]);
    return;
  }
  if (serverless()) throw new StoreUnavailableError();
  const target = filePath(name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = target + "." + process.pid + ".tmp";
  await fs.writeFile(temporary, value, "utf8");
  await fs.rename(temporary, target);
}

export async function readJson<T>(name: string): Promise<Partial<T> | null> {
  const raw = await readRaw(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  await writeRaw(name, JSON.stringify(value));
}

/** Message safe to return to clients: never leaks filesystem paths or upstream errors. */
export function publicStoreError(error: unknown, fallback: string): string {
  if (error instanceof StoreUnavailableError) return error.message;
  if (error instanceof Error && !/ENOENT|EROFS|EACCES|\/var\/|\\|\.data/.test(error.message)) return error.message;
  return fallback;
}
