export type ViewportKind = "phone" | "tablet" | "desktop";

export interface ViewportPreset {
  id: string;
  label: string;
  kind: ViewportKind;
  width: number;
  height: number;
  dpr: number;
}

export const RESPONSIVE_ID = "responsive";

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  { id: "iphone-se", label: "iPhone SE", kind: "phone", width: 375, height: 667, dpr: 2 },
  { id: "iphone-15", label: "iPhone 15", kind: "phone", width: 393, height: 852, dpr: 3 },
  {
    id: "iphone-15-pro-max",
    label: "iPhone 15 Pro Max",
    kind: "phone",
    width: 430,
    height: 932,
    dpr: 3,
  },
  { id: "pixel-8", label: "Pixel 8", kind: "phone", width: 412, height: 915, dpr: 2.625 },
  { id: "galaxy-s24", label: "Galaxy S24", kind: "phone", width: 360, height: 780, dpr: 3 },
  { id: "ipad-mini", label: "iPad mini", kind: "tablet", width: 768, height: 1024, dpr: 2 },
  { id: "ipad-air", label: "iPad Air", kind: "tablet", width: 820, height: 1180, dpr: 2 },
  { id: "galaxy-tab-s9", label: "Galaxy Tab S9", kind: "tablet", width: 800, height: 1280, dpr: 2 },
  { id: "laptop", label: "Laptop", kind: "desktop", width: 1280, height: 800, dpr: 1 },
  { id: "desktop-hd", label: "Desktop HD", kind: "desktop", width: 1440, height: 900, dpr: 1 },
  {
    id: "desktop-fhd",
    label: "Desktop Full HD",
    kind: "desktop",
    width: 1920,
    height: 1080,
    dpr: 1,
  },
];

export const VIEWPORT_KIND_LABELS: Record<ViewportKind, string> = {
  phone: "Phones",
  tablet: "Tablets",
  desktop: "Desktops",
};

export const VIEWPORT_LIMITS = { min: 240, max: 3840 } as const;

/** What the user picked: a device, or a free size they set themselves. */
export interface WebViewport {
  presetId: string;
  width: number;
  height: number;
  rotated: boolean;
}

/** What the page is emulated as once the pick is resolved. */
export interface ViewportMetrics {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  label: string;
}

export const DEFAULT_WEB_VIEWPORT: WebViewport = {
  presetId: RESPONSIVE_ID,
  width: 390,
  height: 844,
  rotated: false,
};

/** Below this width a free-size page is treated as a touch device, like Chrome's device mode. */
const MOBILE_BREAKPOINT = 820;

export function clampViewportSide(value: number): number {
  if (!Number.isFinite(value)) return VIEWPORT_LIMITS.min;
  return Math.round(Math.min(VIEWPORT_LIMITS.max, Math.max(VIEWPORT_LIMITS.min, value)));
}

export function findPreset(id: string): ViewportPreset | null {
  return VIEWPORT_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function isWebViewport(value: unknown): value is WebViewport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.presetId === "string" &&
    (candidate.presetId === RESPONSIVE_ID || findPreset(candidate.presetId) !== null) &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    typeof candidate.rotated === "boolean"
  );
}

export function resolveViewport(viewport: WebViewport): ViewportMetrics {
  const preset = findPreset(viewport.presetId);
  if (!preset) {
    const width = clampViewportSide(viewport.width);
    const height = clampViewportSide(viewport.height);
    return { width, height, dpr: 1, mobile: width < MOBILE_BREAKPOINT, label: "Responsive" };
  }
  const [width, height] = viewport.rotated
    ? [preset.height, preset.width]
    : [preset.width, preset.height];
  return { width, height, dpr: preset.dpr, mobile: preset.kind !== "desktop", label: preset.label };
}

export function choosePreset(current: WebViewport, presetId: string): WebViewport {
  if (presetId === RESPONSIVE_ID) {
    const metrics = resolveViewport(current);
    return { presetId, width: metrics.width, height: metrics.height, rotated: false };
  }
  return findPreset(presetId) ? { ...current, presetId, rotated: false } : current;
}

/** Typing a size or dragging an edge turns any pick into a free size, as Chrome does. */
export function resizeViewport(width: number, height: number): WebViewport {
  return {
    presetId: RESPONSIVE_ID,
    width: clampViewportSide(width),
    height: clampViewportSide(height),
    rotated: false,
  };
}

export function rotateViewport(current: WebViewport): WebViewport {
  if (findPreset(current.presetId)) return { ...current, rotated: !current.rotated };
  return { ...current, width: current.height, height: current.width };
}
