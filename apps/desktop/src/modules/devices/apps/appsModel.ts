import type { AdbPackage, AdbPackageDetails } from "@/types/adb.types";
import type { DeviceConfirmRequest } from "../shared/confirm";
import { compareText } from "../shared/collator";

export type AppScope = "third-party" | "system" | "all";
export type AppAction = "forceStop" | "clearData" | "uninstall";
export type AppSortKey = "name" | "package";

export interface AppSort {
  key: AppSortKey;
  desc: boolean;
}

/** The app an action is about: what to call it, and whether it came with the phone. */
export interface AppActionSubject {
  name: string;
  packageName: string;
  system: boolean;
}

export interface AppFolder {
  key: string;
  label: string;
  path: string;
}

/** A value the phone reported, or `null` when it sent nothing or the word "null". */
export function knownValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "null" ? trimmed : null;
}

/** The name a person knows the app by, or its package when it has no label. */
export function appDisplayName(app: Pick<AdbPackage, "label" | "packageName">): string {
  const label = app.label?.trim();
  return label ? label : app.packageName;
}

/** Apps in the chosen order; ties fall back to the package name so the order never jumps. */
export function sortApps(packages: readonly AdbPackage[], sort: AppSort): AdbPackage[] {
  const keyed = packages.map((app) => ({
    app,
    key: sort.key === "name" ? appDisplayName(app) : app.packageName,
  }));
  keyed.sort(
    (a, b) => compareText(a.key, b.key) || compareText(a.app.packageName, b.app.packageName),
  );
  const ordered = keyed.map((entry) => entry.app);
  return sort.desc ? ordered.reverse() : ordered;
}

/** Whether `scope` shows `app`; an app the listing does not have is only shown by All. */
export function scopeShowing(scope: AppScope, app: Pick<AdbPackage, "system"> | null): boolean {
  if (scope === "all") return true;
  if (!app) return false;
  return scope === "system" ? app.system : !app.system;
}

/** Keeps the apps in scope whose name or package contains the query, case-insensitively. */
export function filterApps(
  packages: readonly AdbPackage[],
  scope: AppScope,
  query: string,
): AdbPackage[] {
  const needle = query.trim().toLowerCase();
  return packages.filter((app) => {
    if (!scopeShowing(scope, app)) return false;
    if (!needle) return true;
    return (
      appDisplayName(app).toLowerCase().includes(needle) ||
      app.packageName.toLowerCase().includes(needle)
    );
  });
}

export interface AppCounts {
  total: number;
  system: number;
  thirdParty: number;
}

export function countApps(packages: readonly AdbPackage[]): AppCounts {
  const system = packages.reduce((sum, app) => sum + (app.system ? 1 : 0), 0);
  return { total: packages.length, system, thirdParty: packages.length - system };
}

/** App, data and cache added up, or `null` when the phone reported none of them. */
export function totalAppSize(details: AdbPackageDetails | undefined | null): number | null {
  if (!details) return null;
  const parts = [details.appSize, details.dataSize, details.cacheSize].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return parts.length ? parts.reduce((sum, value) => sum + value, 0) : null;
}

function parentFolder(path: string | null | undefined): string | null {
  if (!path) return null;
  const clean = path.replace(/\/+$/, "");
  const slash = clean.lastIndexOf("/");
  return slash > 0 ? clean.slice(0, slash) : null;
}

/** The app's folders worth opening in Files, with the usual locations as fallbacks, no duplicates. */
export function appFolders(app: AdbPackage, details: AdbPackageDetails | undefined): AppFolder[] {
  const candidates: Array<{ key: string; label: string; path: string | null }> = [
    {
      key: "internal",
      label: "Private data",
      path: knownValue(details?.dataDir) ?? `/data/data/${app.packageName}`,
    },
    {
      key: "external",
      label: "Android/data",
      path: knownValue(details?.externalDataDir) ?? `/sdcard/Android/data/${app.packageName}`,
    },
    { key: "media", label: "Android/media", path: knownValue(details?.mediaDir) },
    { key: "obb", label: "Android/obb", path: knownValue(details?.obbDir) },
    {
      key: "apk",
      label: "Installed package",
      path: parentFolder(knownValue(details?.apkPath) ?? app.apkPath),
    },
  ];
  const seen = new Set<string>();
  const folders: AppFolder[] = [];
  for (const candidate of candidates) {
    if (!candidate.path || seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    folders.push({ key: candidate.key, label: candidate.label, path: candidate.path });
  }
  return folders;
}

/** The word on the uninstall button: system apps can only be removed for the current user. */
export function uninstallLabel(system: boolean): string {
  return system ? "Remove for this user" : "Uninstall";
}

/**
 * The shell command behind each app action. A system app cannot be uninstalled from the system
 * image, so it is removed for the current user instead.
 */
export function appActionCommand(action: AppAction, subject: AppActionSubject): string {
  const pkg = subject.packageName;
  if (action === "forceStop") return `am force-stop ${pkg}`;
  if (action === "clearData") return `pm clear ${pkg}`;
  return subject.system ? `pm uninstall --user current ${pkg}` : `pm uninstall ${pkg}`;
}

/** What the confirmation asks, in plain words. */
export function appActionRequest(
  action: AppAction,
  subject: AppActionSubject,
): DeviceConfirmRequest {
  const name = subject.name;
  if (action === "forceStop") {
    return {
      title: `Force stop ${name}?`,
      text: "Android ends the app's process right away. Unsaved work in the app is lost.",
      confirmLabel: "Force stop",
      danger: false,
    };
  }
  if (action === "clearData") {
    return {
      title: `Clear the data of ${name}?`,
      text: "Deletes the app's data and cache on the phone, as if it was just installed.",
      confirmLabel: "Clear data",
      danger: true,
    };
  }
  if (subject.system) {
    return {
      title: `Remove ${name} for this user?`,
      text: 'It came with the phone, so Android keeps a copy in the system. It disappears for this user with its data, and comes back after a factory reset or with "cmd package install-existing".',
      confirmLabel: "Remove for this user",
      danger: true,
    };
  }
  return {
    title: `Uninstall ${name}?`,
    text: "Removes the app and all of its data from the phone.",
    confirmLabel: "Uninstall",
    danger: true,
  };
}

export interface AppActionOutcome {
  ok: boolean;
  title: string;
  description?: string;
}

/**
 * Reads what the shell said. `pm` prints "Success" when it worked; `am force-stop` prints
 * nothing, so it is taken at its word.
 */
export function appActionOutcome(
  action: AppAction,
  subject: AppActionSubject,
  output: string,
): AppActionOutcome {
  const name = subject.name;
  if (action === "forceStop") return { ok: true, title: `${name} was stopped` };
  const ok = output.toLowerCase().includes("success");
  if (action === "clearData") {
    return ok
      ? { ok, title: `Data of ${name} cleared` }
      : { ok, title: "Could not clear the data", description: output.trim() };
  }
  if (subject.system) {
    return ok
      ? { ok, title: `${name} removed for this user` }
      : { ok, title: `Could not remove ${name}`, description: output.trim() };
  }
  return ok
    ? { ok, title: `${name} uninstalled` }
    : { ok, title: "Could not uninstall", description: output.trim() };
}
