export function liveTradingEnabled() {
  return Boolean(process.env.JUPITER_API_KEY) && process.env.ENABLE_LIVE_TRADING !== "false";
}
