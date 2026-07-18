import { computed } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  cancelListPackagesEffect,
  listPackagesEffect,
  refreshPackagesEffect,
  runSessionEffect,
} from "@/runtime/session";
import type { SessionRequestOptions } from "@/runtime/effect/cancellation";
import type { AdbPackage } from "@/types/adb.types";

export type PackageFetchScope = "third-party" | "all";

export const PACKAGE_CACHE_STALE_MS = 60_000;
const PACKAGE_STORAGE_PREFIX = "capubridge:device-apps:v1";

interface StoredPackagesCache {
  packages: AdbPackage[];
  updatedAt: number;
}

export function useAppPackages(serial: { value: string } | string) {
  const queryClient = useQueryClient();

  const activeSerial = computed(() => {
    return typeof serial === "string" ? serial : serial.value;
  });

  function packageQueryKey(scope: PackageFetchScope) {
    return packageQueryKeyFor(activeSerial.value, scope);
  }

  function packageQueryKeyFor(serialValue: string, scope: PackageFetchScope) {
    return ["packages", serialValue, scope];
  }

  function packageStorageKey(serialValue: string, scope: PackageFetchScope) {
    return `${PACKAGE_STORAGE_PREFIX}:${serialValue}:${scope}`;
  }

  function readStoredPackages(
    serialValue: string,
    scope: PackageFetchScope,
  ): StoredPackagesCache | null {
    if (typeof window === "undefined" || !serialValue) {
      return null;
    }

    const raw = window.localStorage.getItem(packageStorageKey(serialValue, scope));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as
        | StoredPackagesCache
        | AdbPackage[]
        | { packages?: AdbPackage[]; updatedAt?: number };
      if (Array.isArray(parsed)) {
        return {
          packages: parsed,
          updatedAt: 0,
        };
      }
      if (!Array.isArray(parsed.packages)) {
        return null;
      }
      return {
        packages: parsed.packages,
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      };
    } catch {
      return null;
    }
  }

  function writeStoredPackages(
    serialValue: string,
    scope: PackageFetchScope,
    packages: AdbPackage[],
    updatedAt: number,
  ) {
    if (typeof window === "undefined" || !serialValue) {
      return;
    }

    try {
      window.localStorage.setItem(
        packageStorageKey(serialValue, scope),
        JSON.stringify({
          packages,
          updatedAt,
        }),
      );
    } catch {
      return;
    }
  }

  function writePackagesCache(
    serialValue: string,
    scope: PackageFetchScope,
    packages: AdbPackage[],
  ) {
    const updatedAt = Date.now();
    queryClient.setQueryData(packageQueryKeyFor(serialValue, scope), packages);
    writeStoredPackages(serialValue, scope, packages, updatedAt);
    if (scope === "all") {
      const thirdPartyPackages = packages.filter((entry) => !entry.system);
      queryClient.setQueryData(packageQueryKeyFor(serialValue, "third-party"), thirdPartyPackages);
      writeStoredPackages(serialValue, "third-party", thirdPartyPackages, updatedAt);
    }
  }

  async function loadPackages(
    scope: PackageFetchScope,
    options?: Omit<SessionRequestOptions, "operation">,
  ) {
    const currentSerial = activeSerial.value;
    if (!currentSerial) {
      return [];
    }

    const cachedPackages = readPackagesCache(currentSerial, scope);
    const packages = await runSessionEffect(listPackagesEffect(currentSerial, scope), {
      operation: "session.listPackages",
      signal: options?.signal,
    });

    if (packages.length > 0) {
      writePackagesCache(currentSerial, scope, packages);
      return packages;
    }

    if (cachedPackages) {
      return cachedPackages.packages;
    }

    return refreshPackageScope(scope, options);
  }

  async function refreshPackageScope(
    scope: PackageFetchScope,
    options?: Omit<SessionRequestOptions, "operation">,
  ) {
    const currentSerial = activeSerial.value;
    if (!currentSerial) {
      return [];
    }

    const cancelScan = () => {
      void runSessionEffect(cancelListPackagesEffect(currentSerial), {
        operation: "session.cancelListPackages",
      }).catch((error) => console.warn("Failed to cancel package scan", error));
    };
    options?.signal?.addEventListener("abort", cancelScan, { once: true });

    let packages: AdbPackage[];
    try {
      packages = await runSessionEffect(refreshPackagesEffect(currentSerial, scope), {
        operation: "session.refreshPackages",
        signal: options?.signal,
      });
    } finally {
      options?.signal?.removeEventListener("abort", cancelScan);
    }

    writePackagesCache(currentSerial, scope, packages);
    return packages;
  }

  function usePackages(scope: PackageFetchScope | { value: PackageFetchScope } = "third-party") {
    const resolvedScope = computed(() => (typeof scope === "string" ? scope : scope.value));

    return useQuery({
      queryKey: computed(() => packageQueryKey(resolvedScope.value)),
      queryFn: ({ signal }) => loadPackages(resolvedScope.value, { signal }),
      initialData: () => {
        const currentSerial = activeSerial.value;
        if (!currentSerial) {
          return undefined;
        }
        return readPackagesCache(currentSerial, resolvedScope.value)?.packages;
      },
      initialDataUpdatedAt: () => {
        const currentSerial = activeSerial.value;
        if (!currentSerial) {
          return undefined;
        }
        return readPackagesCache(currentSerial, resolvedScope.value)?.updatedAt;
      },
      enabled: computed(() => !!activeSerial.value),
      staleTime: PACKAGE_CACHE_STALE_MS,
      gcTime: 24 * 60 * 60 * 1000,
    });
  }

  async function refreshPackages(scope: PackageFetchScope = "third-party") {
    await refreshPackageScope(scope);
  }

  function readPackagesCache(
    serialValue: string,
    scope: PackageFetchScope,
  ): StoredPackagesCache | null {
    const cachedPackages = queryClient.getQueryData<AdbPackage[]>(
      packageQueryKeyFor(serialValue, scope),
    );
    if (cachedPackages) {
      return {
        packages: cachedPackages,
        updatedAt: 0,
      };
    }

    const storedPackages = readStoredPackages(serialValue, scope);
    if (!storedPackages) {
      return null;
    }

    queryClient.setQueryData(packageQueryKeyFor(serialValue, scope), storedPackages.packages);
    if (scope === "all") {
      queryClient.setQueryData(
        packageQueryKeyFor(serialValue, "third-party"),
        storedPackages.packages.filter((entry) => !entry.system),
      );
    }

    return storedPackages;
  }

  function getCachedPackage(packageName: string): AdbPackage | null {
    const currentSerial = activeSerial.value;
    if (!currentSerial) {
      return null;
    }

    const scopes: PackageFetchScope[] = ["third-party", "all"];
    for (const scope of scopes) {
      const packages = readPackagesCache(currentSerial, scope)?.packages;
      const packageEntry = packages?.find((entry) => entry.packageName === packageName);
      if (packageEntry) {
        return packageEntry;
      }
    }

    return null;
  }

  async function ensurePackages(scope: PackageFetchScope = "all") {
    const currentSerial = activeSerial.value;
    if (!currentSerial) {
      return [];
    }

    const cachedPackages = readPackagesCache(currentSerial, scope);
    if (cachedPackages) {
      return cachedPackages.packages;
    }

    return loadPackages(scope);
  }

  return {
    PACKAGE_CACHE_STALE_MS,
    usePackages,
    refreshPackages,
    ensurePackages,
    getCachedPackage,
    readPackagesCache,
  };
}
