<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppOverviewSurface from "./AppOverviewSurface.vue";
import { useAppPanel } from "./useAppPanel";

type AppAction = "forceStop" | "clearData" | null;

const pendingAction = ref<AppAction>(null);
const panel = useAppPanel();

const internalPath = computed(
  () => panel.detailsQuery.data.value?.dataDir ?? `/data/data/${panel.packageName.value}`,
);
const externalPath = computed(
  () =>
    panel.detailsQuery.data.value?.externalDataDir ??
    `/sdcard/Android/data/${panel.packageName.value}`,
);

watch(
  () => panel.packageName.value,
  (value) => {
    if (!value) return;
    if (!panel.inspector.permissions.value && !panel.inspector.isLoadingPerms.value) {
      void panel.inspector.fetchPermissions();
    }
  },
  { immediate: true },
);

async function refreshPermissions() {
  panel.inspector.invalidatePackageDump();
  await panel.inspector.fetchPermissions({ force: true });
}

async function executeAction() {
  if (!pendingAction.value) {
    return;
  }

  const action = pendingAction.value;
  pendingAction.value = null;

  try {
    if (action === "forceStop") {
      await panel.forceStopApp();
      toast.success("App force stopped", { description: panel.packageName.value });
      return;
    }

    const result = await panel.clearAppData();
    if (result.toLowerCase().includes("success")) {
      toast.success("App data cleared", { description: panel.packageName.value });
      await panel.detailsQuery.refetch();
      await panel.inspector.fetchNetworkStats();
      await panel.inspector.fetchBatteryStats();
      return;
    }
    toast.error("Clear data failed", { description: result.trim() });
  } catch (error) {
    toast.error("Action failed", { description: String(error) });
  }
}

const dialogTitle = computed(() => {
  if (pendingAction.value === "forceStop") {
    return `Force stop ${panel.packageName.value}?`;
  }
  return `Clear data for ${panel.packageName.value}?`;
});

const dialogDescription = computed(() => {
  if (pendingAction.value === "forceStop") {
    return "This kills the selected app process on the connected device.";
  }
  return "This deletes the app sandbox data and cache on the device.";
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <ScrollArea v-if="panel.selectedTarget.value && panel.packageName.value" class="h-full">
      <div>
        <AppOverviewSurface
          :serial="panel.serial.value"
          :package-name="panel.packageName.value"
          :target-title="panel.selectedTarget.value.title"
          :target-url="panel.selectedTarget.value.url"
          :package-info="panel.selectedPackage.value"
          :details="panel.detailsQuery.data.value"
          :mem-info="panel.inspector.memInfo.value"
          :network-stats="panel.inspector.networkStats.value"
          :battery-stats="panel.inspector.batteryStats.value"
          :capacitor-info="panel.inspector.capacitorInfo.value"
          :permissions="panel.inspector.permissions.value"
          :is-details-loading="panel.detailsQuery.isLoading.value"
          :is-permissions-loading="panel.inspector.isLoadingPerms.value"
          :permissions-error="panel.inspector.permsError.value"
          @launch="void panel.launchApp()"
          @force-stop="pendingAction = 'forceStop'"
          @clear-data="pendingAction = 'clearData'"
          @browse-internal="void panel.openFiles(internalPath)"
          @browse-external="void panel.openFiles(externalPath)"
          @open-indexed-db="void panel.openIndexedDb()"
          @open-sqlite="void panel.openSqlite()"
          @refresh-permissions="void refreshPermissions()"
        />
      </div>
    </ScrollArea>

    <ConfirmDialog
      v-if="pendingAction"
      :open="pendingAction !== null"
      :title="dialogTitle"
      :description="dialogDescription"
      :confirm-text="pendingAction === 'forceStop' ? 'Force Stop' : 'Clear Data'"
      :variant="pendingAction === 'clearData' ? 'destructive' : 'default'"
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
  </div>
</template>
