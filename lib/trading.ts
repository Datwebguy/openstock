export function liveTradingEnabled() {
  return Boolean(process.env.JUPITER_API_KEY);
}
