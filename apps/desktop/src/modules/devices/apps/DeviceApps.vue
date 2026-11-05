<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { refDebounced, useStorage } from "@vueuse/core";
import { Button, Spinner } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { PACKAGE_CACHE_STALE_MS, useAppPackages } from "@/composables/useAppPackages";
import { useDevicesStore } from "@/stores/devices.store";
import type { AdbPackage } from "@/types/adb.types";
import DetailsPane from "../shared/DetailsPane.vue";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import AppInspector from "./AppInspector.vue";
import AppsEmpty from "./AppsEmpty.vue";
import AppsGrid from "./AppsGrid.vue";
import AppsTable from "./AppsTable.vue";
import AppsToolbar from "./AppsToolbar.vue";
import { countApps, filterApps, sortApps, type AppScope, type AppSort } from "./appsModel";
import type { AppsDensity, AppsView } from "./appsView";
import { useAppActions } from "./useAppActions";
import { useAppSelection } from "./useAppSelection";
import { useAppsCommands } from "./useAppsCommands";

const DETAILS_DEBOUNCE_MS = 200;

const devicesStore = useDevicesStore();
const router = useRouter();
const queryClient = useQueryClient();
const { getPackageDetails, cancelListPackages } = useAdb();

const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");
const search = ref("");
const savedScope = useStorage<AppScope>("capubridge:device-apps:scope", "third-party");
const view = useStorage<AppsView>("capubridge:device-apps:view", "list");
const density = useStorage<AppsDensity>("capubridge:device-apps:density", "medium");
const sort = shallowRef<AppSort>({ key: "name", desc: false });
const cancelling = ref(false);

const selection = useAppSelection(serial, savedScope);
const scope = selection.scope;
const selectedName = selection.selectedName;

const fetchScope = computed(() => (scope.value === "third-party" ? "third-party" : "all"));
const { usePackages, refreshPackages, readPackagesCache } = useAppPackages(serial);
const { data: packages, isLoading, isFetching, isError, error, refetch } = usePackages(fetchScope);
selection.watchListing(packages);

const busyLoading = computed(() => isLoading.value || isFetching.value);
const orderedApps = computed(() => sortApps(packages.value ?? [], sort.value));
const shownApps = computed(() => filterApps(orderedApps.value, scope.value, search.value));
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

const detailsName = refDebounced(selectedName, DETAILS_DEBOUNCE_MS);
const {
  data: details,
  isLoading: loadingDetails,
  error: detailsError,
  refetch: refetchDetails,
} = useQuery({
  queryKey: computed(() => ["package-details", serial.value, detailsName.value ?? ""]),
  queryFn: () => getPackageDetails(serial.value, detailsName.value ?? ""),
  enabled: computed(() => !!serial.value && !!detailsName.value),
  staleTime: PACKAGE_CACHE_STALE_MS,
});
const shownDetails = computed(() =>
  detailsName.value === selectedName.value ? details.value : undefined,
);
const detailsPending = computed(
  () => detailsName.value !== selectedName.value || loadingDetails.value,
);

const actions = useAppActions(serial, {
  onUninstalled: async (app) => {
    if (selectedName.value === app.packageName) selection.clear();
    await reload();
  },
  onDataCleared: () => void refetchDetails(),
});

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

function openFiles(path: string) {
  void router.push({ name: "devices-files", query: { path } });
}

onBeforeUnmount(() => void cancelLoad(true));

useAppsCommands({ selectedApp, details: shownDetails, actions, reload, openFiles, serial });
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <AppsToolbar
      v-model:search="search"
      v-model:view="view"
      v-model:density="density"
      :scope="scope"
      :counts="counts"
      :shown="shownApps.length"
      :loading="busyLoading"
      :cancelling="cancelling"
      @update:scope="selection.chooseScope"
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

    <div v-else class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1">
        <AppsEmpty v-if="!shownApps.length" :searching="search.trim() !== ''" :scope="scope" />
        <AppsTable
          v-else-if="view === 'list'"
          v-model:sort="sort"
          :serial="serial"
          :apps="shownApps"
          :selected="selectedName"
          :busy="actions.isActing.value"
          :show-kind="scope === 'all'"
          @select="selection.select"
          @clear="selection.clear"
          @launch="actions.launch"
          @action="actions.request"
        />
        <AppsGrid
          v-else
          :key="density"
          :serial="serial"
          :apps="shownApps"
          :selected="selectedName"
          :density="density"
          @select="selection.select"
          @clear="selection.clear"
          @launch="actions.launch"
        />
      </div>
      <DetailsPane
        :open="selectedApp !== null"
        title="App details"
        :label="
          selectedApp ? `Details of ${selectedApp.label || selectedApp.packageName}` : 'App details'
        "
        @close="selection.clear"
      >
        <AppInspector
          v-if="selectedApp"
          :serial="serial"
          :app="selectedApp"
          :details="shownDetails"
          :loading-details="detailsPending"
          :details-error="detailsError"
          :busy="actions.isActing.value"
          @launch="actions.launch(selectedApp)"
          @action="actions.request(selectedApp, $event)"
          @open-files="openFiles"
          @retry-details="refetchDetails()"
        />
      </DetailsPane>
    </div>

    <ConfirmDialog
      v-model:open="actions.confirmOpen.value"
      :request="actions.confirmRequest.value"
      @confirm="actions.confirm()"
    />
  </div>
</template>
