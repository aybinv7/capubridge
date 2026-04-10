import { computed } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useAdb, type PackageListScope } from "./useAdb";
import type { AdbPackage } from "@/types/adb.types";

export type PackageFetchScope = PackageListScope;

interface CachedPackagesRecord {
  serial: string;
  scope: PackageFetchScope;
  updatedAt: number;
  packages: AdbPackage[];
}

export const PACKAGE_CACHE_STALE_MS = 60_000;
const PACKAGE_CACHE_PREFIX = "capubridge:device-apps:v1";

/**
 * Gets the localStorage key for a specific device and scope.
 */
function getPackagesCacheKey(serial: string, scope: PackageFetchScope): string {
  return `${PACKAGE_CACHE_PREFIX}:${serial}:${scope}`;
}

/**
 * Reads the package cache from localStorage.
 */
function readPackagesCache(serial: string, scope: PackageFetchScope): CachedPackagesRecord | null {
  try {
    const raw = localStorage.getItem(getPackagesCacheKey(serial, scope));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedPackagesRecord>;
    if (
      parsed.serial !== serial ||
      parsed.scope !== scope ||
      typeof parsed.updatedAt !== "number" ||
      !Array.isArray(parsed.packages)
    ) {
      return null;
    }

    return {
      serial,
      scope,
      updatedAt: parsed.updatedAt,
      packages: parsed.packages as AdbPackage[],
    };
  } catch {
    return null;
  }
}

/**
 * Writes the package list to localStorage.
 */
function writePackagesCache(
  serial: string,
  scope: PackageFetchScope,
  packages: AdbPackage[],
  updatedAt: number,
) {
  try {
    const payload: CachedPackagesRecord = {
      serial,
      scope,
      updatedAt,
      packages,
    };
    localStorage.setItem(getPackagesCacheKey(serial, scope), JSON.stringify(payload));
  } catch {}
}

/**
 * Removes a specific package cache entry.
 */
function removePackagesCache(serial: string, scope: PackageFetchScope) {
  try {
    localStorage.removeItem(getPackagesCacheKey(serial, scope));
  } catch {
    // Ignore remove failures
  }
}

/**
 * Reads the package cache, automatically falling back to "all" if "third-party" is requested but not found.
 */
function readScopedPackagesCache(
  serial: string,
  scope: PackageFetchScope,
): CachedPackagesRecord | null {
  if (scope === "all") {
    return readPackagesCache(serial, "all");
  }

  const thirdParty = readPackagesCache(serial, "third-party");
  if (thirdParty) return thirdParty;

  const all = readPackagesCache(serial, "all");
  if (!all) return null;

  return {
    serial,
    scope: "third-party",
    updatedAt: all.updatedAt,
    packages: all.packages.filter((entry) => !entry.system),
  };
}

/**
 * Shared composable for managing Android app packages and their metadata.
 */
export function useAppPackages(serial: { value: string } | string) {
  const queryClient = useQueryClient();
  const { listPackages } = useAdb();

  const activeSerial = computed(() => {
    return typeof serial === "string" ? serial : serial.value;
  });

  /**
   * TanStack Query hook for fetching packages for the current device.
   */
  function usePackages(scope: PackageFetchScope = "third-party") {
    return useQuery({
      queryKey: computed(() => ["packages", activeSerial.value, scope]),
      queryFn: async () => {
        const s = activeSerial.value;
        if (!s) return [];

        const nextPackages = await listPackages(s, scope);
        const updatedAt = Date.now();
        writePackagesCache(s, scope, nextPackages, updatedAt);

        // If we fetched "all", also update the "third-party" cache and query data
        if (scope === "all") {
          const thirdPartyPackages = nextPackages.filter((entry) => !entry.system);
          writePackagesCache(s, "third-party", thirdPartyPackages, updatedAt);
          queryClient.setQueryData(["packages", s, "third-party"], thirdPartyPackages);
        }

        return nextPackages;
      },
      enabled: computed(() => !!activeSerial.value),
      staleTime: PACKAGE_CACHE_STALE_MS,
      gcTime: 24 * 60 * 60 * 1000,
      initialData: () => {
        const s = activeSerial.value;
        if (!s) return undefined;
        return readScopedPackagesCache(s, scope)?.packages;
      },
      initialDataUpdatedAt: () => {
        const s = activeSerial.value;
        if (!s) return undefined;
        return readScopedPackagesCache(s, scope)?.updatedAt;
      },
    });
  }

  /**
   * Forces a refresh of the package cache.
   */
  async function refreshPackages(scope: PackageFetchScope = "third-party") {
    const s = activeSerial.value;
    if (!s) return;

    removePackagesCache(s, scope);
    if (scope === "all") {
      removePackagesCache(s, "third-party");
      queryClient.removeQueries({
        queryKey: ["packages", s, "third-party"],
        exact: true,
      });
    }

    await queryClient.invalidateQueries({
      queryKey: ["packages", s, scope],
    });
  }

  /**
   * Gets specific package info from the cache or current query data.
   */
  function getCachedPackage(packageName: string): AdbPackage | null {
    const s = activeSerial.value;
    if (!s) return null;

    // Check query data first for most up-to-date in-memory state
    const scopes: PackageFetchScope[] = ["third-party", "all"];
    for (const scope of scopes) {
      const data = queryClient.getQueryData<AdbPackage[]>(["packages", s, scope]);
      if (data) {
        const pkg = data.find((p) => p.packageName === packageName);
        if (pkg) return pkg;
      }
    }

    // Fallback to localStorage cache
    for (const scope of scopes) {
      const cache = readPackagesCache(s, scope);
      if (cache) {
        const pkg = cache.packages.find((p) => p.packageName === packageName);
        if (pkg) return pkg;
      }
    }

    return null;
  }

  return {
    PACKAGE_CACHE_STALE_MS,
    usePackages,
    refreshPackages,
    getCachedPackage,
    readPackagesCache,
    readScopedPackagesCache,
  };
}
