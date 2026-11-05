import type { AdbPackage } from "@/types/adb.types";
import { appDisplayName } from "@/shared/apps/appIdentity";
import { compareText } from "@/shared/format/collator";

export type AppScope = "third-party" | "system" | "all";
export type AppSortKey = "name" | "package";

export interface AppSort {
  key: AppSortKey;
  desc: boolean;
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
