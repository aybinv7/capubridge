<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import {
  Database,
  HardDrive,
  DatabaseZap,
  Archive,
  FolderOpen,
  Table2,
  Diff,
} from "lucide-vue-next";
import {
  ModuleShell,
  ModuleHeader,
  ModuleSubNav,
  type ModuleSubNavItem,
} from "@/components/module-shell";
import { useDevicesStore } from "@/stores/devices.store";
import { useTabsStore } from "@/stores/tabs.store";
import { useTabStateStore } from "@/stores/tabState.store";
import type { TabScope } from "@/types/tabs.types";
import { useIndexedDBChangesTracking } from "@/modules/storage/changes/useIndexedDBChangesTracking";

useIndexedDBChangesTracking();

const route = useRoute();
const router = useRouter();
const devicesStore = useDevicesStore();
const tabsStore = useTabsStore();
const tabStateStore = useTabStateStore();

type StorageSubTool =
  | "idb"
  | "localStorage"
  | "cache"
  | "opfs"
  | "sqlite"
  | "localforage"
  | "graph"
  | "changes";

const SUBNAV: readonly ModuleSubNavItem[] = [
  { id: "idb", label: "IndexedDB", icon: HardDrive },
  { id: "localStorage", label: "LocalStorage", icon: DatabaseZap },
  { id: "localforage", label: "LocalForage", icon: Database },
  { id: "cache", label: "Cache", icon: Archive },
  { id: "opfs", label: "OPFS", icon: FolderOpen },
  { id: "sqlite", label: "SQLite", icon: Table2 },
  { id: "graph", label: "Graph", icon: Database },
  { id: "changes", label: "Changes", icon: Diff },
] as const;

const SUBTOOL_TO_PATH: Record<StorageSubTool, string> = {
  idb: "/storage/indexeddb",
  localStorage: "/storage/localstorage",
  localforage: "/storage/localforage",
  cache: "/storage/cache",
  opfs: "/storage/opfs",
  sqlite: "/storage/sqlite",
  graph: "/storage/graph",
  changes: "/storage/changes",
};

const PATH_TO_SUBTOOL: Record<string, StorageSubTool> = {
  indexeddb: "idb",
  localstorage: "localStorage",
  localforage: "localforage",
  cache: "cache",
  opfs: "opfs",
  sqlite: "sqlite",
  graph: "graph",
  changes: "changes",
};

const currentSubTool = computed<StorageSubTool>(() => {
  const seg = route.path.split("/")[2] ?? "indexeddb";
  return PATH_TO_SUBTOOL[seg] ?? "idb";
});

const scope = computed<TabScope>(() => {
  const device = devicesStore.selectedDevice;
  if (!device) return { kind: "singleton" };
  return { kind: "target", serial: device.serial, webviewId: device.model ?? "—" };
});

const deviceStatus = computed(() => devicesStore.selectedDevice?.status ?? null);

function ensureTab() {
  const tab = tabsStore.openTab("storage", scope.value);
  tabStateStore.ensure(tab.id, "storage");
  // Persist current sub-tool into the active tab's state slice.
  tabStateStore.patch<{ tool: "storage"; subTool: StorageSubTool }>(tab.id, {
    subTool: currentSubTool.value,
  });
}

onMounted(ensureTab);

watch(
  [() => scope.value, () => currentSubTool.value],
  () => {
    ensureTab();
  },
  { deep: true },
);

function onSubNavChange(id: string) {
  const sub = id as StorageSubTool;
  const path = SUBTOOL_TO_PATH[sub];
  if (path) void router.push(path);
}
</script>

<template>
  <ModuleShell>
    <template #header>
      <ModuleHeader
        tool-label="Storage"
        :tool-icon="Database"
        :scope="scope"
        :status="deviceStatus"
      />
    </template>

    <template #subnav>
      <ModuleSubNav :items="SUBNAV" :active="currentSubTool" @change="onSubNavChange" />
    </template>

    <RouterView />
  </ModuleShell>
</template>
