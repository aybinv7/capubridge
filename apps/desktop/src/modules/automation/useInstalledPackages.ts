import { ref } from "vue";
import { invokeCommand } from "@/runtime/ipc/client";
import type { AdbPackage } from "@/types/adb.types";

export interface AgentAppPackage {
  packageName: string;
  label: string;
  iconPath: string | null;
}

const packageCache = new Map<string, AgentAppPackage[]>();

export function cachedPackages(serial: string): string[] {
  return (packageCache.get(serial) ?? []).map((entry) => entry.packageName);
}

export function setCachedPackages(serial: string, packages: string[]): void {
  packageCache.set(
    serial,
    packages.map((packageName) => ({ packageName, label: packageName, iconPath: null })),
  );
}

export function setCachedPackageDetails(serial: string, packages: AdbPackage[]): void {
  packageCache.set(
    serial,
    packages
      .filter((entry) => entry.enabled && !entry.system)
      .map((entry) => ({
        packageName: entry.packageName,
        label: entry.label?.trim() || entry.packageName,
        iconPath: entry.iconPath ?? null,
      })),
  );
}

export function clearPackageCache(serial?: string): void {
  if (serial === undefined) {
    packageCache.clear();
    return;
  }
  packageCache.delete(serial);
}

export function useInstalledPackages() {
  const packages = ref<AgentAppPackage[]>([]);
  const isLoading = ref(false);

  async function load(serial: string): Promise<AgentAppPackage[]> {
    const hit = packageCache.get(serial);
    if (hit !== undefined) {
      packages.value = hit;
      return hit;
    }
    isLoading.value = true;
    try {
      const rows = await invokeCommand("session_list_packages", { serial, scope: "third-party" });
      setCachedPackageDetails(serial, rows);
      const resolved = packageCache.get(serial) ?? [];
      packages.value = resolved;
      return resolved;
    } catch {
      packages.value = [];
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  return { packages, isLoading, load };
}
