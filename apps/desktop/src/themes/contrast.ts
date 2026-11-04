type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(h, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function linearToGamma(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** OKLCH (L 0–1, C, H degrees) → gamma-encoded sRGB 0–1, clipped to gamut. */
export function oklchToSrgb(l: number, c: number, h: number): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  return [clamp01(linearToGamma(r)), clamp01(linearToGamma(g)), clamp01(linearToGamma(bl))];
}

function parseOklch(value: string): Rgb {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.%]+\s*)?\)$/i.exec(
    value.trim(),
  );
  if (!match) {
    throw new Error(`Invalid oklch color: ${value}`);
  }
  const lightness = Number(match[1]) / (match[2] === "%" ? 100 : 1);
  return oklchToSrgb(lightness, Number(match[3]), Number(match[4]));
}

/** Parses `#rgb`, `#rrggbb` or `oklch(L C H)` into gamma-encoded sRGB channels (0–1). */
export function parseColor(value: string): Rgb {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return parseHex(trimmed);
  if (trimmed.toLowerCase().startsWith("oklch(")) return parseOklch(trimmed);
  throw new Error(`Unsupported color syntax for contrast checks: ${value}`);
}

function channelToLinear(s: number): number {
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. Result in [0, 1]. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG contrast ratio (1–21). Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Hex rendering of a parsed color, for display and native APIs that need sRGB. */
export function toHex(color: string): string {
  return `#${parseColor(color)
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export type ContrastBand = "FAIL" | "AA-large" | "AA" | "AAA";

export function classifyContrast(ratio: number): ContrastBand {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "FAIL";
}
