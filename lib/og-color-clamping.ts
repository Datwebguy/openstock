export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const CURATED_SWATCHES = [
  { id: "purple", label: "Purple", hex: "#9945ff" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "green", label: "Green", hex: "#10b981" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
] as const;

export const DEFAULT_ACCENT_HEX = "#9945ff";

/**
 * Validates strictly whether input is a valid 6-digit hex code
 * (with or without leading #)
 */
export function isValidHex6(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  return /^[0-9a-fA-F]{6}$/.test(clean);
}

/**
 * Sanitizes to clean 6-digit hex without #
 */
export function sanitizeHex6(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  return /^[0-9a-fA-F]{6}$/.test(clean) ? clean.toLowerCase() : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): RGB {
  let clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = (h % 360) / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Calculates WCAG 2.1 relative luminance
 */
export function getRelativeLuminance(rgb: RGB): number {
  const srgb = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Calculates contrast ratio between two RGB colors (1:1 to 21:1)
 */
export function getContrastRatio(rgb1: RGB, rgb2: RGB): number {
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export interface ClampedColorInfo {
  accentHex: string;
  accentRgb: RGB;
  accentHsl: HSL;
  bgHex: string;
  bgRgb: RGB;
  glowRgba: string;
  subtleGlowRgba: string;
  contrastRatio: number; // Against pure white ticker text
}

/**
 * Applies strict color clamping:
 * - Saturation clamped between 55% and 90%
 * - Lightness clamped between 45% and 65%
 * - Generates tinted near-black background and verifies contrast >= 4.5:1 with white ticker
 */
export function clampAccentColor(inputHex: string): ClampedColorInfo {
  const cleanHex = inputHex.startsWith("#") ? inputHex : `#${inputHex}`;
  const rgb = hexToRgb(cleanHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Requirement: saturation between 55% and 90%, lightness between 45% and 65%
  const clampedS = Math.max(55, Math.min(90, hsl.s));
  const clampedL = Math.max(45, Math.min(65, hsl.l));

  const clampedHsl: HSL = {
    h: hsl.h,
    s: clampedS,
    l: clampedL,
  };

  const clampedRgb = hslToRgb(clampedHsl.h, clampedHsl.s, clampedHsl.l);
  const clampedHex = rgbToHex(clampedRgb.r, clampedRgb.g, clampedRgb.b);

  // Background: Near-black base (#07050d) tinted with the accent color
  let bgR = Math.round(7 + clampedRgb.r * 0.035);
  let bgG = Math.round(5 + clampedRgb.g * 0.035);
  let bgB = Math.round(13 + clampedRgb.b * 0.045);
  let bgRgb: RGB = { r: bgR, g: bgG, b: bgB };

  // Verify contrast against pure white text (#ffffff) >= 4.5:1
  const whiteRgb: RGB = { r: 255, g: 255, b: 255 };
  let contrast = getContrastRatio(whiteRgb, bgRgb);

  // If contrast is below 4.5:1, darken background
  if (contrast < 4.5) {
    bgR = Math.round(bgR * 0.5);
    bgG = Math.round(bgG * 0.5);
    bgB = Math.round(bgB * 0.5);
    bgRgb = { r: bgR, g: bgG, b: bgB };
    contrast = getContrastRatio(whiteRgb, bgRgb);
  }

  const bgHex = rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b);

  return {
    accentHex: clampedHex,
    accentRgb: clampedRgb,
    accentHsl: clampedHsl,
    bgHex,
    bgRgb,
    glowRgba: `rgba(${clampedRgb.r}, ${clampedRgb.g}, ${clampedRgb.b}, 0.28)`,
    subtleGlowRgba: `rgba(${clampedRgb.r}, ${clampedRgb.g}, ${clampedRgb.b}, 0.12)`,
    contrastRatio: Number(contrast.toFixed(2)),
  };
}
