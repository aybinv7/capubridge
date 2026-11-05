import type { AdbPackageDetails } from "@/types/adb.types";
import type { AppCapacitorInfo } from "@/types/app-inspector.types";
import { knownValue } from "@/shared/apps/appIdentity";
import type { Fact } from "@/shared/facts/fact";
import { installDateWords, updateDateWords } from "@/shared/format/dates";
import type { WebViewRuntime } from "../runtime/runtimeProbe";

export interface AppFactsInput {
  packageName: string;
  details: AdbPackageDetails | undefined;
  pageUrl: string | null;
  pageTitle: string | null;
  runtime: WebViewRuntime | undefined;
  capacitor: AppCapacitorInfo | null;
  pid: number | null;
  running: boolean | null;
}

/** The page's origin, or the address itself when it has none (a `file:` or `data:` page). */
export function pageOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const origin = new URL(url).origin;
    return origin && origin !== "null" ? origin : url;
  } catch {
    return url;
  }
}

/** "Version 2.3.1 (45)", or `null` when the phone did not say. */
export function versionWords(details: AdbPackageDetails | undefined): string | null {
  const name = knownValue(details?.versionName);
  if (!name) return null;
  const code = knownValue(details?.versionCode);
  return code ? `${name} (${code})` : name;
}

/**
 * What the page reports about its bridge, else what the package suggests: Capacitor with its
 * plugins, Cordova, or no bridge found.
 */
export function runtimeWords(
  runtime: WebViewRuntime | undefined,
  capacitor: AppCapacitorInfo | null,
): { value: string; detail?: string; hint?: string; quiet?: boolean } | null {
  const bridge = runtime?.capacitor;
  if (bridge) {
    const count = bridge.plugins.length;
    return {
      value: bridge.native ? "Capacitor" : "Capacitor, running as a web page",
      detail: count ? `${count} plugin${count === 1 ? "" : "s"}` : undefined,
      hint: count ? bridge.plugins.join(", ") : undefined,
    };
  }
  if (runtime?.cordova) return { value: "Cordova" };
  if (capacitor?.isCapacitor) {
    return {
      value: capacitor.version ? `Capacitor ${capacitor.version}` : "Capacitor",
      detail: "from the package",
      hint: capacitor.bridgeActivity ?? undefined,
    };
  }
  if (runtime) return { value: "No Capacitor or Cordova bridge on the page", quiet: true };
  return null;
}

/** The lines of "About this app", only those the phone or the page actually reported. */
export function appFacts(input: AppFactsInput, now = Date.now()): Fact[] {
  const facts: Fact[] = [
    {
      key: "package",
      label: "Package",
      value: input.packageName,
      mono: true,
      quiet: true,
      copy: input.packageName,
    },
  ];
  const version = versionWords(input.details);
  if (version) {
    facts.push({
      key: "version",
      label: "Version",
      value: version,
      mono: true,
      copy: knownValue(input.details?.versionName) ?? undefined,
    });
  }
  const target = input.details?.targetSdkVersion;
  const min = input.details?.minSdkVersion;
  if (target || min) {
    facts.push({
      key: "android",
      label: "Android",
      value: `Targets API ${target ?? "?"}, runs from API ${min ?? "?"}`,
    });
  }
  const installer = knownValue(input.details?.installerPackageName);
  if (installer) {
    facts.push({ key: "installer", label: "Installed by", value: installer, mono: true });
  }
  const installedRaw = knownValue(input.details?.firstInstallTime);
  const installed = installDateWords(installedRaw, now);
  if (installed) {
    facts.push({
      key: "installed",
      label: "Installed",
      value: installed,
      hint: installedRaw ?? undefined,
    });
  }
  const updatedRaw = knownValue(input.details?.lastUpdateTime);
  const updated = updateDateWords(installedRaw, updatedRaw, now);
  if (updated) {
    facts.push({ key: "updated", label: "Updated", value: updated, hint: updatedRaw ?? undefined });
  }
  const origin = pageOrigin(input.pageUrl);
  if (origin) {
    facts.push({
      key: "page",
      label: "Page",
      value: origin,
      detail: input.pageTitle?.trim() || undefined,
      mono: true,
      hint: input.pageUrl ?? undefined,
      copy: input.pageUrl ?? undefined,
    });
  }
  if (input.runtime?.webViewVersion) {
    facts.push({
      key: "webview",
      label: "WebView",
      value: `Chrome ${input.runtime.webViewVersion}`,
      hint: input.runtime.userAgent ?? undefined,
      copy: input.runtime.userAgent ?? undefined,
    });
  }
  const runtime = runtimeWords(input.runtime, input.capacitor);
  if (runtime) facts.push({ key: "runtime", label: "Bridge", ...runtime });
  if (input.running !== null) {
    facts.push({
      key: "process",
      label: "Process",
      value: input.running && input.pid !== null ? `PID ${input.pid}` : "Not running",
      mono: input.running === true,
      quiet: !input.running,
      copy: input.running && input.pid !== null ? String(input.pid) : undefined,
    });
  }
  return facts;
}
