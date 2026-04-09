<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Database,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Pin,
  PinOff,
  EyeOff,
  Eye,
} from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useIDB } from "@/composables/useIDB";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageSize } from "@/composables/useStorageSize";
import { useSidebarSettings } from "@/modules/storage/stores/useSidebarSettingsStore";
import type { IDBDatabaseInfo, IDBRecord } from "utils";
import { IDBDomain } from "utils";
import IDBTable from "./IDBTable.vue";
import IDBTableToolbar from "./IDBTableToolbar.vue";
import IDBDatabaseOverview from "./IDBDatabaseOverview.vue";

const route = useRoute();
const router = useRouter();

const storeSearch = ref("");
const filter = ref("");
const page = ref(0);
const pageSize = ref(50);

const dbName = computed(() => decodeURIComponent((route.params["db"] as string) ?? ""));
const storeName = computed(() => decodeURIComponent((route.params["store"] as string) ?? ""));
const selectedOrigin = ref("");

const {
  pinnedDbs,
  hiddenDbs,
  showHiddenDbs,
  pinnedStores,
  hiddenStores,
  showHidden,
  expandedDbs,
  togglePinDb,
  toggleHideDb,
  isDbPinned,
  isDbHidden,
  togglePin,
  toggleHide,
  toggleDb,
  isPinned,
  isHidden,
} = useSidebarSettings();

const { useDatabases, useRecords, useStoreInfo, useStorageEstimate } = useIDB();
const { useTotalStorageSize } = useStorageSize();
const { getClient } = useCDP();

const {
  data: databases,
  isLoading: isLoadingDbs,
  isFetching: isFetchingDbs,
  refetch: refetchDbs,
} = useDatabases();

const {
  data: recordsData,
  isLoading: isLoadingRecords,
  isFetching: isFetchingRecords,
  isError,
  refetch: refetchRecords,
} = useRecords(selectedOrigin, dbName, storeName, page, pageSize);

// Find the DB info for the currently selected DB
const selectedDbInfo = computed<IDBDatabaseInfo | undefined>(() => {
  if (!dbName.value || !databases.value) return undefined;
  return databases.value.find((db) => db.name === dbName.value);
});

const selectedDbOrigin = computed(() => selectedDbInfo.value?.origin ?? "");

const {
  data: storeInfoData,
  isLoading: isLoadingStoreInfo,
  isError: isStoreInfoError,
  refetch: refetchStoreInfo,
} = useStoreInfo(dbName, selectedOrigin);

const { data: storageSizeData } = useTotalStorageSize(selectedOrigin);

const isLoading = computed(() => isLoadingRecords.value || isFetchingRecords.value);
const hasMore = computed(() => recordsData.value?.hasMore ?? false);
const recordCount = computed(() => recordsData.value?.records.length ?? 0);
const totalRecords = computed(() => {
  if (!storeName.value || !storeInfoData.value) return 0;
  const store = storeInfoData.value.find((s) => s.name === storeName.value);
  return store?.recordCount ?? 0;
});

const filteredRecords = computed<IDBRecord[]>(() => {
  if (!recordsData.value?.records) return [];
  if (!filter.value) return recordsData.value.records;
  const q = filter.value.toLowerCase();
  return recordsData.value.records.filter(
    (r) =>
      String(r.key).toLowerCase().includes(q) || JSON.stringify(r.value).toLowerCase().includes(q),
  );
});

// For each DB, compute the sorted + filtered store list
function getVisibleStores(db: IDBDatabaseInfo): string[] {
  const q = storeSearch.value.toLowerCase();
  return db.objectStoreNames
    .filter((s) => {
      if (q && !s.toLowerCase().includes(q)) return false;
      if (isHidden(db.name, s) && !showHidden.value) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = isPinned(db.name, a) ? 0 : 1;
      const pb = isPinned(db.name, b) ? 0 : 1;
      return pa - pb || a.localeCompare(b);
    });
}

function getVisibleDatabases(): IDBDatabaseInfo[] {
  if (!databases.value) return [];
  const q = storeSearch.value.toLowerCase();
  return databases.value
    .filter((db) => {
      //exclude localforage gets it owns tab
      if (db.name === "localforage") return false;
      if (isDbHidden(db.origin, db.name) && !showHiddenDbs.value) return false;
      if (q) {
        const hasMatchingStore = db.objectStoreNames.some((s) => s.toLowerCase().includes(q));
        if (!hasMatchingStore && !db.name.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const pa = isDbPinned(a.origin, a.name) ? 0 : 1;
      const pb = isDbPinned(b.origin, b.name) ? 0 : 1;
      return pa - pb || a.name.localeCompare(b.name);
    });
}

function navigateToStore(db: IDBDatabaseInfo, store: string) {
  selectedOrigin.value = db.origin;
  void router.push(
    `/storage/indexeddb/${encodeURIComponent(db.name)}/${encodeURIComponent(store)}`,
  );
}

function navigateToDbOverview(db: IDBDatabaseInfo) {
  selectedOrigin.value = db.origin;
  void router.push(`/storage/indexeddb/${encodeURIComponent(db.name)}`);
}

function handleSelectStore(storeName: string) {
  if (!selectedDbInfo.value) return;
  navigateToStore(selectedDbInfo.value, storeName);
}

function isStoreActive(db: string, store: string) {
  return dbName.value === db && storeName.value === store;
}

function getDbKey(db: IDBDatabaseInfo) {
  return `${db.origin}::${db.name}`;
}

function prevPage() {
  if (page.value > 0) page.value--;
}
function nextPage() {
  if (hasMore.value) page.value++;
}
function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 0;
}

async function fetchSingleRecord(index: number): Promise<IDBRecord | null> {
  const { useCDP } = await import("@/composables/useCDP");
  const { useTargetsStore } = await import("@/stores/targets.store");
  const { IDBDomain } = await import("utils");

  const targetsStore = useTargetsStore();
  const targetId = targetsStore.selectedTarget?.id ?? "";
  const { getClient } = useCDP();
  const client = getClient(targetId);
  if (!client) return null;

  const domain = new IDBDomain(client);
  try {
    const result = await domain.getData({
      securityOrigin: selectedDbOrigin.value,
      databaseName: dbName.value,
      objectStoreName: storeName.value,
      skipCount: index,
      pageSize: 1,
    });
    return result.records[0] ?? null;
  } catch {
    return null;
  }
}

function getDomain(): IDBDomain | null {
  const targetsStore = useTargetsStore();
  const client = getClient(targetsStore.selectedTarget?.id ?? "");
  return client ? new IDBDomain(client) : null;
}

async function handleRecordEdit(record: IDBRecord) {
  const domain = getDomain();
  if (!domain || !storeName.value || !dbName.value || !selectedOrigin.value) return;
  try {
    await domain.putRecord(selectedOrigin.value, dbName.value, storeName.value, record.value);
    void refetchRecords();
  } catch (err) {
    console.error("[IDB] Failed to save record:", err);
  }
}

async function handleRecordDelete(key: IDBValidKey) {
  const domain = getDomain();
  if (!domain || !storeName.value || !dbName.value || !selectedOrigin.value) return;
  try {
    await domain.deleteRecord(selectedOrigin.value, dbName.value, storeName.value, key);
    void refetchRecords();
  } catch (err) {
    console.error("[IDB] Failed to delete record:", err);
  }
}

async function handleRecordDeleteBulk(keys: IDBValidKey[]) {
  const domain = getDomain();
  if (!domain || !storeName.value || !dbName.value || !selectedOrigin.value) return;
  try {
    for (const key of keys) {
      await domain.deleteRecord(selectedOrigin.value, dbName.value, storeName.value, key);
    }
    void refetchRecords();
  } catch (err) {
    console.error("[IDB] Failed to delete records:", err);
  }
}

function refetch() {
  void refetchDbs();
  void refetchRecords();
}

watch([dbName, storeName], async () => {
  page.value = 0;
  filter.value = "";
});

// Sync selectedOrigin when selectedDbInfo changes
watch(
  selectedDbInfo,
  (db) => {
    if (db?.origin && selectedOrigin.value !== db.origin) {
      selectedOrigin.value = db.origin;
    }
  },
  { immediate: true },
);

watch(
  databases,
  (dbs) => {
    if (dbs && dbs.length > 0 && expandedDbs.value.size === 0) {
      // Expand first DB only if nothing was previously expanded
      toggleDb(dbs[0].name);
      selectedOrigin.value = dbs[0].origin;
    }
    for (const db of dbs ?? []) {
      for (const store of db.objectStoreNames) {
        if (isStoreActive(db.name, store)) {
          if (!expandedDbs.value.has(db.name)) toggleDb(db.name);
          break;
        }
      }
    }
  },
  { immediate: true },
);

// Scroll active store into view after navigation
watch([dbName, storeName], async () => {
  await nextTick();
  document.querySelector("[data-active-store]")?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
});

const hiddenDbCount = computed(() => hiddenDbs.value.size);
const hiddenStoreCount = computed(() => hiddenStores.value.size);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30" class="min-h-0">
        <!-- Sidebar: full height flex column, no overflow on outer -->
        <div class="flex h-full flex-col border-r border-border/30 min-h-0">
          <!-- Store search -->
          <div class="shrink-0 border-b border-border/20">
            <div
              class="flex items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
            >
              <Search class="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <Input
                v-model="storeSearch"
                class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
                placeholder="Search databases or stores…"
              />
            </div>
          </div>

          <!-- Hidden databases toggle (only when some are hidden) -->
          <div
            v-if="hiddenDbCount > 0"
            class="shrink-0 flex items-center justify-between px-3 py-1 border-b border-border/20 bg-surface-2/50"
          >
            <span class="text-[10px] text-muted-foreground/50">
              {{ hiddenDbCount }} hidden database{{ hiddenDbCount > 1 ? "s" : "" }}
            </span>
            <button
              class="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors"
              @click="showHiddenDbs = !showHiddenDbs"
            >
              <component :is="showHiddenDbs ? Eye : EyeOff" :size="10" />
              {{ showHiddenDbs ? "Hide" : "Show" }}
            </button>
          </div>

          <!-- Hidden stores toggle (only when some are hidden) -->
          <div
            v-if="hiddenStoreCount > 0"
            class="shrink-0 flex items-center justify-between px-3 py-1 border-b border-border/20 bg-surface-2/50"
          >
            <span class="text-[10px] text-muted-foreground/50">
              {{ hiddenStoreCount }} hidden store{{ hiddenStoreCount > 1 ? "s" : "" }}
            </span>
            <button
              class="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors"
              @click="showHidden = !showHidden"
            >
              <component :is="showHidden ? Eye : EyeOff" :size="10" />
              {{ showHidden ? "Hide" : "Show" }}
            </button>
          </div>

          <!-- DB + store tree — this is the only scrolling region -->
          <ScrollArea class="flex-1 min-h-0">
            <div v-if="isLoadingDbs || isFetchingDbs" class="flex items-center justify-center py-8">
              <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
            </div>

            <div
              v-else-if="!databases?.length"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <Database :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-muted-foreground/40">No IndexedDB databases found</p>
            </div>

            <ul v-else class="py-1">
              <li v-for="db in getVisibleDatabases()" :key="getDbKey(db)" class="group/db relative">
                <!-- DB header -->
                <div
                  class="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground/70 transition-colors hover:bg-surface-3/50"
                >
                  <button class="flex items-center gap-2 flex-1 min-w-0" @click="toggleDb(db.name)">
                    <component
                      :is="expandedDbs.has(db.name) ? ChevronDown : ChevronRight"
                      :size="12"
                      class="shrink-0 opacity-50"
                    />
                    <Database :size="13" class="shrink-0 opacity-40" />
                    <span
                      class="flex-1 truncate text-left"
                      :class="{ 'opacity-40': isDbHidden(db.origin, db.name) }"
                    >
                      {{ db.name }}
                    </span>
                    <span
                      class="text-[10px] font-mono text-muted-foreground/40 shrink-0"
                      :class="{ 'opacity-40': isDbHidden(db.origin, db.name) }"
                    >
                      v{{ db.version }}
                    </span>
                  </button>
                  <!-- Click DB name to show overview -->
                  <button
                    class="text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors px-1 py-0.5 rounded hover:bg-surface-3"
                    title="View database overview"
                    @click.stop="navigateToDbOverview(db)"
                  >
                    <Database :size="11" />
                  </button>

                  <!-- DB action icons (shown on hover) -->
                  <div class="hidden group-hover/db:flex items-center gap-0.5 shrink-0">
                    <!-- Pin -->
                    <button
                      class="p-0.5 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                      :title="isDbPinned(db.origin, db.name) ? 'Unpin' : 'Pin to top'"
                      @click.stop="togglePinDb(db.origin, db.name)"
                    >
                      <component :is="isDbPinned(db.origin, db.name) ? PinOff : Pin" :size="10" />
                    </button>
                    <!-- Hide -->
                    <button
                      class="p-0.5 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                      :title="isDbHidden(db.origin, db.name) ? 'Unhide' : 'Hide database'"
                      @click.stop="toggleHideDb(db.origin, db.name)"
                    >
                      <component :is="isDbHidden(db.origin, db.name) ? Eye : EyeOff" :size="10" />
                    </button>
                  </div>
                </div>

                <!-- Store list -->
                <ul v-if="expandedDbs.has(db.name)">
                  <li
                    v-for="storeItem in getVisibleStores(db)"
                    :key="storeItem"
                    class="group relative"
                    :data-active-store="isStoreActive(db.name, storeItem) ? '' : undefined"
                  >
                    <button
                      class="flex w-full items-center gap-1.5 py-1.5 pl-[26px] pr-3 text-xs transition-colors"
                      :class="
                        isStoreActive(db.name, storeItem)
                          ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground pl-[24px]'
                          : 'text-foreground/60 hover:bg-surface-3/50 hover:text-foreground/80'
                      "
                      @click="navigateToStore(db, storeItem)"
                    >
                      <!-- Pin indicator dot -->
                      <span
                        v-if="isPinned(db.name, storeItem)"
                        class="shrink-0 w-1.5 h-1.5 rounded-full bg-foreground/30 mr-0.5"
                      />
                      <span
                        class="flex-1 truncate text-left"
                        :class="{ 'opacity-40': isHidden(db.name, storeItem) }"
                      >
                        {{ storeItem }}
                      </span>
                    </button>

                    <!-- Action icons (shown on row hover) -->
                    <div
                      class="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5"
                    >
                      <!-- Pin -->
                      <button
                        class="p-0.5 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                        :title="isPinned(db.name, storeItem) ? 'Unpin' : 'Pin to top'"
                        @click.stop="togglePin(db.name, storeItem)"
                      >
                        <component :is="isPinned(db.name, storeItem) ? PinOff : Pin" :size="10" />
                      </button>
                      <!-- Hide -->
                      <button
                        class="p-0.5 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                        :title="isHidden(db.name, storeItem) ? 'Unhide' : 'Hide store'"
                        @click.stop="toggleHide(db.name, storeItem)"
                      >
                        <component :is="isHidden(db.name, storeItem) ? Eye : EyeOff" :size="10" />
                      </button>
                    </div>
                  </li>

                  <!-- No match state -->
                  <li
                    v-if="storeSearch && getVisibleStores(db).length === 0"
                    class="px-7 py-1.5 text-[10px] text-muted-foreground/30 italic"
                  >
                    No stores match
                  </li>
                </ul>
              </li>
            </ul>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <ResizablePanel :default-size="85" class="min-h-0">
        <!-- No database selected -->
        <div
          v-if="!dbName"
          class="flex h-full items-center justify-center text-sm text-muted-foreground/30"
        >
          Select a database from the sidebar
        </div>

        <!-- Database selected but no store → show overview -->
        <template v-else-if="!storeName && selectedDbInfo">
          <IDBDatabaseOverview
            :db-name="selectedDbInfo.name"
            :db-version="selectedDbInfo.version"
            :db-origin="selectedDbInfo.origin"
            :store-count="selectedDbInfo.objectStoreNames.length"
            :stores="storeInfoData ?? []"
            :is-loading="isLoadingStoreInfo"
            :is-error="isStoreInfoError"
            :total-idb-size="storageSizeData?.idb"
            @select-store="handleSelectStore"
            @refresh="void refetchStoreInfo()"
          />
        </template>

        <!-- Store selected → show table -->
        <template v-else>
          <div class="flex flex-col h-full overflow-hidden">
            <IDBTableToolbar
              :store-name="storeName"
              :db-name="dbName"
              :is-loading="isLoading"
              :page="page"
              :page-size="pageSize"
              :has-more="hasMore"
              :record-count="totalRecords"
              @refresh="refetch"
              @prev="prevPage"
              @next="nextPage"
              @page-size-change="handlePageSizeChange"
            />

            <div
              v-if="isError"
              class="shrink-0 border-b border-border/30 bg-error/[0.06] px-4 py-2 text-xs text-error"
            >
              Failed to load records. Make sure the target supports IndexedDB inspection.
            </div>

            <IDBTable
              :records="filteredRecords"
              :is-loading="isLoading"
              :store-name="storeName"
              :db-name="dbName"
              :total-records="totalRecords"
              :store-info="storeInfoData ?? []"
              :fetch-record="fetchSingleRecord"
              @refresh="refetch"
              @record-edit="handleRecordEdit"
              @record-delete="handleRecordDelete"
              @record-delete-bulk="handleRecordDeleteBulk"
            />
          </div>
        </template>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
