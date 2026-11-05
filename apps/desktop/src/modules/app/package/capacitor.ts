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

/**
 * The app's id without the user (`appId=10406` on Android 16, `userId=10234` before), or `null`.
 * Its uid for a user is `user * 100000 + appId`.
 */
export function appIdFromDump(packageDump: string): number | null {
  const match = packageDump.match(/^\s+(?:appId|userId)=(\d+)/m);
  const id = match ? parseInt(match[1] ?? "", 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Whether the package is a system app and whether it is enabled for `user`, from its flags and
 * the user's `enabled=` state (0 default, 1 enabled, 2 and above disabled in some way).
 */
export function packageFlags(
  packageDump: string,
  user: number,
): { system: boolean; enabled: boolean } {
  const flags = packageDump.match(/^\s+(?:pkgFlags|flags)=\[([^\]]*)\]/m)?.[1] ?? "";
  const section = packageDump.match(new RegExp(`^\\s+User ${user}:.*$`, "m"))?.[0] ?? "";
  const state = parseInt(section.match(/\benabled=(\d+)/)?.[1] ?? "0", 10);
  return { system: /\bSYSTEM\b/.test(flags), enabled: !(state >= 2) };
}
