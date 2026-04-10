<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Database, ChevronRight, ChevronDown, Search, RefreshCw, Table2 } from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSQLite } from "@/composables/useSQLite";
import { useAppPackages } from "@/composables/useAppPackages";
import { useDevicesStore } from "@/stores/devices.store";
import type { SqliteDbFile, SqliteTableInfo, SqliteQueryResult } from "@/types/sqlite.types";
import SqliteTable from "./SqliteTable.vue";
import SqliteTableToolbar from "./SqliteTableToolbar.vue";
import SqliteDatabaseOverview from "./SqliteDatabaseOverview.vue";
import AppIcon from "@/modules/devices/AppIcon.vue";
import { Button } from "@/components/ui/button";

const route = useRoute();
const router = useRouter();
const devicesStore = useDevicesStore();
const { scanAllDatabases, openDatabase, tableRows } = useSQLite();

const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");
const { usePackages, getCachedPackage } = useAppPackages(serial);

// Fetch packages in background to populate icons
usePackages("all");

console.log("[sqlite] SqliteExplorer mounted, current route:", route.fullPath);

const dbSearch = ref("");
const isLoadingDbs = ref(false);
const isLoadingTables = ref(false);
const isLoadingRecords = ref(false);
const error = ref<string | null>(null);

// State: flat list of all DBs across all packages
const databases = ref<SqliteDbFile[]>([]);
// Grouped by package for display
const expandedPackages = ref<Set<string>>(new Set());
const tables = ref<SqliteTableInfo[]>([]);

// Route params
const dbName = computed(() => decodeURIComponent((route.params["db"] as string) ?? ""));
const tableName = computed(() => decodeURIComponent((route.params["table"] as string) ?? ""));

// Current DB file info
const currentDb = computed(() => databases.value.find((d) => d.name === dbName.value) ?? null);

// Pagination
const page = ref(0);
const pageSize = ref(50);
const orderBy = ref<string | null>(null);
const orderDir = ref<"ASC" | "DESC" | null>(null);

// Data
const queryResult = ref<SqliteQueryResult | null>(null);
const hasMore = computed(() => {
  if (!queryResult.value) return false;
  return queryResult.value.rowCount >= pageSize.value;
});

async function fetchDatabases() {
  if (!serial.value) return;

  isLoadingDbs.value = true;
  error.value = null;

  try {
    const allDbs = await scanAllDatabases(serial.value);
    databases.value = allDbs.map((db) => ({
      ...db,
      packageName: db.path.split("/")[3] ?? "unknown",
    }));
  } catch (err) {
    error.value = String(err);
    databases.value = [];
  } finally {
    isLoadingDbs.value = false;
  }
}

async function openDb(dbFile: SqliteDbFile) {
  console.log("[sqlite] openDb called:", dbFile.name, "pkg:", dbFile.packageName);
  if (!serial.value || !dbFile.packageName) {
    console.log("[sqlite] openDb missing serial or packageName:", serial.value, dbFile.packageName);
    return;
  }
  isLoadingTables.value = true;
  error.value = null;

  try {
    tables.value = await openDatabase(serial.value, dbFile.packageName, dbFile.path);
    console.log("[sqlite] openDb returned", tables.value.length, "tables");
  } catch (err) {
    error.value = `Failed to open database: ${err}`;
    console.error("[sqlite] openDb error:", err);
    tables.value = [];
  } finally {
    isLoadingTables.value = false;
  }
}

async function fetchTableRows() {
  const dbFile = currentDb.value;
  if (!serial.value || !dbFile?.packageName || !tableName.value) return;

  isLoadingRecords.value = true;
  error.value = null;

  try {
    const result = await tableRows(
      serial.value,
      dbFile.packageName,
      dbFile.path,
      tableName.value,
      page.value * pageSize.value,
      pageSize.value + 1,
      orderBy.value ?? undefined,
      orderDir.value ?? undefined,
    );

    if (result.rows.length > pageSize.value) {
      result.rows = result.rows.slice(0, pageSize.value);
    }
    queryResult.value = result;
  } catch (err) {
    error.value = `Query failed: ${err}`;
    queryResult.value = null;
  } finally {
    isLoadingRecords.value = false;
  }
}

function navigateToDb(db: SqliteDbFile) {
  void router.push(`/storage/sqlite/${encodeURIComponent(db.name)}`);
}

function navigateToTable(db: SqliteDbFile, table: string) {
  void router.push(`/storage/sqlite/${encodeURIComponent(db.name)}/${encodeURIComponent(table)}`);
}

function isDbActive(name: string): boolean {
  return dbName.value === name;
}

function isTableActive(table: string): boolean {
  return tableName.value === table;
}

function getVisibleDatabases(): SqliteDbFile[] {
  const q = dbSearch.value.toLowerCase();
  if (!q) return databases.value;
  return databases.value.filter(
    (db) => db.name.toLowerCase().includes(q) || db.packageName?.toLowerCase().includes(q),
  );
}

function getDatabasesByPackage(): Map<string, SqliteDbFile[]> {
  const map = new Map<string, SqliteDbFile[]>();
  for (const db of getVisibleDatabases()) {
    const pkg = db.packageName ?? "unknown";
    if (!map.has(pkg)) map.set(pkg, []);
    map.get(pkg)!.push(db);
  }
  return map;
}

function togglePackage(pkg: string) {
  if (expandedPackages.value.has(pkg)) {
    expandedPackages.value.delete(pkg);
  } else {
    expandedPackages.value.add(pkg);
  }
}

function prevPage() {
  if (page.value > 0) {
    page.value--;
    void fetchTableRows();
  }
}

function nextPage() {
  if (hasMore.value) {
    page.value++;
    void fetchTableRows();
  }
}

function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 0;
  void fetchTableRows();
}

async function handleRefresh() {
  if (currentDb.value && tableName.value) {
    await openDb(currentDb.value);
    await fetchTableRows();
  } else if (currentDb.value) {
    await openDb(currentDb.value);
  } else {
    await fetchDatabases();
  }
}

// Watch for route changes
watch([dbName, tableName], async ([newDb, newTable], [oldDb]) => {
  page.value = 0;
  orderBy.value = null;
  orderDir.value = null;
  queryResult.value = null;

  // Only clear tables when switching databases, not when selecting a table within the same DB
  if (newDb !== oldDb) {
    tables.value = [];
  }

  if (newDb && newTable) {
    const dbFile = databases.value.find((d) => d.name === newDb);
    if (dbFile) {
      if (newDb !== oldDb || tables.value.length === 0) {
        await openDb(dbFile);
      }
      await fetchTableRows();
    }
  } else if (newDb) {
    const dbFile = databases.value.find((d) => d.name === newDb);
    if (dbFile && (newDb !== oldDb || tables.value.length === 0)) {
      await openDb(dbFile);
    }
  }
});

// Watch for device change
watch(
  () => serial.value,
  (newSerial) => {
    console.log("[sqlite] serial watch fired:", newSerial);
    databases.value = [];
    tables.value = [];
    expandedPackages.value.clear();
    queryResult.value = null;
    void fetchDatabases();
  },
  { immediate: true },
);

// Scroll active table into view
watch([dbName, tableName], async () => {
  await nextTick();
  document.querySelector("[data-active-table]")?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <!-- Sidebar -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30" class="min-h-0">
        <div class="flex h-full flex-col border-r border-border/30 min-h-0">
          <!-- Search -->
          <div class="shrink-0 border-b border-border/20 p-2">
            <div
              class="flex items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
            >
              <Search class="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <input
                v-model="dbSearch"
                class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40 w-full outline-none"
                placeholder="Search databases…"
              />
            </div>
          </div>

          <!-- Database tree -->
          <ScrollArea class="flex-1 min-h-0">
            <div v-if="isLoadingDbs" class="flex items-center justify-center py-8">
              <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
            </div>

            <div
              v-else-if="error"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <Database :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-error/70">{{ error }}</p>
              <button
                class="mt-2 text-[10px] text-muted-foreground/50 underline underline-offset-2 hover:text-foreground/60"
                @click="void fetchDatabases()"
              >
                Retry
              </button>
            </div>

            <div
              v-else-if="!databases.length"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <Database :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-muted-foreground/40">No SQLite databases found</p>
              <p class="text-[10px] text-muted-foreground/30 mt-1">
                Databases are scanned from third-party app packages
              </p>
            </div>

            <ul v-else class="py-1">
              <li
                v-for="[pkg, dbs] in getDatabasesByPackage()"
                :key="pkg"
                class="group-pkg relative"
              >
                <!-- Package header with icon -->
                <div
                  class="flex flex-row w-full items-center gap-2 px-2 py-1.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-surface-3/50"
                  @click="togglePackage(pkg)"
                >
                  <AppIcon
                    :serial="serial"
                    :apk-path="getCachedPackage(pkg)?.apkPath ?? ''"
                    :package-name="pkg"
                    :icon-path="getCachedPackage(pkg)?.iconPath"
                    size="sm"
                  />
                  <Button class="flex text-xs items-start min-w-0 pl-2" variant="ghost">
                    <span class="truncate font-medium">{{ pkg }}</span>
                  </Button>
                </div>

                <!-- DBs in this package -->
                <ul v-if="expandedPackages.has(pkg)">
                  <li v-for="db in dbs" :key="db.path" class="group-db">
                    <button
                      class="flex w-full items-center gap-2 py-1.5 pl-[26px] pr-3 text-xs transition-colors"
                      :class="
                        isDbActive(db.name)
                          ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground pl-[24px]'
                          : 'text-foreground/60 hover:bg-surface-3/50 hover:text-foreground/80'
                      "
                      @click="navigateToDb(db)"
                    >
                      <Database :size="12" class="shrink-0 opacity-40" />
                      <span class="flex-1 truncate text-left">{{ db.name }}</span>
                      <span class="text-[10px] font-mono text-muted-foreground/40">
                        {{ (db.size / 1024).toFixed(0) }}KB
                      </span>
                    </button>

                    <!-- Tables for active DB -->
                    <ul v-if="isDbActive(db.name) && tables.length">
                      <li
                        v-for="t in tables"
                        :key="t.name"
                        :data-active-table="isTableActive(t.name) ? '' : undefined"
                      >
                        <button
                          class="flex w-full items-center gap-1.5 py-1 pl-[44px] pr-3 text-xs transition-colors"
                          :class="
                            isTableActive(t.name)
                              ? 'text-foreground font-medium bg-surface-2 border-l-2 border-foreground pl-[42px]'
                              : 'text-foreground/50 hover:bg-surface-2/50 hover:text-foreground/70'
                          "
                          @click="navigateToTable(db, t.name)"
                        >
                          <Table2 :size="10" class="shrink-0 opacity-40" />
                          <span class="flex-1 truncate text-left">{{ t.name }}</span>
                          <span class="text-[10px] font-mono text-muted-foreground/30">
                            {{ t.rowCount }}
                          </span>
                        </button>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <!-- Main content -->
      <ResizablePanel :default-size="85" class="min-h-0">
        <!-- No database selected -->
        <div
          v-if="!dbName"
          class="flex h-full items-center justify-center text-sm text-muted-foreground/30"
        >
          Select a database from the sidebar
        </div>

        <!-- Database selected but no table → show overview -->
        <template v-else-if="!tableName">
          <SqliteDatabaseOverview
            :db-name="dbName"
            :db-path="currentDb?.path ?? ''"
            :db-size="currentDb?.size ?? 0"
            :package-name="currentDb?.packageName"
            :tables="tables"
            :is-loading="isLoadingTables"
            @select-table="
              (t: string) => {
                const db = databases.find((d) => d.name === dbName);
                if (db) navigateToTable(db, t);
              }
            "
            @refresh="handleRefresh"
          />
        </template>

        <!-- Table selected → show data -->
        <template v-else>
          <div class="flex flex-col h-full overflow-hidden">
            <SqliteTableToolbar
              :table-name="tableName"
              :db-name="dbName"
              :is-loading="isLoadingRecords"
              :page="page"
              :page-size="pageSize"
              :has-more="hasMore"
              :record-count="queryResult?.rowCount ?? 0"
              @refresh="handleRefresh"
              @prev="prevPage"
              @next="nextPage"
              @page-size-change="handlePageSizeChange"
            />

            <div
              v-if="error"
              class="shrink-0 border-b border-border/30 bg-error/[0.06] px-4 py-2 text-xs text-error"
            >
              {{ error }}
            </div>

            <SqliteTable
              :columns="queryResult?.columns ?? []"
              :rows="queryResult?.rows ?? []"
              :is-loading="isLoadingRecords"
              :table-name="tableName"
              :db-name="dbName"
              @refresh="handleRefresh"
            />
          </div>
        </template>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
