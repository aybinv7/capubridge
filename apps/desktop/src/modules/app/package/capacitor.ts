import type { AppCapacitorInfo } from "@/types/app-inspector.types";

/** Guesses from `dumpsys package` whether the app is built on Capacitor. */
export function detectCapacitor(packageDump: string): AppCapacitorInfo {
  const bridgeMatch = packageDump.match(/([\w.]*BridgeActivity)/);
  const isCapacitor =
    bridgeMatch !== null ||
    packageDump.includes("com.getcapacitor") ||
    packageDump.toLowerCase().includes("capacitor");
  const versionMatch = packageDump.match(/capacitor[^0-9]*(\d+\.\d+\.\d+)/i);
  const plugins = new Set<string>();
  for (const match of packageDump.matchAll(/[\w.]+\.(capacitor|plugin)\.[\w]+/gi)) {
    if (match[0]) plugins.add(match[0]);
  }
  return {
    isCapacitor,
    bridgeActivity: bridgeMatch?.[1] ?? null,
    plugins: [...plugins],
    version: versionMatch?.[1] ?? null,
  };
}

/** The app's Linux user id (`userId=10234`), which keys its traffic counters, or `null`. */
export function uidFromDump(packageDump: string): number | null {
  const match = packageDump.match(/userId=(\d+)/);
  const uid = match ? parseInt(match[1] ?? "", 10) : NaN;
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}
