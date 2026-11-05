/** What the page itself says about its runtime, read once over DevTools. */
export interface WebViewRuntime {
  userAgent: string | null;
  /** Chromium version of the system WebView, e.g. "131.0.6778.81". */
  webViewVersion: string | null;
  capacitor: { platform: string | null; native: boolean; plugins: string[] } | null;
  cordova: boolean;
}

/** Read-only page expression: it only reads `navigator` and the bridge globals. */
export const RUNTIME_PROBE_EXPRESSION = `(() => {
  const cap = globalThis.Capacitor;
  let plugins = [];
  try { plugins = cap && cap.Plugins ? Object.keys(cap.Plugins) : []; } catch (e) { plugins = []; }
  let platform = null;
  try { platform = cap && typeof cap.getPlatform === "function" ? cap.getPlatform() : null; } catch (e) { platform = null; }
  let native = false;
  try { native = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()); } catch (e) { native = false; }
  return {
    userAgent: navigator.userAgent,
    capacitor: cap ? { platform, native, plugins } : null,
    cordova: typeof globalThis.cordova !== "undefined",
  };
})()`;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The Chromium version in a WebView user agent ("Chrome/131.0.6778.81"), or `null`. */
export function webViewVersionOf(userAgent: string | null): string | null {
  const match = userAgent?.match(/Chrome\/([\d.]+)/);
  return match?.[1] ?? null;
}

/** Checks the probe's answer field by field; anything malformed reads as unknown. */
export function parseRuntimeProbe(value: unknown): WebViewRuntime {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const userAgent = text(record.userAgent);
  const rawCapacitor =
    record.capacitor && typeof record.capacitor === "object"
      ? (record.capacitor as Record<string, unknown>)
      : null;
  const plugins = Array.isArray(rawCapacitor?.plugins)
    ? rawCapacitor.plugins.filter((name): name is string => typeof name === "string").sort()
    : [];
  return {
    userAgent,
    webViewVersion: webViewVersionOf(userAgent),
    capacitor: rawCapacitor
      ? { platform: text(rawCapacitor.platform), native: rawCapacitor.native === true, plugins }
      : null,
    cordova: record.cordova === true,
  };
}
