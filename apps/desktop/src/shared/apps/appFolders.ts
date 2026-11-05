import type { AdbPackage, AdbPackageDetails } from "@/types/adb.types";
import { knownValue } from "./appIdentity";

export interface AppFolder {
  key: string;
  label: string;
  path: string;
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
