<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, Loader2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useAdb, type PackageListScope } from "@/composables/useAdb";
import { useDevicesStore } from "@/stores/devices.store";
import type { AdbPackage } from "@/types/adb.types";
import DeviceAppInspector from "./DeviceAppInspector.vue";
import DeviceAppsList from "./DeviceAppsList.vue";
import DeviceAppsToolbar from "./DeviceAppsToolbar.vue";

type DialogAction = "forceStop" | "clearData" | "uninstall" | null;
type AppAction = Exclude<DialogAction, null>;
type PackageScope = "third-party" | "all" | "system";
type PackageFetchScope = PackageListScope;

interface QuickPathEntry {
  key: string;
  label: string;
  path: string;
}

interface CachedPackagesRecord {
  serial: string;
  scope: PackageFetchScope;
  updatedAt: number;
  packages: AdbPackage[];
}

const PACKAGE_CACHE_STALE_MS = 60_000;
const PACKAGE_CACHE_PREFIX = "capubridge:device-apps:v1";

function getPackagesCacheKey(serial: string, scope: PackageFetchScope): string {
  return `${PACKAGE_CACHE_PREFIX}:${serial}:${scope}`;
}

function readPackagesCache(serial: string, scope: PackageFetchScope): CachedPackagesRecord | null {
  try {
    const raw = localStorage.getItem(getPackagesCacheKey(serial, scope));
    if (!raw) {
      return null;
    }
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

function writePackagesCache(
  serial: string,
  scope: PackageFetchScope,
  packages: AdbPackage[],
  updatedAt: number,
) {
  try {
    const payload: CachedPackagesRecord = { serial, scope, updatedAt, packages };
    localStorage.setItem(getPackagesCacheKey(serial, scope), JSON.stringify(payload));
  } catch {
    // ignore write failures (quota/private mode)
  }
}

function removePackagesCache(serial: string, scope: PackageFetchScope) {
  try {
    localStorage.removeItem(getPackagesCacheKey(serial, scope));
  } catch {
    // ignore remove failures
  }
}

function readScopedPackagesCache(
  serial: string,
  scope: PackageFetchScope,
): CachedPackagesRecord | null {
  if (scope === "all") {
    return readPackagesCache(serial, "all");
  }

  const thirdParty = readPackagesCache(serial, "third-party");
  if (thirdParty) {
    return thirdParty;
  }

  const all = readPackagesCache(serial, "all");
  if (!all) {
    return null;
  }

  return {
    serial,
    scope: "third-party",
    updatedAt: all.updatedAt,
    packages: all.packages.filter((entry) => !entry.system),
  };
}

const devicesStore = useDevicesStore();
const router = useRouter();
const queryClient = useQueryClient();
const { getPackageDetails, listPackages, openPackage, cancelListPackages } = useAdb();

const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");
const appsView = ref<"grid" | "table">("grid");
const appsSearch = ref("");
const packageScope = ref<PackageScope>("third-party");
const gridColumns = ref("6");
const selectedApp = ref<AdbPackage | null>(null);
const pendingAction = ref<DialogAction>(null);
const isActing = ref(false);
const isCancellingLoad = ref(false);
const fetchScope = computed<PackageFetchScope>(() =>
  packageScope.value === "third-party" ? "third-party" : "all",
);

const {
  data: packages,
  isLoading,
  isFetching,
  isError,
  error,
  refetch,
} = useQuery({
  queryKey: computed(() => ["packages", serial.value, fetchScope.value]),
  queryFn: async () => {
    const activeSerial = serial.value;
    const activeScope = fetchScope.value;
    const nextPackages = await listPackages(activeSerial, activeScope);
    const updatedAt = Date.now();
    writePackagesCache(activeSerial, activeScope, nextPackages, updatedAt);

    if (activeScope === "all") {
      const thirdPartyPackages = nextPackages.filter((entry) => !entry.system);
      writePackagesCache(activeSerial, "third-party", thirdPartyPackages, updatedAt);
      queryClient.setQueryData(["packages", activeSerial, "third-party"], thirdPartyPackages);
    }

    return nextPackages;
  },
  enabled: computed(() => !!serial.value),
  staleTime: PACKAGE_CACHE_STALE_MS,
  gcTime: 24 * 60 * 60 * 1000,
  initialData: () => {
    const activeSerial = serial.value;
    if (!activeSerial) {
      return undefined;
    }
    return readScopedPackagesCache(activeSerial, fetchScope.value)?.packages;
  },
  initialDataUpdatedAt: () => {
    const activeSerial = serial.value;
    if (!activeSerial) {
      return undefined;
    }
    return readScopedPackagesCache(activeSerial, fetchScope.value)?.updatedAt;
  },
});

const isPackagesBusy = computed(() => isLoading.value || isFetching.value);

const selectedPackageName = computed(() => selectedApp.value?.packageName ?? "");
const {
  data: selectedAppDetails,
  isLoading: isLoadingDetails,
  isError: isDetailsError,
  error: detailsError,
  refetch: refetchSelectedAppDetails,
} = useQuery({
  queryKey: computed(() => ["package-details", serial.value, selectedPackageName.value]),
  queryFn: () => getPackageDetails(serial.value, selectedPackageName.value),
  enabled: computed(() => !!serial.value && !!selectedPackageName.value),
  staleTime: PACKAGE_CACHE_STALE_MS,
});

watch(
  () => packages.value,
  (nextPackages) => {
    if (!selectedApp.value) {
      return;
    }

    const refreshed = nextPackages?.find(
      (entry) => entry.packageName === selectedApp.value?.packageName,
    );
    selectedApp.value = refreshed ?? null;
  },
);

watch(serial, () => {
  selectedApp.value = null;
});

async function cancelPackagesLoad(options?: { silent?: boolean }) {
  const activeSerial = serial.value;
  if (!activeSerial || !isFetching.value || isCancellingLoad.value) {
    return;
  }

  const silent = options?.silent ?? false;
  isCancellingLoad.value = true;
  try {
    await cancelListPackages(activeSerial);
    if (!silent) {
      toast("Stopping package load…");
    }
  } catch (err) {
    if (!silent) {
      toast.error("Failed to stop package load", { description: String(err) });
    }
  } finally {
    isCancellingLoad.value = false;
  }
}

async function handleRefresh() {
  const activeSerial = serial.value;
  if (!activeSerial) {
    return;
  }

  const activeScope = fetchScope.value;
  removePackagesCache(activeSerial, activeScope);
  if (activeScope === "all") {
    removePackagesCache(activeSerial, "third-party");
    queryClient.removeQueries({
      queryKey: ["packages", activeSerial, "third-party"],
      exact: true,
    });
  }
  await refetch();
}

onBeforeUnmount(() => {
  void cancelPackagesLoad({ silent: true });
});

function appDisplayName(app: AdbPackage): string {
  const label = app.label?.trim();
  return label && label.length > 0 ? label : app.packageName;
}

function dirname(path?: string | null): string | null {
  if (!path) {
    return null;
  }
  const cleanPath = path.replace(/\/+$/, "");
  const slashIndex = cleanPath.lastIndexOf("/");
  if (slashIndex <= 0) {
    return null;
  }
  return cleanPath.slice(0, slashIndex);
}

const packageCounts = computed(() => {
  const activeSerial = serial.value;
  const allPackagesFromQuery = activeSerial
    ? queryClient.getQueryData<AdbPackage[]>(["packages", activeSerial, "all"])
    : undefined;
  const allPackagesFromCache = activeSerial
    ? readPackagesCache(activeSerial, "all")?.packages
    : undefined;
  const allPackages = allPackagesFromQuery ?? allPackagesFromCache ?? packages.value ?? [];
  const system = allPackages.filter((entry) => entry.system).length;
  return {
    total: allPackages.length,
    system,
    thirdParty: allPackages.length - system,
  };
});

const filteredApps = computed(() => {
  let entries = packages.value ?? [];

  if (packageScope.value === "system") {
    entries = entries.filter((entry) => entry.system);
  } else if (packageScope.value === "third-party") {
    entries = entries.filter((entry) => !entry.system);
  }

  const query = appsSearch.value.toLowerCase().trim();
  if (!query) {
    return entries;
  }

  return entries.filter((entry) => {
    const label = appDisplayName(entry).toLowerCase();
    const packageName = entry.packageName.toLowerCase();
    return label.includes(query) || packageName.includes(query);
  });
});

const selectedTotalSize = computed(() => {
  const details = selectedAppDetails.value;
  if (!details) {
    return null;
  }

  const numbers = [details.appSize, details.dataSize, details.cacheSize].filter(
    (value): value is number => value !== null && value !== undefined,
  );
  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((sum, value) => sum + value, 0);
});

const quickPaths = computed<QuickPathEntry[]>(() => {
  const app = selectedApp.value;
  if (!app) {
    return [];
  }

  const details = selectedAppDetails.value;
  const packageName = app.packageName;
  const candidates = [
    {
      key: "external",
      label: "Android/data",
      path: details?.externalDataDir ?? `/sdcard/Android/data/${packageName}`,
    },
    {
      key: "internal",
      label: "Internal data",
      path: details?.dataDir ?? `/data/data/${packageName}`,
    },
    {
      key: "media",
      label: "Android/media",
      path: details?.mediaDir ?? null,
    },
    {
      key: "obb",
      label: "Android/obb",
      path: details?.obbDir ?? null,
    },
    {
      key: "apk",
      label: "APK folder",
      path: dirname(details?.apkPath ?? app.apkPath),
    },
  ];

  const seen = new Set<string>();
  return candidates
    .filter((candidate): candidate is QuickPathEntry => {
      if (!candidate.path || seen.has(candidate.path)) {
        return false;
      }
      seen.add(candidate.path);
      return true;
    })
    .map((candidate) => ({ ...candidate }));
});

const confirmDialogConfig = computed(() => {
  const app = selectedApp.value;
  if (!app || !pendingAction.value) {
    return null;
  }

  const name = appDisplayName(app);
  if (pendingAction.value === "forceStop") {
    return {
      title: `Force stop "${name}"?`,
      description: "This will kill the app process on the connected device.",
      confirmText: "Force Stop",
      variant: "default" as const,
    };
  }
  if (pendingAction.value === "clearData") {
    return {
      title: `Clear data for "${name}"?`,
      description:
        "This deletes the app data and cache on the device and resets it to a fresh state.",
      confirmText: "Clear Data",
      variant: "destructive" as const,
    };
  }
  return {
    title: `Uninstall "${name}"?`,
    description: "This removes the package and all app data from the connected device.",
    confirmText: "Uninstall",
    variant: "destructive" as const,
  };
});

function selectApp(app: AdbPackage) {
  selectedApp.value = selectedApp.value?.packageName === app.packageName ? null : app;
}

async function openFiles(path: string) {
  await router.push({
    name: "devices-files",
    query: { path },
  });
}

async function handleLaunchApp(app: AdbPackage) {
  if (!serial.value) {
    return;
  }

  try {
    await openPackage(serial.value, app.packageName);
    toast.success("App launched", { description: app.packageName });
  } catch (err) {
    toast.error("Failed to launch app", { description: String(err) });
  }
}

function promptAction(app: AdbPackage, action: AppAction) {
  selectedApp.value = app;
  pendingAction.value = action;
}

function handleListAction(payload: { app: AdbPackage; action: AppAction }) {
  promptAction(payload.app, payload.action);
}

function handleInspectorAction(action: AppAction) {
  if (!selectedApp.value) {
    return;
  }
  promptAction(selectedApp.value, action);
}

async function executeAction() {
  const app = selectedApp.value;
  const action = pendingAction.value;
  if (!app || !action || !serial.value) {
    return;
  }

  const name = appDisplayName(app);
  pendingAction.value = null;
  isActing.value = true;

  try {
    let command = "";
    if (action === "forceStop") {
      command = `am force-stop ${app.packageName}`;
    } else if (action === "clearData") {
      command = `pm clear ${app.packageName}`;
    } else {
      command = `pm uninstall ${app.packageName}`;
    }

    const result = await invoke<string>("adb_shell_command", {
      serial: serial.value,
      command,
    });

    if (action === "uninstall") {
      if (result.toLowerCase().includes("success")) {
        toast.success("App uninstalled", { description: name });
        selectedApp.value = null;
        await handleRefresh();
      } else {
        toast.error("Uninstall failed", { description: result.trim() });
      }
    } else if (action === "clearData") {
      if (result.toLowerCase().includes("success")) {
        toast.success("App data cleared", { description: name });
        void refetchSelectedAppDetails();
      } else {
        toast.error("Clear data failed", { description: result.trim() });
      }
    } else {
      toast.success("App force stopped", { description: name });
    }
  } catch (err) {
    toast.error("Action failed", { description: String(err) });
  } finally {
    isActing.value = false;
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <DeviceAppsToolbar
      v-model:search="appsSearch"
      v-model:package-scope="packageScope"
      v-model:apps-view="appsView"
      v-model:grid-columns="gridColumns"
      :filtered-count="filteredApps.length"
      :total-count="packageCounts.total"
      :third-party-count="packageCounts.thirdParty"
      :system-count="packageCounts.system"
      :show-counts="!!packages"
      :is-loading="isPackagesBusy"
      :is-cancelling="isCancellingLoad"
      @refresh="void handleRefresh()"
      @cancel-load="void cancelPackagesLoad()"
    />

    <div
      v-if="isLoading && !packages"
      class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground/40"
    >
      <Loader2 class="h-4 w-4 animate-spin" />
      Loading packages…
    </div>

    <div v-else-if="isError" class="flex flex-1 items-center justify-center p-8">
      <div
        class="flex w-full max-w-sm items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
      >
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="font-medium">Failed to load packages</div>
          <div class="mt-0.5 truncate font-mono text-[10px] text-red-400/60">
            {{ error }}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 shrink-0 px-2 text-red-400 hover:text-red-300"
          @click="void handleRefresh()"
        >
          Retry
        </Button>
      </div>
    </div>

    <div
      v-else-if="!serial"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/25"
    >
      No device selected
    </div>

    <ResizablePanelGroup v-else direction="horizontal" class="min-h-0 flex-1">
      <ResizablePanel :default-size="66" :min-size="42">
        <DeviceAppsList
          :serial="serial"
          :apps-view="appsView"
          :grid-columns="gridColumns"
          :apps="filteredApps"
          :selected-package-name="selectedApp?.packageName ?? null"
          @select="selectApp"
          @launch="handleLaunchApp"
          @action="handleListAction"
        />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel :default-size="34" :min-size="24" :max-size="48" class="min-h-0">
        <DeviceAppInspector
          :serial="serial"
          :app="selectedApp"
          :details="selectedAppDetails"
          :selected-total-size="selectedTotalSize"
          :quick-paths="quickPaths"
          :is-loading-details="isLoadingDetails"
          :is-details-error="isDetailsError"
          :details-error="detailsError"
          :is-acting="isActing"
          @clear-selection="selectedApp = null"
          @open-files="openFiles"
          @launch="selectedApp && void handleLaunchApp(selectedApp)"
          @action="handleInspectorAction"
          @retry-details="refetchSelectedAppDetails"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>

  <ConfirmDialog
    v-if="confirmDialogConfig"
    :open="pendingAction !== null"
    :title="confirmDialogConfig.title"
    :description="confirmDialogConfig.description"
    :confirm-text="confirmDialogConfig.confirmText"
    :variant="confirmDialogConfig.variant"
    @confirm="executeAction"
    @cancel="pendingAction = null"
    @update:open="
      (open) => {
        if (!open) {
          pendingAction = null;
        }
      }
    "
  />
</template>
