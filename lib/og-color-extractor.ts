import sharp from "sharp";
import {
  clampAccentColor,
  DEFAULT_ACCENT_HEX,
  rgbToHsl,
  rgbToHex,
} from "./og-color-clamping";

export * from "./og-color-clamping";

// In-memory cache for extracted dominant colors per logo URL / mint
const colorExtractionCache = new Map<string, string>();

/**
 * Extracts dominant vibrant color from an image URL on the server.
 * Uses sharp to downsample and analyze non-neutral pixels.
 * Caches results per token/logo URL to prevent recomputation.
 */
export async function extractDominantColor(
  imageUrl: string | null | undefined,
  fallbackHex: string = DEFAULT_ACCENT_HEX
): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return clampAccentColor(fallbackHex).accentHex;
  }

  const cacheKey = imageUrl.trim();
  if (colorExtractionCache.has(cacheKey)) {
    return colorExtractionCache.get(cacheKey)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      colorExtractionCache.set(cacheKey, fallbackHex);
      return clampAccentColor(fallbackHex).accentHex;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Resize to 48x48 RGBA raw pixel stream for speed & high accuracy
    const { data, info } = await sharp(buffer)
      .resize(48, 48, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let bestScore = -1;
    let bestR = 153;
    let bestG = 69;
    let bestB = 255;
    let candidateCount = 0;

    const channels = info.channels;
    for (let i = 0; i < data.length; i += channels) {
      const a = data[i + 3];
      if (a < 128) continue; // Ignore transparent pixels

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const hsl = rgbToHsl(r, g, b);

      // Filter out neutral pixels (near-white, near-black, or low saturation gray)
      if (hsl.l < 15 || hsl.l > 88 || hsl.s < 20) {
        continue;
      }

      // Score based on vibrancy (saturation * non-extreme lightness)
      const lightnessPenalty = 1 - Math.abs(hsl.l - 55) / 50;
      const score = (hsl.s / 100) * lightnessPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestR = r;
        bestG = g;
        bestB = b;
        candidateCount++;
      }
    }

    // If no vibrant candidate was found (e.g. grayscale/black-white logo), use fallback
    if (candidateCount === 0 || bestScore < 0.15) {
      const clampedFallback = clampAccentColor(fallbackHex).accentHex;
      colorExtractionCache.set(cacheKey, clampedFallback);
      return clampedFallback;
    }

    const extractedHex = rgbToHex(bestR, bestG, bestB);
    const finalClampedHex = clampAccentColor(extractedHex).accentHex;

    colorExtractionCache.set(cacheKey, finalClampedHex);
    return finalClampedHex;
  } catch (err) {
    console.warn("Could not extract vibrant color from logo:", imageUrl, err);
    const clampedFallback = clampAccentColor(fallbackHex).accentHex;
    colorExtractionCache.set(cacheKey, clampedFallback);
    return clampedFallback;
  }
}
