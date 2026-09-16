export function liveTradingEnabled() {
  return process.env.ENABLE_LIVE_TRADING !== "false";
}
