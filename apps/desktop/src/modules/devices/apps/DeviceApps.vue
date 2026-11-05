<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useStorage } from "@vueuse/core";
import { Button, Spinner } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useAdb } from "@/composables/useAdb";
import { PACKAGE_CACHE_STALE_MS, useAppPackages } from "@/composables/useAppPackages";
import { useDevicesStore } from "@/stores/devices.store";
import type { AdbPackage } from "@/types/adb.types";
import DeviceConfirmDialog from "../shared/DeviceConfirmDialog.vue";
import AppInspector from "./AppInspector.vue";
import AppsEmpty from "./AppsEmpty.vue";
import AppsGrid from "./AppsGrid.vue";
import AppsTable from "./AppsTable.vue";
import AppsToolbar from "./AppsToolbar.vue";
import { countApps, filterApps, type AppScope } from "./appsModel";
import type { AppsDensity, AppsView } from "./appsView";
import { useAppActions } from "./useAppActions";
import { useAppsCommands } from "./useAppsCommands";

const devicesStore = useDevicesStore();
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const { getPackageDetails, cancelListPackages } = useAdb();

const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");
const search = ref("");
const scope = useStorage<AppScope>("capubridge:device-apps:scope", "third-party");
const view = useStorage<AppsView>("capubridge:device-apps:view", "list");
const density = useStorage<AppsDensity>("capubridge:device-apps:density", "medium");
const selectedName = ref<string | null>(null);
const cancelling = ref(false);

const fetchScope = computed(() => (scope.value === "third-party" ? "third-party" : "all"));
const { usePackages, refreshPackages, readPackagesCache } = useAppPackages(serial);
const { data: packages, isLoading, isFetching, isError, error, refetch } = usePackages(fetchScope);

const busyLoading = computed(() => isLoading.value || isFetching.value);
const sortedApps = computed(() =>
  filterApps(packages.value ?? [], scope.value, search.value).sort((a, b) =>
    (a.label?.trim() || a.packageName).localeCompare(b.label?.trim() || b.packageName),
  ),
);
const counts = computed(() => {
  if (!packages.value) return null;
  const all =
    queryClient.getQueryData<AdbPackage[]>(["packages", serial.value, "all"]) ??
    readPackagesCache(serial.value, "all")?.packages ??
    packages.value;
  return countApps(all);
});
const selectedApp = computed(
  () => packages.value?.find((app) => app.packageName === selectedName.value) ?? null,
);

const {
  data: details,
  isLoading: loadingDetails,
  error: detailsError,
  refetch: refetchDetails,
} = useQuery({
  queryKey: computed(() => ["package-details", serial.value, selectedName.value ?? ""]),
  queryFn: () => getPackageDetails(serial.value, selectedName.value ?? ""),
  enabled: computed(() => !!serial.value && !!selectedName.value),
  staleTime: PACKAGE_CACHE_STALE_MS,
});

const actions = useAppActions(serial, {
  onUninstalled: async (app) => {
    if (selectedName.value === app.packageName) selectedName.value = null;
    await reload();
  },
  onDataCleared: () => void refetchDetails(),
});

watch(serial, () => {
  selectedName.value = null;
});
const requestedName = ref<string | null>(null);
watch(
  () => route.query.package,
  (requested) => {
    const name = Array.isArray(requested) ? requested[0] : requested;
    if (typeof name !== "string" || !name) return;
    selectedName.value = name;
    requestedName.value = name;
    void router.replace({ query: { ...route.query, package: undefined } });
  },
  { immediate: true },
);
watch(
  [packages, requestedName],
  ([list, name]) => {
    if (!list || !name) return;
    requestedName.value = null;
    if (!list.some((app) => app.packageName === name) && scope.value !== "all") scope.value = "all";
  },
  { immediate: true },
);

async function reload() {
  await refreshPackages(fetchScope.value);
  await refetch();
}

async function cancelLoad(silent = false) {
  if (!serial.value || !isFetching.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await cancelListPackages(serial.value);
    if (!silent) toast("Stopped loading the app list");
  } catch (err) {
    if (!silent) toast.error("Could not stop loading the app list", { description: String(err) });
  } finally {
    cancelling.value = false;
  }
}

function select(app: AdbPackage) {
  selectedName.value = selectedName.value === app.packageName ? null : app.packageName;
}

function focus(app: AdbPackage) {
  selectedName.value = app.packageName;
}

function openFiles(path: string) {
  void router.push({ name: "devices-files", query: { path } });
}

onBeforeUnmount(() => void cancelLoad(true));

useAppsCommands({ selectedApp, actions, reload, openFiles, serial });
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <AppsToolbar
      v-model:search="search"
      v-model:scope="scope"
      v-model:view="view"
      v-model:density="density"
      :counts="counts"
      :shown="sortedApps.length"
      :loading="busyLoading"
      :cancelling="cancelling"
      @refresh="void reload()"
      @cancel="void cancelLoad()"
    />

    <div
      v-if="isLoading && !packages"
      class="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"
    >
      <Spinner size="xs" />
      Reading the apps installed on the phone
    </div>

    <div v-else-if="isError" class="flex flex-1 items-center justify-center p-8">
      <div
        class="flex w-full max-w-md items-start gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
        role="alert"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <p class="text-xs text-foreground">The phone did not send its list of apps.</p>
          <p class="font-mono text-2xs break-all text-error">{{ error }}</p>
        </div>
        <Button size="sm" variant="transparent" @click="void reload()">Try again</Button>
      </div>
    </div>

    <ResizablePanelGroup v-else direction="horizontal" class="min-h-0 flex-1">
      <ResizablePanel :default-size="64" :min-size="40">
        <AppsEmpty v-if="!sortedApps.length" :searching="search.trim() !== ''" :scope="scope" />
        <AppsTable
          v-else-if="view === 'list'"
          :serial="serial"
          :apps="sortedApps"
          :selected="selectedName"
          :busy="actions.isActing.value"
          :show-kind="scope === 'all'"
          @toggle="select"
          @select="focus"
          @launch="actions.launch"
          @action="actions.request"
        />
        <AppsGrid
          v-else
          :key="density"
          :serial="serial"
          :apps="sortedApps"
          :selected="selectedName"
          :density="density"
          @toggle="select"
          @select="focus"
          @launch="actions.launch"
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel :default-size="36" :min-size="26" :max-size="50" class="min-h-0">
        <AppInspector
          v-if="selectedApp"
          :serial="serial"
          :app="selectedApp"
          :details="details"
          :loading-details="loadingDetails"
          :details-error="detailsError"
          :busy="actions.isActing.value"
          @close="selectedName = null"
          @launch="actions.launch(selectedApp)"
          @action="actions.request(selectedApp, $event)"
          @open-files="openFiles"
          @retry-details="refetchDetails()"
        />
        <div v-else class="flex h-full flex-col items-center justify-center gap-1 px-8 text-center">
          <p class="text-sm text-foreground">No app selected</p>
          <p class="max-w-64 text-xs text-muted-foreground">
            Choose an app to open it, stop it, clear its data or browse its folders.
          </p>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>

    <DeviceConfirmDialog
      v-model:open="actions.confirmOpen.value"
      :request="actions.confirmRequest.value"
      @confirm="actions.confirm()"
    />
  </div>
</template>
