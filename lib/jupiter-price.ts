const JUPITER_PRICE_URL = process.env.JUPITER_PRICE_URL ?? "https://api.jup.ag/price/v3";
const JUPITER_PUBLIC_PRICE_URL = "https://lite-api.jup.ag/price/v3";

/** Jupiter Price v3. If the keyed endpoint rejects the request, retry the public one instead of reporting price 0. */
export async function fetchJupiterPrices(ids: string[], timeoutMs: number): Promise<Record<string, any>> {
  const attempt = async (url: string, withKey: boolean) => {
    const res = await fetch(`${url}?ids=${ids.join(",")}`, {
      headers: withKey && process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Jupiter price ${res.status}`);
    return (await res.json()) as Record<string, any>;
  };
  try {
    return await attempt(JUPITER_PRICE_URL, true);
  } catch (err) {
    console.warn("Jupiter price (configured) failed, trying public endpoint:", err instanceof Error ? err.message : err);
    return attempt(JUPITER_PUBLIC_PRICE_URL, false).catch(() => ({}));
  }
}
