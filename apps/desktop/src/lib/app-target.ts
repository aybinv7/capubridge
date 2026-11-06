import type { CDPTarget } from "@/types/cdp.types";

const APP_URL_SCHEME = "android-app://";

/** The stable id of the app target for `packageName` on `serial`. */
export function appTargetId(serial: string, packageName: string): string {
  return `app:${serial}:${packageName}`;
}

/**
 * A debuggable Android app picked as a whole, without a WebView: everything about it is read over
 * ADB (`run-as`, `dumpsys`, logcat), so it has no DevTools endpoint.
 */
export function createAppTarget(
  serial: string,
  packageName: string,
  label: string | null = null,
): CDPTarget {
  return {
    id: appTargetId(serial, packageName),
    type: "app",
    title: label?.trim() || packageName,
    url: `${APP_URL_SCHEME}${packageName}`,
    source: "adb",
    deviceSerial: serial,
    packageName,
  };
}

/** True for an app picked without a WebView. */
export function isNativeAppTarget(target: Pick<CDPTarget, "type"> | null | undefined): boolean {
  return target?.type === "app";
}

/** True when a DevTools session can be opened on the target right now. */
export function hasDevToolsEndpoint(
  target: Pick<CDPTarget, "type" | "webSocketDebuggerUrl"> | null | undefined,
): boolean {
  return Boolean(target && target.type !== "app" && target.webSocketDebuggerUrl);
}

export interface AppTargetsInput {
  serial: string;
  /** Debuggable packages on the device, as the last scan reported them. */
  packages: readonly string[];
  /** The device's WebView targets; an app that has one is picked through its WebView. */
  webviewTargets: readonly CDPTarget[];
  labels: Readonly<Record<string, string>>;
  /** The selected app target's package, kept even once a WebView of it shows up. */
  keepPackage: string | null;
}

/**
 * The app targets of one device: each debuggable package with no live WebView, plus the selected
 * one so a running selection never vanishes from under the user.
 */
export function buildAppTargets(input: AppTargetsInput): CDPTarget[] {
  const withWebView = new Set(
    input.webviewTargets
      .filter((target) => target.deviceSerial === input.serial && target.type !== "app")
      .map((target) => target.packageName?.split(":")[0]?.trim())
      .filter((name): name is string => Boolean(name)),
  );
  return input.packages
    .filter((name) => !withWebView.has(name) || name === input.keepPackage)
    .map((name) => createAppTarget(input.serial, name, input.labels[name] ?? null));
}
