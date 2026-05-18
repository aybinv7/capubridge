<script setup lang="ts">
import { ref, computed, watch, nextTick, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Database,
  Search,
  RefreshCw,
  Table2,
  KeyRound,
  Code,
  Play,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Trash2,
  Eraser,
  Download,
  Upload,
  FileCode,
} from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "vue-sonner";
import { useOPFS, useJeepSqlite } from "@/composables/useStorage";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useSQLite } from "@/composables/useSQLite";
import { useLiveRefresh } from "@/composables/useLiveRefresh";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useSqlSessionStore } from "@/stores/sqlSession.store";
import { useSqliteSidebarSettings } from "@/modules/storage/stores/useSqliteSidebarSettings";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import {
  useSqliteChangeIndex,
  useSqliteTableChangeOverlay,
  buildRowKey,
} from "@/modules/storage/changes/useSqliteChangeOverlay";
import type { SqliteChangeSummary } from "@/types/sqliteChanges.types";
import type {
  SqliteDbFile,
  SqliteTableInfo,
  SqliteQueryResult,
  SqliteColumnInfo,
  SqliteIndexInfo,
  SqliteForeignKeyInfo,
} from "@/types/sqlite.types";
import SqliteTable from "./SqliteTable.vue";
import SqliteTableToolbar from "./SqliteTableToolbar.vue";
import SqliteDatabaseOverview from "./SqliteDatabaseOverview.vue";
import SqliteChangeDiffDialog from "./SqliteChangeDiffDialog.vue";
import { diffSqliteSnapshots } from "./diffSqliteSnapshots";
import { useModalGuard } from "@/composables/useModalGuard";
import {
  exportSqliteFile,
  exportSqlDump,
  pickSqliteFile,
  pickSqlDump,
  importSqlDump,
} from "./sqliteImportExport";

const route = useRoute();
const router = useRouter();
const devicesStore = useDevicesStore();
const targetsStore = useTargetsStore();
const sqlSessionStore = useSqlSessionStore();
const {
  listDatabases,
  openDatabase,
  tableRows,
  tableColumns,
  tableIndexes,
  tableForeignKeys,
  executeQuery,
} = useSQLite();
const { getDomain: getJeepSqliteDomain } = useJeepSqlite();
const localWebviewStore = useLocalWebviewStore();

const localSession = computed(() => sqlSessionStore.localSession);
const isLocalMode = computed(() => !!localSession.value);

const {
  showHiddenDbs,
  showHiddenTables,
  togglePinDb,
  isDbPinned,
  toggleHideDb,
  isDbHidden,
  togglePinTable,
  isTablePinned,
  toggleHideTable,
  isTableHidden,
  toggleExpanded,
  isDbExpanded,
  expandDb,
} = useSqliteSidebarSettings();

const serial = computed(
  () => localSession.value?.serial ?? devicesStore.selectedDevice?.serial ?? "",
);
const selectedTarget = computed(() => {
  if (localSession.value) return null;
  const target = targetsStore.selectedTarget;
  if (!target || target.source !== "adb") {
    return null;
  }
  if (target.deviceSerial !== serial.value) {
    return null;
  }
  return target;
});
const selectedPackageName = computed(
  () => localSession.value?.package ?? selectedTarget.value?.packageName?.trim() ?? "",
);

const dbSearch = ref("");
const isLoadingDbs = ref(false);
const isLoadingTables = ref(false);
const isLoadingRecords = ref(false);
const openingJeepDb = ref<string | null>(null);
const error = ref<string | null>(null);

const databases = ref<SqliteDbFile[]>([]);
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

// Table tabs (Browse / Structure / SQL)
const activeTab = ref<"browse" | "structure" | "sql">("browse");
const structureColumns = shallowRef<SqliteColumnInfo[]>([]);
const structureIndexes = shallowRef<SqliteIndexInfo[]>([]);
const structureForeignKeys = shallowRef<SqliteForeignKeyInfo[]>([]);
const isLoadingStructure = ref(false);
const structureError = ref<string | null>(null);

const sqlInput = ref("SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%';");
const sqlResult = shallowRef<SqliteQueryResult | null>(null);
const sqlError = ref<string | null>(null);
const isRunningSql = ref(false);

const currentTable = computed(() => tables.value.find((t) => t.name === tableName.value) ?? null);

const columnInfo = shallowRef<SqliteColumnInfo[]>([]);
const isLoadingColumnInfo = ref(false);
const pkColumnsRef = computed(() =>
  columnInfo.value.filter((c) => c.pk).sort((a, b) => a.cid - b.cid),
);

const changesStore = useSqliteChangesStore();
const { getTableSummary, getDatabaseSummary } = useSqliteChangeIndex();

const overlayDbPath = computed(() => currentDb.value?.path ?? "");
const { changesByRowKey: tableChangesByRowKey, tableSummary: currentTableSummary } =
  useSqliteTableChangeOverlay({
    serial,
    packageName: selectedPackageName,
    dbPath: overlayDbPath,
    tableName,
    pkColumns: pkColumnsRef,
  });

const showChangesOnly = ref(false);

function toggleChangesOnly() {
  showChangesOnly.value = !showChangesOnly.value;
}

const diffChangeId = ref<string | null>(null);

function openRowDiff(rowKey: string) {
  const match = changesStore.changes.find(
    (c) =>
      c.kind === "record" &&
      c.tableName === tableName.value &&
      c.dbPath === (currentDb.value?.path ?? "") &&
      c.rowKey === rowKey,
  );
  if (match) diffChangeId.value = match.id;
}

function closeRowDiff() {
  diffChangeId.value = null;
}

const diffChange = computed(() => {
  if (!diffChangeId.value) return null;
  const c = changesStore.changes.find((entry) => entry.id === diffChangeId.value);
  return c && c.kind === "record" ? c : null;
});

async function fetchColumnInfo() {
  if (!serial.value || !selectedPackageName.value || !currentDb.value || !tableName.value) {
    columnInfo.value = [];
    return;
  }
  isLoadingColumnInfo.value = true;
  try {
    columnInfo.value = await tableColumns(
      serial.value,
      selectedPackageName.value,
      currentDb.value.path,
      tableName.value,
    );
  } catch (err) {
    console.error("[SQLite] fetchColumnInfo failed:", err);
    columnInfo.value = [];
  } finally {
    isLoadingColumnInfo.value = false;
  }
}

async function fetchStructure() {
  if (!serial.value || !selectedPackageName.value || !currentDb.value || !tableName.value) {
    structureColumns.value = [];
    structureIndexes.value = [];
    structureForeignKeys.value = [];
    return;
  }
  isLoadingStructure.value = true;
  structureError.value = null;
  try {
    const [cols, idx, fks] = await Promise.all([
      tableColumns(serial.value, selectedPackageName.value, currentDb.value.path, tableName.value),
      tableIndexes(serial.value, selectedPackageName.value, currentDb.value.path, tableName.value),
      tableForeignKeys(
        serial.value,
        selectedPackageName.value,
        currentDb.value.path,
        tableName.value,
      ),
    ]);
    structureColumns.value = cols;
    structureIndexes.value = idx;
    structureForeignKeys.value = fks;
  } catch (err) {
    structureError.value = String(err);
  } finally {
    isLoadingStructure.value = false;
  }
}

async function runSql() {
  if (!serial.value || !selectedPackageName.value || !currentDb.value) {
    sqlError.value = "No active database";
    return;
  }
  isRunningSql.value = true;
  sqlError.value = null;
  try {
    sqlResult.value = await executeQuery(
      serial.value,
      selectedPackageName.value,
      currentDb.value.path,
      sqlInput.value,
    );
  } catch (err) {
    sqlError.value = String(err);
    sqlResult.value = null;
  } finally {
    isRunningSql.value = false;
  }
}

function renderCell(value: unknown): { text: string; tone: "null" | "blob" | "value" } {
  if (value === null || value === undefined) return { text: "NULL", tone: "null" };
  if (typeof value === "string" && value.startsWith("[BLOB ")) return { text: value, tone: "blob" };
  if (typeof value === "object") return { text: JSON.stringify(value), tone: "value" };
  return { text: String(value), tone: "value" };
}

function sourceNeedsLiveTarget(kind: string | undefined): boolean {
  return kind === "opfs" || kind === "jeep-sqlite";
}

function isLocalSessionStale(): boolean {
  const session = localSession.value;
  if (!session) return false;
  const needsLiveTarget =
    sourceNeedsLiveTarget(session.sourceKind) || !!session.sourceOpfsPath || !!session.sourceKey;
  if (!needsLiveTarget) return false;
  if (!session.sourceTargetId) return true;
  return session.sourceTargetId !== targetsStore.cdpTargetId;
}

async function fetchJeepSqliteDatabases(): Promise<SqliteDbFile[]> {
  if (!targetsStore.cdpTargetId) return [];
  try {
    const dbs = await getJeepSqliteDomain().listDatabases();
    return dbs.map((db) => ({
      name: db.name,
      path: `jeep-sqlite:${db.idbName}/${db.storeName}/${db.key}`,
      size: db.size,
      packageName: selectedPackageName.value || "jeep-sqlite",
      sourceKind: "jeep-sqlite",
      sourceLabel: "jeep-sqlite",
      sourceTargetId: targetsStore.cdpTargetId,
      sourceIdbName: db.idbName,
      sourceStoreName: db.storeName,
      sourceKey: db.key,
    }));
  } catch (err) {
    console.error("[SQLite] fetchJeepSqliteDatabases failed:", err);
    return [];
  }
}

async function fetchDatabases() {
  if (localSession.value) {
    if (isLocalSessionStale()) {
      sqlSessionStore.clearLocalSession();
      databases.value = [];
      tables.value = [];
      queryResult.value = null;
      await router.replace("/storage/sqlite");
      return;
    }
    const s = localSession.value;
    databases.value = [
      {
        name: s.fileName,
        path: s.dbPath,
        size: s.sizeBytes,
        packageName: s.package,
        sourceKind: s.sourceKind,
        sourceLabel: s.sourceLabel,
        sourceTargetId: s.sourceTargetId,
        sourceIdbName: s.sourceIdbName,
        sourceStoreName: s.sourceStoreName,
        sourceKey: s.sourceKey,
      },
    ];
    return;
  }

  isLoadingDbs.value = true;
  error.value = null;

  try {
    const shouldListNative = !!serial.value && !!selectedPackageName.value;
    const [nativeResult, jeepResult] = await Promise.allSettled([
      shouldListNative
        ? listDatabases(serial.value, selectedPackageName.value)
        : Promise.resolve<SqliteDbFile[]>([]),
      fetchJeepSqliteDatabases(),
    ]);
    if (nativeResult.status === "rejected" && jeepResult.status === "rejected") {
      throw nativeResult.reason;
    }
    if (nativeResult.status === "rejected") {
      error.value = String(nativeResult.reason);
    }
    const nativeDbs = nativeResult.status === "fulfilled" ? nativeResult.value : [];
    const jeepDbs = jeepResult.status === "fulfilled" ? jeepResult.value : [];
    databases.value = [
      ...nativeDbs.map((db) => ({
        ...db,
        packageName: db.packageName ?? selectedPackageName.value,
        sourceKind: db.sourceKind ?? "native-android",
        sourceLabel: db.sourceLabel ?? "native",
      })),
      ...jeepDbs,
    ];
  } catch (err) {
    error.value = String(err);
    databases.value = [];
  } finally {
    isLoadingDbs.value = false;
  }
}

async function openDb(dbFile: SqliteDbFile) {
  if (!serial.value || !selectedPackageName.value) {
    return;
  }
  isLoadingTables.value = true;
  error.value = null;

  try {
    tables.value = await openDatabase(serial.value, selectedPackageName.value, dbFile.path);
  } catch (err) {
    error.value = `Failed to open database: ${err}`;
    tables.value = [];
  } finally {
    isLoadingTables.value = false;
  }
}

async function fetchTableRows() {
  const dbFile = currentDb.value;
  if (!serial.value || !selectedPackageName.value || !dbFile || !tableName.value) return;

  isLoadingRecords.value = true;
  error.value = null;

  try {
    const result = await tableRows(
      serial.value,
      selectedPackageName.value,
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

async function openJeepSqliteDb(db: SqliteDbFile) {
  const key = db.sourceKey ?? db.name;
  const idbName = db.sourceIdbName ?? "jeepSQLiteStore";
  const storeName = db.sourceStoreName ?? "databases";
  openingJeepDb.value = db.path;
  try {
    const bytes = await getJeepSqliteDomain().readDatabaseBytes({ key, idbName, storeName });
    const session = await sqlSessionStore.startLocalSession(db.name, bytes, {
      kind: "jeep-sqlite",
      label: "jeep-sqlite",
      targetId: db.sourceTargetId ?? targetsStore.cdpTargetId,
      packageName: "jeep-sqlite",
      idbName,
      storeName,
      key,
    });
    await router.push(`/storage/sqlite/${encodeURIComponent(session.fileName)}`);
  } catch (err) {
    toast.error("Failed to open jeep-sqlite database", { description: String(err) });
  } finally {
    openingJeepDb.value = null;
  }
}

function navigateToDb(db: SqliteDbFile) {
  if (db.sourceKind === "jeep-sqlite") {
    void openJeepSqliteDb(db);
    return;
  }
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

function sourceLabel(db: SqliteDbFile): string {
  if (db.sourceKind === "jeep-sqlite") return "jeep";
  if (db.sourceKind === "opfs") return "opfs";
  if (db.sourceKind === "imported") return "file";
  return "native";
}

function sourceBadgeClass(db: SqliteDbFile): string {
  if (db.sourceKind === "jeep-sqlite")
    return "border-violet-500/25 text-violet-300 bg-violet-500/10";
  if (db.sourceKind === "opfs") return "border-info/25 text-info bg-info/10";
  if (db.sourceKind === "imported") return "border-amber-500/25 text-amber-300 bg-amber-500/10";
  return "border-emerald-500/20 text-emerald-300 bg-emerald-500/10";
}

const visibleDatabases = computed(() => {
  const q = dbSearch.value.toLowerCase();
  return databases.value
    .filter((db) => {
      if (isDbHidden(db.path) && !showHiddenDbs.value) return false;
      if (q) {
        const matchDb = db.name.toLowerCase().includes(q) || db.path.toLowerCase().includes(q);
        const matchTable =
          isDbExpanded(db.path) && tables.value.some((t) => t.name.toLowerCase().includes(q));
        if (!matchDb && !matchTable) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const pa = isDbPinned(a.path) ? 0 : 1;
      const pb = isDbPinned(b.path) ? 0 : 1;
      return pa - pb || a.name.localeCompare(b.name);
    });
});

function getVisibleTables(dbPath: string): SqliteTableInfo[] {
  const q = dbSearch.value.toLowerCase();
  return tables.value
    .filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (isTableHidden(dbPath, t.name) && !showHiddenTables.value) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = isTablePinned(dbPath, a.name) ? 0 : 1;
      const pb = isTablePinned(dbPath, b.name) ? 0 : 1;
      return pa - pb || a.name.localeCompare(b.name);
    });
}

const hiddenDbCount = computed(() => databases.value.filter((db) => isDbHidden(db.path)).length);
const hiddenTableCount = computed(() => {
  const db = currentDb.value;
  if (!db) return 0;
  return tables.value.filter((t) => isTableHidden(db.path, t.name)).length;
});

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

const { getDomain: getOpfsDomain } = useOPFS();

async function refreshLocalSnapshot() {
  const s = localSession.value;
  if (!s) return;
  if (isLocalSessionStale()) {
    sqlSessionStore.clearLocalSession();
    databases.value = [];
    tables.value = [];
    queryResult.value = null;
    await router.replace("/storage/sqlite");
    return;
  }
  try {
    let nextHash: string | null = null;
    if (s.sourceKind === "opfs" && s.sourceOpfsPath) {
      nextHash = await getOpfsDomain().hashSqliteBytes(s.sourceOpfsPath, {
        stripSahPoolHeader: s.stripSahPoolHeader ?? false,
      });
    } else if (s.sourceKind === "jeep-sqlite" && s.sourceKey) {
      nextHash = await getJeepSqliteDomain().hashDatabaseBytes({
        key: s.sourceKey,
        idbName: s.sourceIdbName,
        storeName: s.sourceStoreName,
      });
    }
    if (nextHash && nextHash === sqlSessionStore.lastSourceHash) {
      return;
    }

    let bytes: Uint8Array | null = null;
    if (s.sourceKind === "opfs" && s.sourceOpfsPath) {
      bytes = await getOpfsDomain().readSqliteBytes(s.sourceOpfsPath, {
        stripSahPoolHeader: s.stripSahPoolHeader ?? false,
      });
    }
    if (s.sourceKind === "jeep-sqlite" && s.sourceKey) {
      bytes = await getJeepSqliteDomain().readDatabaseBytes({
        key: s.sourceKey,
        idbName: s.sourceIdbName,
        storeName: s.sourceStoreName,
      });
    }
    if (!bytes) return;
    sqlSessionStore.setLastSourceHash(nextHash);
    const previous = sqlSessionStore.swapSnapshot(bytes);
    if (previous && previous.byteLength > 0 && bytes.byteLength > 0) {
      try {
        const diff = await diffSqliteSnapshots(previous, bytes);
        for (const op of diff.changes) {
          changesStore.recordChange({
            operation: op.operation,
            serial: serial.value,
            packageName: selectedPackageName.value,
            dbPath: s.dbPath,
            tableName: op.tableName,
            rowKey: op.rowKey,
            beforeValue: op.beforeValue,
            afterValue: op.afterValue,
          });
        }
        if (diff.truncated) {
          changesStore.recordSystemChange({
            serial: serial.value,
            packageName: selectedPackageName.value,
            dbPath: s.dbPath,
            message: `Snapshot diff truncated — more than ${diff.changes.length} ops detected`,
          });
        }
      } catch (err) {
        console.error("[SQLite] snapshot diff failed:", err);
      }
    }
    await sqlSessionStore.refreshLocalSession(bytes);
  } catch (err) {
    console.error("[SQLite] refreshLocalSnapshot failed:", err);
  }
}

async function handleRefresh() {
  if (
    localSession.value?.sourceKind === "opfs" ||
    localSession.value?.sourceKind === "jeep-sqlite"
  ) {
    await refreshLocalSnapshot();
  }
  if (currentDb.value && tableName.value) {
    await openDb(currentDb.value);
    await fetchTableRows();
    await fetchColumnInfo();
    if (activeTab.value === "structure") {
      structureColumns.value = [];
      await fetchStructure();
    }
  } else if (currentDb.value) {
    await openDb(currentDb.value);
  } else {
    await fetchDatabases();
  }
}

const { enabled: liveEnabled, intervalMs: liveIntervalMs } = useLiveRefresh(handleRefresh, {
  intervalMs: 5000,
});

function toggleLive() {
  liveEnabled.value = !liveEnabled.value;
}

// ─── Destructive actions + cell edit ──────────────────────────────────────────
const confirmDialog = ref<{
  open: boolean;
  title: string;
  description: string;
  action: () => Promise<void>;
}>({ open: false, title: "", description: "", action: async () => {} });

useModalGuard(computed(() => confirmDialog.value.open));
useModalGuard(computed(() => !!diffChange.value));

function openConfirm(title: string, description: string, action: () => Promise<void>) {
  confirmDialog.value = { open: true, title, description, action };
}

async function runConfirmedAction() {
  try {
    await confirmDialog.value.action();
  } catch (err) {
    toast.error("Action failed", { description: String(err) });
  } finally {
    confirmDialog.value.open = false;
  }
}

async function execAgainstCurrentDb(sql: string): Promise<void> {
  if (!serial.value || !selectedPackageName.value || !currentDb.value) {
    throw new Error("No active database");
  }
  await executeQuery(serial.value, selectedPackageName.value, currentDb.value.path, sql);
}

function handleClearTable(db: SqliteDbFile, table: string) {
  openConfirm(
    "Clear all rows",
    `Delete every row in "${table}"? This cannot be undone.`,
    async () => {
      await execAgainstCurrentDb(`DELETE FROM ${quoteIdent(table)}`);
      changesStore.recordSystemChange({
        serial: serial.value,
        packageName: selectedPackageName.value,
        dbPath: db.path,
        tableName: table,
        message: `Cleared all rows from "${table}"`,
      });
      await handleRefresh();
      toast.success(`Cleared "${table}"`);
    },
  );
}

function handleDropTable(db: SqliteDbFile, table: string) {
  openConfirm(
    "Drop table",
    `Permanently drop the table "${table}" and all its data? The schema will lose this table.`,
    async () => {
      await execAgainstCurrentDb(`DROP TABLE ${quoteIdent(table)}`);
      changesStore.recordSystemChange({
        serial: serial.value,
        packageName: selectedPackageName.value,
        dbPath: db.path,
        tableName: table,
        message: `Dropped table "${table}"`,
      });
      if (tableName.value === table) {
        await router.replace(`/storage/sqlite/${encodeURIComponent(dbName.value)}`);
      }
      await openDb(db);
      toast.success(`Dropped "${table}"`);
    },
  );
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function describeDbSource(db: SqliteDbFile): string {
  if (db.sourceKind === "jeep-sqlite") {
    return `Capacitor jeep-sqlite database "${db.name}" (IndexedDB ${db.sourceIdbName ?? "jeepSQLiteStore"} / ${db.sourceStoreName ?? "databases"})`;
  }
  if (db.sourceKind === "opfs") {
    return `OPFS database "${db.name}" (${db.path})`;
  }
  return `Database "${db.name}"`;
}

function describeOpfsDeleteError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/NoModificationAllowedError|not allowed/i.test(message)) {
    return (
      "The file is currently held by the running app (SAH-Pool / WebSQL " +
      "wrapper / OPFS access handle). Close or reload that app first, then " +
      "retry — or try the SAH-Pool soft release path."
    );
  }
  if (/NotFoundError|not found/i.test(message)) {
    return "File no longer exists at that OPFS path.";
  }
  return message;
}

function findSourceWebviewInfo(db: SqliteDbFile): { label: string; url: string } | null {
  const s = localSession.value;
  const targetId = db.sourceTargetId ?? s?.sourceTargetId;
  if (!targetId) return null;
  const target = targetsStore.targets.find((t) => t.id === targetId);
  if (!target?.localWebviewLabel || !target.url) return null;
  return { label: target.localWebviewLabel, url: target.url };
}

async function forceReleaseAndDelete(opfsPath: string, db: SqliteDbFile): Promise<void> {
  const info = findSourceWebviewInfo(db);
  if (!info) {
    throw new Error(
      "Can't force-release: source webview info missing. Close or reload the source app manually, then retry.",
    );
  }
  const opfs = getOpfsDomain();
  await localWebviewStore.navigateSource(info.label, "about:blank");
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      try {
        await opfs.deleteEntry(opfsPath);
        return;
      } catch (err) {
        if (attempt === 5) throw err;
      }
    }
  } finally {
    void localWebviewStore.navigateSource(info.label, info.url).catch(() => null);
  }
}

async function deleteDatabaseAtSource(db: SqliteDbFile): Promise<void> {
  const s = localSession.value;
  if (db.sourceKind === "imported") {
    // Imported files have no live source — just drop the in-memory session.
    return;
  }
  if (db.sourceKind === "jeep-sqlite") {
    const key = db.sourceKey ?? s?.sourceKey ?? db.name;
    await getJeepSqliteDomain().deleteDatabase({
      key,
      idbName: db.sourceIdbName ?? s?.sourceIdbName,
      storeName: db.sourceStoreName ?? s?.sourceStoreName,
    });
    return;
  }
  if (db.sourceKind === "opfs") {
    const opfsPath = db.sourceOpfsPath ?? s?.sourceOpfsPath;
    if (!opfsPath) throw new Error("OPFS path not available for this database");
    const isSahPoolSlot = db.stripSahPoolHeader ?? s?.stripSahPoolHeader ?? false;
    const opfs = getOpfsDomain();
    try {
      await opfs.deleteEntry(opfsPath);
      return;
    } catch (err) {
      const collected: string[] = [describeOpfsDeleteError(err)];
      if (isSahPoolSlot) {
        try {
          const result = await opfs.releaseSahPoolSlot(opfsPath);
          toast.info(
            result.via === "sah"
              ? "Released SAH-Pool slot — the pool will reclaim it on next maintenance."
              : "Cleared SAH-Pool header via writable handle — slot is now free.",
          );
          return;
        } catch (slotErr) {
          collected.push(describeOpfsDeleteError(slotErr));
        }
      }
      try {
        await forceReleaseAndDelete(opfsPath, db);
        toast.info("Force-released via about:blank — source webview restored.");
        return;
      } catch (forceErr) {
        collected.push(describeOpfsDeleteError(forceErr));
      }
      throw new Error(
        `Couldn't delete OPFS file. Tried: removeEntry, ${isSahPoolSlot ? "SAH-Pool soft release, " : ""}force navigate-to-blank. Details: ${collected.join(" | ")}`,
      );
    }
  }
  throw new Error(
    `Deleting "${db.sourceLabel ?? db.sourceKind ?? "unknown"}" databases isn't supported yet.`,
  );
}

async function handleExportSqliteFile(db: SqliteDbFile) {
  const target = resolveDbTarget(db);
  if (!target) return;
  const promise = exportSqliteFile(target.serial, target.pkg, db.path, db.name);
  toast.promise(promise, {
    loading: `Exporting "${db.name}"…`,
    success: (saved) => (saved ? `Exported "${db.name}" to ${saved}` : "Export cancelled"),
    error: (err: unknown) => `Export failed: ${err instanceof Error ? err.message : String(err)}`,
  });
}

async function handleExportSqlDump(db: SqliteDbFile) {
  const target = resolveDbTarget(db);
  if (!target) return;
  let tableList: SqliteTableInfo[] = tables.value;
  if (currentDb.value?.path !== db.path || tableList.length === 0) {
    try {
      tableList = await openDatabase(target.serial, target.pkg, db.path);
    } catch (err) {
      toast.error("Could not enumerate tables", { description: String(err) });
      return;
    }
  }
  const promise = exportSqlDump(target.serial, target.pkg, db.path, tableList, db.name);
  toast.promise(promise, {
    loading: `Building SQL dump for "${db.name}"…`,
    success: (saved) => (saved ? `Exported "${db.name}.sql" to ${saved}` : "Export cancelled"),
    error: (err: unknown) => `Export failed: ${err instanceof Error ? err.message : String(err)}`,
  });
}

function resolveDbTarget(db: SqliteDbFile): { serial: string; pkg: string } | null {
  const pkg = db.packageName ?? selectedPackageName.value;
  if (!serial.value || !pkg) {
    toast.error("No active database", {
      description: "Select a target package or import a local file first.",
    });
    return null;
  }
  return { serial: serial.value, pkg };
}

async function handleImportSqliteFile() {
  let picked;
  try {
    picked = await pickSqliteFile();
  } catch (err) {
    toast.error("Could not read file", { description: String(err) });
    return;
  }
  if (!picked) return;
  try {
    const session = await sqlSessionStore.startLocalSession(picked.name, picked.bytes, {
      kind: "imported",
      label: "file",
    });
    await router.push(`/storage/sqlite/${encodeURIComponent(session.fileName)}`);
    toast.success(`Opened "${picked.name}" as a local session`);
  } catch (err) {
    toast.error("Import failed", { description: String(err) });
  }
}

async function handleImportSqlDumpInto(db: SqliteDbFile) {
  const target = resolveDbTarget(db);
  if (!target) return;
  let picked;
  try {
    picked = await pickSqlDump();
  } catch (err) {
    toast.error("Could not read SQL file", { description: String(err) });
    return;
  }
  if (!picked) return;

  openConfirm(
    "Import SQL dump (replace)",
    `Drop all user tables in "${db.name}" and replay "${picked.name}"? ` +
      (localSession.value
        ? "This rewrites the local snapshot."
        : "Native Android DBs are mutated in the local cache only — changes do not push back to the device."),
    async () => {
      let existing = tables.value;
      if (currentDb.value?.path !== db.path || existing.length === 0) {
        try {
          existing = await openDatabase(target.serial, target.pkg, db.path);
        } catch (err) {
          toast.error("Could not list existing tables", { description: String(err) });
          return;
        }
      }
      const promise = importSqlDump(target.serial, target.pkg, db.path, existing, picked.sql)
        .then(() => handleRefresh())
        .then(() => picked.name);
      await toast.promise(promise, {
        loading: `Replaying "${picked.name}"…`,
        success: (name) => `Imported "${name}"`,
        error: (err: unknown) =>
          `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    },
  );
}

function handleDeleteDatabase(db: SqliteDbFile) {
  openConfirm(
    "Delete database",
    `Permanently delete ${describeDbSource(db)}? This removes it at the source and cannot be undone.`,
    async () => {
      try {
        await deleteDatabaseAtSource(db);
      } catch (err) {
        toast.error("Delete failed", { description: String(err) });
        return;
      }
      changesStore.recordSystemChange({
        serial: serial.value,
        packageName: selectedPackageName.value,
        dbPath: db.path,
        message: `Deleted database "${db.name}" at source`,
      });
      changesStore.clearDatabaseChanges(serial.value, selectedPackageName.value, db.path);
      if (localSession.value && localSession.value.dbPath === db.path) {
        sqlSessionStore.clearLocalSession();
        await router.replace("/storage/sqlite");
      } else if (dbName.value === db.name) {
        await router.replace("/storage/sqlite");
      }
      databases.value = databases.value.filter((entry) => entry.path !== db.path);
      tables.value = [];
      queryResult.value = null;
      toast.success(`Deleted "${db.name}"`);
    },
  );
}

function hasSummaryChanges(summary: SqliteChangeSummary) {
  return summary.total > 0;
}

function getSummarySegments(summary: SqliteChangeSummary) {
  return [
    { key: "add", count: summary.add, class: "bg-emerald-500" },
    { key: "update", count: summary.update, class: "bg-amber-500" },
    { key: "delete", count: summary.delete, class: "bg-red-500" },
  ].filter((entry) => entry.count > 0);
}

function getDatabaseSummaryStyle(summary: SqliteChangeSummary) {
  if (summary.total === 0) return {};
  const color = summary.delete > 0 ? "239,68,68" : summary.update > 0 ? "245,158,11" : "16,185,129";
  return {
    background: `linear-gradient(90deg, rgba(${color}, 0.12), rgba(${color}, 0.035) 42%, transparent 92%)`,
  };
}

function formatSummary(summary: SqliteChangeSummary) {
  return [
    summary.add > 0 ? `${summary.add} added` : "",
    summary.update > 0 ? `${summary.update} updated` : "",
    summary.delete > 0 ? `${summary.delete} deleted` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function dbSummary(db: SqliteDbFile) {
  return getDatabaseSummary(serial.value, selectedPackageName.value, db.path);
}

function tableSummary(db: SqliteDbFile, table: string) {
  return getTableSummary(serial.value, selectedPackageName.value, db.path, table);
}

function quoteSqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function pkColumns(): SqliteColumnInfo[] {
  return columnInfo.value.filter((c) => c.pk).sort((a, b) => a.cid - b.cid);
}

async function handleRecordEdit(
  original: Record<string, unknown>,
  updated: Record<string, unknown>,
) {
  if (!serial.value || !selectedPackageName.value || !currentDb.value || !tableName.value) return;
  const pks = pkColumns();
  if (pks.length === 0) {
    toast.error("Cannot save", { description: "Table has no primary key." });
    return;
  }

  const changed: string[] = [];
  for (const col of columnInfo.value) {
    if (pks.some((p) => p.name === col.name)) continue;
    const before = original[col.name];
    const after = updated[col.name];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed.push(`${quoteIdent(col.name)} = ${quoteSqlValue(after)}`);
    }
  }
  if (changed.length === 0) {
    toast.info("Nothing to save", { description: "No editable fields changed." });
    return;
  }

  const where = pks
    .map((c) => `${quoteIdent(c.name)} = ${quoteSqlValue(original[c.name])}`)
    .join(" AND ");

  const sql = `UPDATE ${quoteIdent(tableName.value)} SET ${changed.join(", ")} WHERE ${where}`;
  try {
    await execAgainstCurrentDb(sql);
    changesStore.recordChange({
      operation: "update",
      serial: serial.value,
      packageName: selectedPackageName.value,
      dbPath: currentDb.value.path,
      tableName: tableName.value,
      rowKey: buildRowKey(pkColumnsRef.value, original),
      beforeValue: original,
      afterValue: updated,
    });
    await fetchTableRows();
    toast.success("Row saved");
  } catch (err) {
    toast.error("Save failed", { description: String(err) });
  }
}

function handleRecordDelete(record: Record<string, unknown>) {
  const db = currentDb.value;
  if (!serial.value || !selectedPackageName.value || !db || !tableName.value) return;
  const pks = pkColumns();
  if (pks.length === 0) {
    toast.error("Cannot delete", { description: "Table has no primary key." });
    return;
  }
  const where = pks
    .map((c) => `${quoteIdent(c.name)} = ${quoteSqlValue(record[c.name])}`)
    .join(" AND ");
  openConfirm("Delete row", "Permanently delete this row? This cannot be undone.", async () => {
    await execAgainstCurrentDb(`DELETE FROM ${quoteIdent(tableName.value)} WHERE ${where}`);
    changesStore.recordChange({
      operation: "delete",
      serial: serial.value,
      packageName: selectedPackageName.value,
      dbPath: db.path,
      tableName: tableName.value,
      rowKey: buildRowKey(pkColumnsRef.value, record),
      beforeValue: record,
      afterValue: null,
    });
    await fetchTableRows();
    toast.success("Row deleted");
  });
}

// Watch for route changes
watch([dbName, tableName], async ([newDb, newTable], [oldDb]) => {
  page.value = 0;
  orderBy.value = null;
  orderDir.value = null;
  queryResult.value = null;
  activeTab.value = "browse";
  structureColumns.value = [];
  structureIndexes.value = [];
  structureForeignKeys.value = [];
  structureError.value = null;
  columnInfo.value = [];
  showChangesOnly.value = false;
  diffChangeId.value = null;

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
      await Promise.all([fetchTableRows(), fetchColumnInfo()]);
    }
  } else if (newDb) {
    const dbFile = databases.value.find((d) => d.name === newDb);
    if (dbFile && (newDb !== oldDb || tables.value.length === 0)) {
      await openDb(dbFile);
    }
  }
});

watch(
  [serial, selectedPackageName, () => targetsStore.cdpTargetId],
  async () => {
    databases.value = [];
    tables.value = [];
    queryResult.value = null;
    page.value = 0;
    orderBy.value = null;
    orderDir.value = null;

    await fetchDatabases();

    if (!currentDb.value && (dbName.value || tableName.value)) {
      await router.replace("/storage/sqlite");
      return;
    }

    if (currentDb.value) {
      await openDb(currentDb.value);
      if (tableName.value) {
        await fetchTableRows();
      }
    }
  },
  { immediate: true },
);

watch([dbName, tableName], async () => {
  await nextTick();
  document.querySelector("[data-active-table]")?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
});

watch(activeTab, (next) => {
  if (next === "structure" && structureColumns.value.length === 0 && tableName.value) {
    void fetchStructure();
  }
});

watch(
  currentDb,
  (db) => {
    if (db) expandDb(db.path);
  },
  { immediate: true },
);

watch(
  () => targetsStore.cdpTargetId,
  () => {
    if (!isLocalSessionStale()) return;
    sqlSessionStore.clearLocalSession();
    databases.value = [];
    tables.value = [];
    queryResult.value = null;
    void router.replace("/storage/sqlite");
  },
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <!-- Sidebar -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30" class="min-h-0">
        <div class="flex h-full flex-col border-r border-border/30 min-h-0">
          <!-- Search -->
          <div class="shrink-0 border-b border-border/20 p-2 flex items-center gap-1">
            <div
              class="flex flex-1 items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
            >
              <Search class="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <input
                v-model="dbSearch"
                class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40 w-full outline-none"
                placeholder="Search databases…"
              />
            </div>
            <button
              class="shrink-0 p-1.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors"
              title="Import .sqlite file (opens as local session)"
              @click="handleImportSqliteFile()"
            >
              <Upload :size="12" />
            </button>
          </div>

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

          <div
            v-if="hiddenTableCount > 0"
            class="shrink-0 flex items-center justify-between px-3 py-1 border-b border-border/20 bg-surface-2/50"
          >
            <span class="text-[10px] text-muted-foreground/50">
              {{ hiddenTableCount }} hidden table{{ hiddenTableCount > 1 ? "s" : "" }}
            </span>
            <button
              class="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors"
              @click="showHiddenTables = !showHiddenTables"
            >
              <component :is="showHiddenTables ? Eye : EyeOff" :size="10" />
              {{ showHiddenTables ? "Hide" : "Show" }}
            </button>
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
              <p class="text-[11px] text-muted-foreground/40">
                {{ selectedPackageName ? "No SQLite databases found" : "No target selected" }}
              </p>
              <p class="mt-1 text-[10px] text-muted-foreground/30">
                {{
                  selectedPackageName
                    ? "The selected target package does not expose databases/"
                    : "Pick a debuggable app target — or import a .sqlite file to explore"
                }}
              </p>
              <button
                class="mt-3 flex items-center gap-1.5 rounded border border-border/30 bg-surface-3 px-2.5 py-1 text-[10px] text-foreground/70 hover:bg-surface-2 transition-colors"
                @click="handleImportSqliteFile()"
              >
                <Upload :size="10" />
                Import .sqlite file
              </button>
            </div>

            <ul v-else class="py-1">
              <li v-for="db in visibleDatabases" :key="db.path" class="group/db relative">
                <div
                  class="relative flex w-full items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-surface-3/50"
                  :class="
                    isDbActive(db.name)
                      ? 'bg-surface-3 text-foreground font-medium'
                      : 'text-foreground/70'
                  "
                  :style="getDatabaseSummaryStyle(dbSummary(db))"
                >
                  <div
                    v-if="hasSummaryChanges(dbSummary(db))"
                    class="pointer-events-none absolute left-0 top-1.5 bottom-1.5 z-10 flex w-1 overflow-hidden rounded-r"
                    :title="formatSummary(dbSummary(db))"
                  >
                    <span
                      v-for="segment in getSummarySegments(dbSummary(db))"
                      :key="segment.key"
                      class="min-h-1 flex-1"
                      :class="segment.class"
                    />
                  </div>
                  <button
                    class="shrink-0 p-0.5 text-muted-foreground/50 hover:text-foreground"
                    @click="toggleExpanded(db.path)"
                  >
                    <component
                      :is="isDbExpanded(db.path) ? ChevronDown : ChevronRight"
                      :size="12"
                    />
                  </button>
                  <button class="flex flex-1 min-w-0 items-center gap-2" @click="navigateToDb(db)">
                    <Database :size="12" class="shrink-0 opacity-40" />
                    <span
                      class="flex-1 truncate text-left"
                      :class="{ 'opacity-40': isDbHidden(db.path) }"
                    >
                      {{ db.name }}
                    </span>
                    <span
                      class="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-mono leading-none"
                      :class="sourceBadgeClass(db)"
                    >
                      {{ sourceLabel(db) }}
                    </span>
                    <RefreshCw
                      v-if="openingJeepDb === db.path"
                      :size="10"
                      class="shrink-0 animate-spin text-muted-foreground/40"
                    />
                    <span class="shrink-0 text-[10px] font-mono text-muted-foreground/40">
                      {{ (db.size / 1024).toFixed(0) }}KB
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <button
                        class="shrink-0 rounded p-0.5 opacity-0 transition-colors hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 group-hover/db:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                        title="Database actions"
                        @click.stop
                      >
                        <MoreVertical :size="12" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem @click="togglePinDb(db.path)">
                        <component
                          :is="isDbPinned(db.path) ? PinOff : Pin"
                          class="h-3.5 w-3.5 mr-2"
                        />
                        {{ isDbPinned(db.path) ? "Unpin database" : "Pin database" }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="toggleHideDb(db.path)">
                        <component
                          :is="isDbHidden(db.path) ? Eye : EyeOff"
                          class="h-3.5 w-3.5 mr-2"
                        />
                        {{ isDbHidden(db.path) ? "Unhide database" : "Hide database" }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem @click="handleExportSqliteFile(db)">
                        <Download class="h-3.5 w-3.5 mr-2" />
                        Export .sqlite file
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleExportSqlDump(db)">
                        <FileCode class="h-3.5 w-3.5 mr-2" />
                        Export SQL dump
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleImportSqlDumpInto(db)">
                        <Upload class="h-3.5 w-3.5 mr-2" />
                        Import SQL dump (replace)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        :disabled="!hasSummaryChanges(dbSummary(db))"
                        @click="
                          changesStore.clearDatabaseChanges(serial, selectedPackageName, db.path)
                        "
                      >
                        <Eraser class="h-3.5 w-3.5 mr-2" />
                        Clear DB changes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-error focus:text-error"
                        @click="handleDeleteDatabase(db)"
                      >
                        <Trash2 class="h-3.5 w-3.5 mr-2" />
                        Delete database
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <ul v-if="isDbExpanded(db.path) && isDbActive(db.name) && tables.length">
                  <li
                    v-for="t in getVisibleTables(db.path)"
                    :key="t.name"
                    class="group/table relative"
                    :data-active-table="isTableActive(t.name) ? '' : undefined"
                  >
                    <div
                      class="relative flex w-full items-center transition-colors"
                      :class="
                        isTableActive(t.name)
                          ? 'bg-surface-2 text-foreground font-medium border-l-2 border-foreground'
                          : 'text-foreground/50 hover:bg-surface-2/50 hover:text-foreground/70'
                      "
                    >
                      <div
                        v-if="hasSummaryChanges(tableSummary(db, t.name))"
                        class="pointer-events-none absolute left-0 top-1 bottom-1 z-10 flex w-1 overflow-hidden rounded-r"
                        :title="formatSummary(tableSummary(db, t.name))"
                      >
                        <span
                          v-for="segment in getSummarySegments(tableSummary(db, t.name))"
                          :key="segment.key"
                          class="min-h-1 flex-1"
                          :class="segment.class"
                        />
                      </div>
                      <button
                        class="flex flex-1 items-center gap-1.5 py-1 pl-[26px] pr-2 text-xs"
                        @click="navigateToTable(db, t.name)"
                      >
                        <span
                          v-if="isTablePinned(db.path, t.name)"
                          class="shrink-0 w-1.5 h-1.5 rounded-full bg-foreground/30 mr-0.5"
                        />
                        <Table2 :size="10" class="shrink-0 opacity-40" />
                        <span
                          class="flex-1 truncate text-left"
                          :class="{ 'opacity-40': isTableHidden(db.path, t.name) }"
                        >
                          {{ t.name }}
                        </span>
                        <span class="text-[10px] font-mono text-muted-foreground/30">
                          {{ t.rowCount }}
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <button
                            class="shrink-0 rounded p-0.5 mr-1 opacity-0 transition-colors hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 group-hover/table:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                            title="Table actions"
                            @click.stop
                          >
                            <MoreVertical :size="12" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-40">
                          <DropdownMenuItem @click="togglePinTable(db.path, t.name)">
                            <component
                              :is="isTablePinned(db.path, t.name) ? PinOff : Pin"
                              class="h-3.5 w-3.5 mr-2"
                            />
                            {{ isTablePinned(db.path, t.name) ? "Unpin table" : "Pin table" }}
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="toggleHideTable(db.path, t.name)">
                            <component
                              :is="isTableHidden(db.path, t.name) ? Eye : EyeOff"
                              class="h-3.5 w-3.5 mr-2"
                            />
                            {{ isTableHidden(db.path, t.name) ? "Unhide table" : "Hide table" }}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            :disabled="!hasSummaryChanges(tableSummary(db, t.name))"
                            @click="
                              changesStore.clearTableChanges(
                                serial,
                                selectedPackageName,
                                db.path,
                                t.name,
                              )
                            "
                          >
                            <Eraser class="h-3.5 w-3.5 mr-2" />
                            Clear changes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            class="text-error focus:text-error"
                            @click="handleClearTable(db, t.name)"
                          >
                            <Eraser class="h-3.5 w-3.5 mr-2" />
                            Clear all rows
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            class="text-error focus:text-error"
                            @click="handleDropTable(db, t.name)"
                          >
                            <Trash2 class="h-3.5 w-3.5 mr-2" />
                            Drop table
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
            :package-name="selectedPackageName || undefined"
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

        <!-- Table selected → tabbed view (Browse / Structure / SQL) -->
        <template v-else>
          <div class="flex flex-col h-full overflow-hidden">
            <div
              class="flex shrink-0 items-center gap-0.5 border-b border-border/20 bg-surface-1/40 px-2"
            >
              <Button
                variant="ghost"
                size="sm"
                class="h-7 gap-1.5 px-3 text-[11px]"
                :class="
                  activeTab === 'browse'
                    ? 'text-foreground bg-surface-3'
                    : 'text-muted-foreground/60'
                "
                @click="activeTab = 'browse'"
              >
                <Table2 :size="11" /> Browse
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 gap-1.5 px-3 text-[11px]"
                :class="
                  activeTab === 'structure'
                    ? 'text-foreground bg-surface-3'
                    : 'text-muted-foreground/60'
                "
                @click="activeTab = 'structure'"
              >
                <KeyRound :size="11" /> Structure
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 gap-1.5 px-3 text-[11px]"
                :class="
                  activeTab === 'sql' ? 'text-foreground bg-surface-3' : 'text-muted-foreground/60'
                "
                @click="activeTab = 'sql'"
              >
                <Code :size="11" /> SQL
              </Button>
            </div>

            <template v-if="activeTab === 'browse'">
              <SqliteTableToolbar
                :table-name="tableName"
                :db-name="dbName"
                :is-loading="isLoadingRecords"
                :page="page"
                :page-size="pageSize"
                :has-more="hasMore"
                :record-count="queryResult?.rowCount ?? 0"
                :live-enabled="liveEnabled"
                :live-interval-ms="liveIntervalMs"
                :change-summary="currentTableSummary"
                :show-changes-only="showChangesOnly"
                @refresh="handleRefresh"
                @prev="prevPage"
                @next="nextPage"
                @page-size-change="handlePageSizeChange"
                @toggle-live="toggleLive"
                @toggle-changes-only="toggleChangesOnly"
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
                :column-info="columnInfo"
                :changes-by-row-key="tableChangesByRowKey"
                :show-changes-only="showChangesOnly"
                @refresh="handleRefresh"
                @record-edit="handleRecordEdit"
                @record-delete="handleRecordDelete"
                @open-row-diff="openRowDiff"
              />
            </template>

            <template v-else-if="activeTab === 'structure'">
              <ScrollArea class="flex-1">
                <div
                  v-if="isLoadingStructure"
                  class="flex items-center justify-center py-12 text-[11px] text-muted-foreground/50"
                >
                  <RefreshCw :size="14" class="mr-2 animate-spin" />
                  Loading structure…
                </div>

                <div
                  v-else-if="structureError"
                  class="m-4 flex items-start gap-2 rounded-md border border-error/30 bg-error/[0.06] p-3 text-xs text-error"
                >
                  <AlertCircle :size="14" class="mt-0.5 shrink-0" />
                  <span>{{ structureError }}</span>
                </div>

                <div v-else class="space-y-6 px-4 py-4 text-xs">
                  <section>
                    <div class="mb-2 flex items-center gap-2">
                      <Table2 :size="12" class="text-muted-foreground/40" />
                      <span
                        class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                      >
                        Columns
                      </span>
                    </div>
                    <table v-if="structureColumns.length" class="w-full font-mono">
                      <thead>
                        <tr class="text-left text-muted-foreground/40">
                          <th class="py-1.5 font-medium">#</th>
                          <th class="py-1.5 font-medium">Name</th>
                          <th class="py-1.5 font-medium">Type</th>
                          <th class="py-1.5 font-medium">Null</th>
                          <th class="py-1.5 font-medium">Default</th>
                          <th class="py-1.5 font-medium">PK</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="col in structureColumns"
                          :key="col.cid"
                          class="border-t border-border/20 text-secondary-foreground"
                        >
                          <td class="py-1.5 text-muted-foreground/50">{{ col.cid }}</td>
                          <td class="py-1.5">{{ col.name }}</td>
                          <td class="py-1.5 text-muted-foreground/70">{{ col.colType || "—" }}</td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ col.notnull ? "NOT NULL" : "—" }}
                          </td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ col.defaultValue ?? "—" }}
                          </td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ col.pk ? "yes" : "—" }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p v-else class="text-muted-foreground/40">No columns reported.</p>
                  </section>

                  <section v-if="structureIndexes.length">
                    <div
                      class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                    >
                      Indexes
                    </div>
                    <table class="w-full font-mono">
                      <thead>
                        <tr class="text-left text-muted-foreground/40">
                          <th class="py-1.5 font-medium">Name</th>
                          <th class="py-1.5 font-medium">Unique</th>
                          <th class="py-1.5 font-medium">Columns</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="idx in structureIndexes"
                          :key="idx.name"
                          class="border-t border-border/20 text-secondary-foreground"
                        >
                          <td class="py-1.5">{{ idx.name }}</td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ idx.unique ? "yes" : "no" }}
                          </td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ idx.columns.join(", ") || "—" }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section v-if="structureForeignKeys.length">
                    <div
                      class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                    >
                      Foreign keys
                    </div>
                    <table class="w-full font-mono">
                      <thead>
                        <tr class="text-left text-muted-foreground/40">
                          <th class="py-1.5 font-medium">From</th>
                          <th class="py-1.5 font-medium">→</th>
                          <th class="py-1.5 font-medium">To</th>
                          <th class="py-1.5 font-medium">On update</th>
                          <th class="py-1.5 font-medium">On delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="fk in structureForeignKeys"
                          :key="`${fk.id}-${fk.seq}`"
                          class="border-t border-border/20 text-secondary-foreground"
                        >
                          <td class="py-1.5">{{ fk.fromColumn }}</td>
                          <td class="py-1.5 text-muted-foreground/40">→</td>
                          <td class="py-1.5">{{ fk.toTable }}.{{ fk.toColumn ?? "—" }}</td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ fk.onUpdate ?? "—" }}
                          </td>
                          <td class="py-1.5 text-muted-foreground/70">
                            {{ fk.onDelete ?? "—" }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section v-if="currentTable?.sql">
                    <div
                      class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                    >
                      CREATE statement
                    </div>
                    <pre
                      class="overflow-x-auto rounded-md border border-border/30 bg-surface-3 p-3 font-mono text-[11px] text-secondary-foreground"
                      >{{ currentTable.sql }}</pre
                    >
                  </section>
                </div>
              </ScrollArea>
            </template>

            <template v-else-if="activeTab === 'sql'">
              <div class="flex shrink-0 flex-col gap-2 border-b border-border/20 px-3 py-2">
                <textarea
                  v-model="sqlInput"
                  rows="4"
                  spellcheck="false"
                  class="w-full resize-y rounded-md border border-border/30 bg-surface-3 px-3 py-2 font-mono text-xs text-secondary-foreground outline-none focus:border-border/60"
                  placeholder="SELECT * FROM …"
                ></textarea>
                <div class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 gap-1.5 border border-border/30 bg-surface-3 px-3 text-[11px] text-foreground hover:bg-surface-2"
                    :disabled="isRunningSql"
                    @click="runSql"
                  >
                    <Play :size="11" /> Run
                  </Button>
                  <span v-if="isRunningSql" class="text-[11px] text-muted-foreground/50">
                    Running…
                  </span>
                  <span v-else-if="sqlError" class="text-[11px] text-error">{{ sqlError }}</span>
                  <span v-else-if="sqlResult" class="text-[11px] text-muted-foreground/50">
                    {{ sqlResult.rowCount }} row(s)
                  </span>
                </div>
              </div>

              <ScrollArea class="flex-1">
                <div
                  v-if="!sqlResult && !sqlError"
                  class="px-3 py-8 text-center text-[11px] text-muted-foreground/40"
                >
                  Run a query to see results.
                </div>
                <table v-else-if="sqlResult" class="w-full text-xs">
                  <thead class="sticky top-0 z-10">
                    <tr
                      class="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground/50 border-b border-border/30"
                    >
                      <th
                        v-for="col in sqlResult.columns"
                        :key="col"
                        class="px-3 py-2 font-medium whitespace-nowrap"
                      >
                        {{ col }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, idx) in sqlResult.rows"
                      :key="idx"
                      class="border-b border-border/20 data-row"
                    >
                      <td
                        v-for="(cell, ci) in row"
                        :key="ci"
                        class="px-3 py-1.5 font-mono align-top"
                      >
                        <span
                          class="block max-w-md truncate"
                          :class="{
                            'italic text-muted-foreground/40': renderCell(cell).tone === 'null',
                            'text-violet-300': renderCell(cell).tone === 'blob',
                            'text-secondary-foreground': renderCell(cell).tone === 'value',
                          }"
                        >
                          {{ renderCell(cell).text }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ScrollArea>
            </template>
          </div>
        </template>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>

  <ConfirmDialog
    v-model:open="confirmDialog.open"
    :title="confirmDialog.title"
    :description="confirmDialog.description"
    confirm-text="Confirm"
    cancel-text="Cancel"
    variant="destructive"
    @confirm="runConfirmedAction"
  />

  <SqliteChangeDiffDialog
    :open="!!diffChange"
    :change="diffChange"
    @update:open="(v) => (v ? null : closeRowDiff())"
  />
</template>
