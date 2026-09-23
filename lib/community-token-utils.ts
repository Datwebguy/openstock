export function formatTokenPrice(price: number): string {
  if (!price || Number.isNaN(price) || price <= 0) return "$0.00";
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }
  if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  }
  // Sub-micro tokens (e.g. 0.0000198 or 0.00000273)
  const str = price.toFixed(8);
  const trimmed = str.replace(/0+$/, "").replace(/\.$/, "");
  return `$${trimmed}`;
}

export function formatTokenVolume(volume: number): string {
  if (!volume || Number.isNaN(volume) || volume <= 0) return "$0";
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(volume).toLocaleString()}`;
}
