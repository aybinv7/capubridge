<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { computed, ref, shallowRef, watch } from "vue";
import { Check, ChevronDown, Database, RefreshCw, Search } from "lucide-vue-next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IDBTable from "@/modules/storage/indexeddb/IDBTable.vue";
import IDBTableToolbar from "@/modules/storage/indexeddb/IDBTableToolbar.vue";
import SqliteTable from "@/modules/storage/sqlite/SqliteTable.vue";
import SqliteTableToolbar from "@/modules/storage/sqlite/SqliteTableToolbar.vue";
import SqliteChangeDiffDialog from "@/modules/storage/sqlite/SqliteChangeDiffDialog.vue";
import type {
  DatabaseCapuEvent,
  ReplayDatabaseChange,
  ReplayDatabaseChangeSummary,
  ReplayDatabaseChangesResult,
  ReplayDatabaseRowsResult,
  ReplayDatabaseSource,
  ReplayDatabaseSourceChangeSummary,
} from "@/types/replay.types";
import type {
  IndexedDBChangeSummary,
  IndexedDBRecordChangeEntry,
} from "@/types/storageChanges.types";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import type { SqliteChangeSummary, SqliteRecordChange } from "@/types/sqliteChanges.types";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import type { IDBRecord, StoreInfo } from "utils";

const props = defineProps<{
  events: DatabaseCapuEvent[];
  databasePath?: string | null;
  positionMs: number;
}>();

interface LocalReplayStorageSource {
  id: string;
  kind: "localStorage";
  origin: string;
  label: string;
  records: IDBRecord[];
  updatedAt: number;
}

type ReplayStorageSource = LocalReplayStorageSource | ReplayDatabaseSource;
type ReplayDatabaseKind = ReplayStorageSource["kind"];
type IndexedDBGroup = "all" | "app" | "localforage" | "dexie" | "blob" | "cache" | "sqlite";

const selectedId = ref("");
const selectedKind = ref<ReplayDatabaseKind>("indexedDB");
const selectedIndexedDBGroup = ref<IndexedDBGroup>("all");
const sourceSearch = ref("");
const page = ref(0);
const pageSize = ref(50);
const isLoadingRows = ref(false);
const isLoadingSources = ref(false);
const databaseError = ref<string | null>(null);
const showChangesOnly = ref(false);
const queryPositionMs = ref(normalizePositionMs(props.positionMs));
const replaySources = shallowRef<ReplayDatabaseSource[]>([]);
const sourceChangeSummaries = shallowRef<Map<string, IndexedDBChangeSummary>>(new Map());
const idbRows = shallowRef<IDBRecord[]>([]);
const idbRecordCount = ref(0);
const idbChangeSummary = shallowRef<IndexedDBChangeSummary>({
  add: 0,
  update: 0,
  delete: 0,
  total: 0,
  latestAt: null,
});
const sqliteColumns = shallowRef<string[]>([]);
const sqliteRows = shallowRef<unknown[][]>([]);
const sqliteColumnInfo = shallowRef<SqliteColumnInfo[]>([]);
const sqliteRecordCount = ref(0);
const sqliteChangesByRowKey = shallowRef<Map<string, SqliteRecordChange>>(new Map());
const sqliteChangeSummary = shallowRef<SqliteChangeSummary>({
  add: 0,
  update: 0,
  delete: 0,
  total: 0,
  latestAt: null,
});
const sqliteDiffRowKey = ref("");

let rowRequest = 0;
let sourceSummaryRequest = 0;
let positionTimer: ReturnType<typeof setTimeout> | null = null;

function normalizePositionMs(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

const sortedEvents = computed(() => [...props.events].sort((a, b) => a.t - b.t));

const localSources = computed<LocalReplayStorageSource[]>(() => {
  const byOrigin = new Map<string, DatabaseCapuEvent>();
  const firstByOrigin = new Map<string, DatabaseCapuEvent>();

  for (const event of sortedEvents.value) {
    if (event.data.kind !== "localStorage") continue;
    if (!firstByOrigin.has(event.data.origin)) firstByOrigin.set(event.data.origin, event);
    if (event.t <= normalizePositionMs(props.positionMs)) byOrigin.set(event.data.origin, event);
  }

  for (const [origin, first] of firstByOrigin) {
    if (!byOrigin.has(origin)) byOrigin.set(origin, first);
  }

  return Array.from(byOrigin.values()).map((event) => ({
    id: `localStorage:${event.data.origin}`,
    kind: "localStorage",
    origin: event.data.origin,
    label: "LocalStorage",
    updatedAt: event.t,
    records: event.data.entries.map((entry) => ({
      key: entry.key,
      value: entry.value,
    })),
  }));
});

const sources = computed<ReplayStorageSource[]>(() => [
  ...replaySources.value,
  ...localSources.value,
]);

function indexedDBGroup(source: ReplayStorageSource): IndexedDBGroup {
  if (source.kind !== "indexedDB") return "all";
  const haystack = `${source.databaseName} ${source.storeName} ${source.label}`.toLowerCase();

  if (haystack.includes("localforage") || haystack.includes("keyvaluepairs")) {
    return "localforage";
  }
  if (
    haystack.includes("jeepsqlite") ||
    haystack.includes("jeep-sqlite") ||
    haystack.includes("sqlite")
  ) {
    return "sqlite";
  }
  if (haystack.includes("dexie")) {
    return "dexie";
  }
  if (
    haystack.includes("blob") ||
    haystack.includes("file") ||
    haystack.includes("image") ||
    haystack.includes("media") ||
    haystack.includes("binary") ||
    haystack.includes("attachment")
  ) {
    return "blob";
  }
  if (
    haystack.includes("cache") ||
    haystack.includes("offline") ||
    haystack.includes("request") ||
    haystack.includes("response")
  ) {
    return "cache";
  }
  return "app";
}

const indexedDBGroupOptions = computed(() => {
  const counts = replaySources.value
    .filter((source) => source.kind === "indexedDB")
    .reduce<Record<IndexedDBGroup, number>>(
      (acc, source) => {
        acc.all += 1;
        acc[indexedDBGroup(source)] += 1;
        return acc;
      },
      {
        all: 0,
        app: 0,
        localforage: 0,
        dexie: 0,
        blob: 0,
        cache: 0,
        sqlite: 0,
      },
    );

  return [
    { value: "all", label: "All", count: counts.all },
    { value: "app", label: "App DBs", count: counts.app },
    { value: "localforage", label: "LocalForage", count: counts.localforage },
    { value: "sqlite", label: "SQLite bridges", count: counts.sqlite },
    { value: "blob", label: "Blob/File stores", count: counts.blob },
    { value: "cache", label: "Cache/Offline", count: counts.cache },
    { value: "dexie", label: "Dexie", count: counts.dexie },
  ] satisfies Array<{ value: IndexedDBGroup; label: string; count: number }>;
});

const visibleSources = computed<ReplayStorageSource[]>(() =>
  sources.value.filter((source) => {
    if (source.kind !== selectedKind.value) return false;
    if (
      source.kind === "indexedDB" &&
      selectedIndexedDBGroup.value !== "all" &&
      indexedDBGroup(source) !== selectedIndexedDBGroup.value
    ) {
      return false;
    }
    const q = sourceSearch.value.trim().toLowerCase();
    if (!q) return true;
    return (
      sourceLabel(source).toLowerCase().includes(q) ||
      sourceSubLabel(source).toLowerCase().includes(q)
    );
  }),
);

const typeOptions = computed(() => {
  const counts = sources.value.reduce<Record<ReplayDatabaseKind, number>>(
    (acc, source) => {
      acc[source.kind] += 1;
      return acc;
    },
    { localStorage: 0, indexedDB: 0, sqlite: 0 },
  );

  return [
    { value: "indexedDB", label: "IndexedDB", count: counts.indexedDB },
    {
      value: "localStorage",
      label: "LocalStorage",
      count: counts.localStorage,
    },
    { value: "sqlite", label: "SQLite", count: counts.sqlite },
  ] satisfies Array<{
    value: ReplayDatabaseKind;
    label: string;
    count: number;
  }>;
});

const activeTypeLabel = computed(() => {
  if (selectedKind.value !== "indexedDB") {
    return (
      typeOptions.value.find((option) => option.value === selectedKind.value)?.label ??
      "Database type"
    );
  }

  const group =
    indexedDBGroupOptions.value.find((option) => option.value === selectedIndexedDBGroup.value)
      ?.label ?? "All";

  return `IndexedDB / ${group}`;
});

const indexedDBTypeCount = computed(
  () => typeOptions.value.find((option) => option.value === "indexedDB")?.count ?? 0,
);

const nonIndexedDBTypeOptions = computed(() =>
  typeOptions.value.filter((option) => option.value !== "indexedDB"),
);

const selectedSource = computed(
  () =>
    visibleSources.value.find((source) => source.id === selectedId.value) ??
    visibleSources.value[0] ??
    null,
);

const isIndexedDBSource = computed(() => selectedSource.value?.kind === "indexedDB");
const isReplaySqliteSource = computed(() => selectedSource.value?.kind === "sqlite");
const usesReplayDatabase = computed(() => isIndexedDBSource.value || isReplaySqliteSource.value);

const activeIdbChangeSummary = computed(() => {
  const source = selectedSource.value;
  if (!source || source.kind !== "indexedDB") return idbChangeSummary.value;
  return sourceChangeSummaries.value.get(source.id) ?? idbChangeSummary.value;
});

const localVisibleRecords = computed(() => {
  const source = selectedSource.value;
  if (!source || source.kind !== "localStorage") return [];
  const start = page.value * pageSize.value;
  return source.records.slice(start, start + pageSize.value);
});

const idbTableRecords = computed(() =>
  isIndexedDBSource.value ? idbRows.value : localVisibleRecords.value,
);

const recordCount = computed(() => {
  const source = selectedSource.value;
  if (!source) return 0;
  if (source.kind === "indexedDB") return idbRecordCount.value;
  if (source.kind === "sqlite") return sqliteRecordCount.value;
  return source.kind === "localStorage" ? source.records.length : source.recordCount;
});

const hasMore = computed(() => (page.value + 1) * pageSize.value < recordCount.value);

const activeStoreName = computed(() => {
  const source = selectedSource.value;
  if (!source) return "";
  return source.kind === "localStorage" ? "entries" : source.storeName;
});

const activeDatabaseName = computed(() => {
  const source = selectedSource.value;
  if (!source) return "";
  return source.kind === "localStorage" ? source.origin : source.databaseName;
});

function sourceLabel(source: ReplayStorageSource): string {
  if (source.kind === "indexedDB") return source.storeName;
  return source.label;
}

function sourceSubLabel(source: ReplayStorageSource): string {
  if (source.kind === "indexedDB") return source.databaseName;
  if (source.kind === "sqlite") return source.databaseName;
  return source.origin;
}

function selectKind(kind: ReplayDatabaseKind) {
  selectedKind.value = kind;
  if (kind !== "indexedDB") selectedIndexedDBGroup.value = "all";
}

function selectIndexedDBGroup(group: IndexedDBGroup) {
  selectedKind.value = "indexedDB";
  selectedIndexedDBGroup.value = group;
}

function sourceChangeSummary(source: ReplayStorageSource) {
  if (source.kind === "localStorage") return null;

  const summary = sourceChangeSummaries.value.get(source.id);
  if (summary) return summary;

  if (source.id !== selectedSource.value?.id) return null;
  if (source.kind === "indexedDB") return idbChangeSummary.value;
  if (source.kind === "sqlite") return sqliteChangeSummary.value;
  return null;
}

function hasSourceChanges(source: ReplayStorageSource) {
  return (sourceChangeSummary(source)?.total ?? 0) > 0;
}

function sourceChangeStyle(source: ReplayStorageSource) {
  const summary = sourceChangeSummary(source);
  if (!summary?.total) return {};
  const color = summary.delete > 0 ? "239,68,68" : summary.update > 0 ? "245,158,11" : "16,185,129";

  return {
    background: `linear-gradient(90deg, rgba(${color}, 0.14), rgba(${color}, 0.045) 48%, transparent 94%)`,
  };
}

function sourceChangeSegments(source: ReplayStorageSource) {
  const summary = sourceChangeSummary(source);
  if (!summary) return [];
  return [
    { key: "add", count: summary.add, class: "bg-emerald-500" },
    { key: "update", count: summary.update, class: "bg-amber-500" },
    { key: "delete", count: summary.delete, class: "bg-red-500" },
  ].filter((entry) => entry.count > 0);
}

const statusText = computed(() => {
  const source = selectedSource.value;
  if (!source) return "";
  if (source.kind === "localStorage") {
    return `Snapshot at ${Math.max(0, source.updatedAt).toLocaleString()} ms`;
  }
  if (showChangesOnly.value) {
    return `Changed rows at ${Math.max(0, queryPositionMs.value).toLocaleString()} ms`;
  }
  return `Rows at ${Math.max(0, queryPositionMs.value).toLocaleString()} ms`;
});

const idbStoreInfo = computed<StoreInfo[]>(() => {
  const source = selectedSource.value;
  if (!source) return [];

  if (source.kind === "localStorage") {
    return [
      {
        name: "entries",
        keyPath: "key",
        autoIncrement: false,
        recordCount: source.records.length,
        indexCount: 0,
        indexes: [],
        estimatedSize: source.records.reduce(
          (sum, record) => sum + new Blob([String(record.key), String(record.value)]).size,
          0,
        ),
      },
    ];
  }

  if (source.kind !== "indexedDB") return [];

  const metadata = parseMetadata(source.metadataJson);
  const indexes = Array.isArray(metadata.indexes) ? metadata.indexes : [];

  return [
    {
      name: source.storeName,
      keyPath: isKeyPath(metadata.keyPath) ? metadata.keyPath : null,
      autoIncrement: typeof metadata.autoIncrement === "boolean" ? metadata.autoIncrement : false,
      recordCount: recordCount.value,
      indexCount: indexes.length,
      indexes: indexes as StoreInfo["indexes"],
      estimatedSize: typeof metadata.estimatedSize === "number" ? metadata.estimatedSize : 0,
    },
  ];
});

const sqliteDiffChange = computed(() =>
  sqliteDiffRowKey.value ? (sqliteChangesByRowKey.value.get(sqliteDiffRowKey.value) ?? null) : null,
);

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isKeyPath(value: unknown): value is string | string[] | null {
  return value === null || typeof value === "string" || Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isColumnInfoArray(value: unknown): value is SqliteColumnInfo[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<SqliteColumnInfo>;
      return typeof item.name === "string" && typeof item.cid === "number";
    })
  );
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseRecord(raw: string | null): Record<string, unknown> | null {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function formatKeyLabel(key: unknown): string {
  if (typeof key === "string") return key;
  if (typeof key === "number" || typeof key === "bigint") return String(key);
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
}

function toIdbChangeSummary(summary: ReplayDatabaseChangeSummary): IndexedDBChangeSummary {
  return {
    add: summary.add,
    update: summary.update,
    delete: summary.delete,
    total: summary.total,
    latestAt: summary.latestMs === null ? null : `${summary.latestMs} ms`,
  };
}

function toSqliteChangeSummary(summary: ReplayDatabaseChangeSummary): SqliteChangeSummary {
  return {
    add: summary.add,
    update: summary.update,
    delete: summary.delete,
    total: summary.total,
    latestAt: summary.latestMs === null ? null : `${summary.latestMs} ms`,
  };
}

function makeIdbChangeEntry(
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange,
): IndexedDBRecordChangeEntry {
  const key = parseJson(change.keyJson) as IDBValidKey;
  return {
    id: String(change.id),
    kind: "record",
    source: "external",
    observedAt: `${change.tMs} ms`,
    origin: source.origin,
    databaseName: source.databaseName,
    objectStoreName: source.storeName,
    operation: change.operation,
    key,
    keyLabel: formatKeyLabel(key),
    beforeValue: parseJson(change.beforeJson),
    afterValue: parseJson(change.afterJson),
    fieldDiffs: [],
  };
}

function decorateIdbRecord(
  record: IDBRecord,
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange | undefined,
): IDBRecord {
  if (!change) return record;
  const entry = makeIdbChangeEntry(source, change);
  return {
    ...record,
    __changeId: entry.id,
    __changeOperation: entry.operation,
    __changeObservedAt: entry.observedAt,
    __changeDeleted: entry.operation === "delete",
    __recordChange: entry,
  } satisfies IndexedDBDecoratedRecord;
}

function idbChangeToRecord(source: ReplayDatabaseSource, change: ReplayDatabaseChange): IDBRecord {
  const key = parseJson(change.keyJson) as IDBValidKey;
  const value =
    change.operation === "delete"
      ? parseJson(change.beforeJson)
      : parseJson(change.afterJson ?? change.beforeJson);
  return decorateIdbRecord({ key, value }, source, change);
}

function sqliteMetadata(source: ReplayDatabaseSource) {
  return parseMetadata(source.metadataJson);
}

function sqliteColumnsFromSource(source: ReplayDatabaseSource, records: Record<string, unknown>[]) {
  const metadata = sqliteMetadata(source);
  if (isStringArray(metadata.columns) && metadata.columns.length > 0) return metadata.columns;
  if (isColumnInfoArray(metadata.columnInfo) && metadata.columnInfo.length > 0) {
    return metadata.columnInfo.map((column) => column.name);
  }
  return Object.keys(records[0] ?? {});
}

function sqliteColumnInfoFromSource(source: ReplayDatabaseSource): SqliteColumnInfo[] {
  const metadata = sqliteMetadata(source);
  return isColumnInfoArray(metadata.columnInfo) ? metadata.columnInfo : [];
}

function sqliteRecordToRow(columns: string[], record: Record<string, unknown>): unknown[] {
  return columns.map((column) => record[column] ?? null);
}

function sqliteRecordChange(
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange,
): SqliteRecordChange {
  const metadata = sqliteMetadata(source);
  return {
    id: String(change.id),
    kind: "record",
    operation: change.operation,
    serial: typeof metadata.serial === "string" ? metadata.serial : "replay",
    packageName: typeof metadata.packageName === "string" ? metadata.packageName : source.origin,
    dbPath: typeof metadata.dbPath === "string" ? metadata.dbPath : source.databaseName,
    tableName: source.storeName,
    rowKey: change.keyJson,
    beforeValue: parseRecord(change.beforeJson),
    afterValue: parseRecord(change.afterJson),
    observedAt: `${change.tMs} ms`,
  };
}

function sqliteRowKey(record: Record<string, unknown>): string {
  const pk = sqliteColumnInfo.value.filter((column) => column.pk).sort((a, b) => a.cid - b.cid);
  if (pk.length > 0) {
    return JSON.stringify(pk.map((column) => record[column.name] ?? null));
  }
  return JSON.stringify(sqliteColumns.value.map((column) => record[column] ?? null));
}

function resetRemoteRows() {
  idbRows.value = [];
  idbRecordCount.value = 0;
  idbChangeSummary.value = {
    add: 0,
    update: 0,
    delete: 0,
    total: 0,
    latestAt: null,
  };
  sqliteColumns.value = [];
  sqliteRows.value = [];
  sqliteColumnInfo.value = [];
  sqliteRecordCount.value = 0;
  sqliteChangesByRowKey.value = new Map();
  sqliteChangeSummary.value = {
    add: 0,
    update: 0,
    delete: 0,
    total: 0,
    latestAt: null,
  };
  sqliteDiffRowKey.value = "";
}

async function loadSources() {
  if (!props.databasePath) {
    replaySources.value = [];
    sourceChangeSummaries.value = new Map();
    return;
  }

  isLoadingSources.value = true;
  databaseError.value = null;

  try {
    const next = await invoke<ReplayDatabaseSource[]>("recording_database_sources", {
      databasePath: props.databasePath,
    });
    replaySources.value = next.filter(
      (source) => source.kind === "indexedDB" || source.kind === "sqlite",
    );
  } catch (err) {
    replaySources.value = [];
    databaseError.value = String(err);
  } finally {
    isLoadingSources.value = false;
  }
}

async function loadSourceChangeSummaries() {
  const databasePath = props.databasePath;
  const request = ++sourceSummaryRequest;

  if (!databasePath) {
    sourceChangeSummaries.value = new Map();
    return;
  }

  try {
    const summaries = await invoke<ReplayDatabaseSourceChangeSummary[]>(
      "recording_database_change_summaries",
      {
        databasePath,
        positionMs: normalizePositionMs(queryPositionMs.value),
      },
    );

    if (request !== sourceSummaryRequest) return;
    sourceChangeSummaries.value = new Map(
      summaries.map((summary) => [summary.sourceId, toIdbChangeSummary(summary)]),
    );
  } catch {
    if (request === sourceSummaryRequest) sourceChangeSummaries.value = new Map();
  }
}

async function loadIndexedDbRows(
  source: ReplayDatabaseSource,
  databasePath: string,
  request: number,
) {
  const offset = page.value * pageSize.value;
  const positionMs = normalizePositionMs(queryPositionMs.value);
  const summaryPromise = invoke<ReplayDatabaseChangeSummary>("recording_database_change_summary", {
    databasePath,
    sourceId: source.id,
    positionMs,
  });

  if (showChangesOnly.value) {
    const [result, summary] = await Promise.all([
      invoke<ReplayDatabaseChangesResult>("recording_database_changed_rows", {
        databasePath,
        sourceId: source.id,
        positionMs,
        offset,
        limit: pageSize.value,
      }),
      summaryPromise,
    ]);

    if (request !== rowRequest) return;
    idbRows.value = result.changes.map((change) => idbChangeToRecord(source, change));
    idbRecordCount.value = result.total;
    idbChangeSummary.value = toIdbChangeSummary(summary);
    return;
  }

  const result = await invoke<ReplayDatabaseRowsResult>("recording_database_table_rows", {
    databasePath,
    sourceId: source.id,
    positionMs,
    offset,
    limit: pageSize.value,
  });

  const keyJsons = result.rows.map((row) => row.keyJson);
  const [changes, summary] = await Promise.all([
    invoke<ReplayDatabaseChange[]>("recording_database_changes_for_keys", {
      databasePath,
      sourceId: source.id,
      positionMs,
      keyJsons,
    }),
    summaryPromise,
  ]);

  if (request !== rowRequest) return;

  const changesByKey = new Map(changes.map((change) => [change.keyJson, change]));
  idbRows.value = result.rows.map((row) =>
    decorateIdbRecord(
      {
        key: parseJson(row.keyJson) as IDBValidKey,
        value: parseJson(row.valueJson),
      },
      source,
      changesByKey.get(row.keyJson),
    ),
  );
  idbRecordCount.value = result.total;
  idbChangeSummary.value = toIdbChangeSummary(summary);
}

async function loadSqliteRows(source: ReplayDatabaseSource, databasePath: string, request: number) {
  const offset = page.value * pageSize.value;
  const positionMs = normalizePositionMs(queryPositionMs.value);
  const summaryPromise = invoke<ReplayDatabaseChangeSummary>("recording_database_change_summary", {
    databasePath,
    sourceId: source.id,
    positionMs,
  });

  if (showChangesOnly.value) {
    const [result, summary] = await Promise.all([
      invoke<ReplayDatabaseChangesResult>("recording_database_changed_rows", {
        databasePath,
        sourceId: source.id,
        positionMs,
        offset,
        limit: pageSize.value,
      }),
      summaryPromise,
    ]);

    if (request !== rowRequest) return;
    const changes = result.changes.map((change) => sqliteRecordChange(source, change));
    const records = result.changes
      .map((change) =>
        change.operation === "delete"
          ? parseRecord(change.beforeJson)
          : parseRecord(change.afterJson ?? change.beforeJson),
      )
      .filter((record): record is Record<string, unknown> => !!record);
    const columns = sqliteColumnsFromSource(source, records);

    sqliteColumns.value = columns;
    sqliteColumnInfo.value = sqliteColumnInfoFromSource(source);
    sqliteRows.value = records.map((record) => sqliteRecordToRow(columns, record));
    sqliteChangesByRowKey.value = new Map(changes.map((change) => [change.rowKey, change]));
    sqliteRecordCount.value = result.total;
    sqliteChangeSummary.value = toSqliteChangeSummary(summary);
    return;
  }

  const result = await invoke<ReplayDatabaseRowsResult>("recording_database_table_rows", {
    databasePath,
    sourceId: source.id,
    positionMs,
    offset,
    limit: pageSize.value,
  });

  const records = result.rows
    .map((row) => parseRecord(row.valueJson))
    .filter((record): record is Record<string, unknown> => !!record);
  const keyJsons = result.rows.map((row) => row.keyJson);
  const [changes, summary] = await Promise.all([
    invoke<ReplayDatabaseChange[]>("recording_database_changes_for_keys", {
      databasePath,
      sourceId: source.id,
      positionMs,
      keyJsons,
    }),
    summaryPromise,
  ]);

  if (request !== rowRequest) return;

  const columns = sqliteColumnsFromSource(source, records);
  const mappedChanges = changes.map((change) => sqliteRecordChange(source, change));

  sqliteColumns.value = columns;
  sqliteColumnInfo.value = sqliteColumnInfoFromSource(source);
  sqliteRows.value = records.map((record) => sqliteRecordToRow(columns, record));
  sqliteChangesByRowKey.value = new Map(mappedChanges.map((change) => [change.rowKey, change]));
  sqliteRecordCount.value = result.total;
  sqliteChangeSummary.value = toSqliteChangeSummary(summary);
}

async function loadRows() {
  const source = selectedSource.value;
  const databasePath = props.databasePath;
  const request = ++rowRequest;

  if (!source || source.kind === "localStorage" || !databasePath) {
    resetRemoteRows();
    return;
  }

  isLoadingRows.value = true;
  databaseError.value = null;

  try {
    if (source.kind === "indexedDB") {
      await loadIndexedDbRows(source, databasePath, request);
    } else {
      await loadSqliteRows(source, databasePath, request);
    }
  } catch (err) {
    if (request !== rowRequest) return;
    resetRemoteRows();
    databaseError.value = String(err);
  } finally {
    if (request === rowRequest) isLoadingRows.value = false;
  }
}

function noop(..._args: unknown[]) {}

function prevPage() {
  if (page.value > 0) page.value -= 1;
}

function nextPage() {
  if (hasMore.value) page.value += 1;
}

function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 0;
}

function toggleChangesOnly() {
  if (!usesReplayDatabase.value) return;
  showChangesOnly.value = !showChangesOnly.value;
  page.value = 0;
}

function openSqliteRowDiff(rowKey: string) {
  if (sqliteChangesByRowKey.value.has(rowKey)) sqliteDiffRowKey.value = rowKey;
}

function closeSqliteDiff() {
  sqliteDiffRowKey.value = "";
}

async function refresh() {
  await Promise.all([loadSources(), loadSourceChangeSummaries()]);
  await loadRows();
}

async function fetchIdbRecord(index: number): Promise<IDBRecord | null> {
  const source = selectedSource.value;
  const databasePath = props.databasePath;

  if (!source) return null;
  if (source.kind === "localStorage") return source.records[index] ?? null;
  if (source.kind !== "indexedDB" || !databasePath) return null;

  if (showChangesOnly.value) {
    const positionMs = normalizePositionMs(queryPositionMs.value);
    const result = await invoke<ReplayDatabaseChangesResult>("recording_database_changed_rows", {
      databasePath,
      sourceId: source.id,
      positionMs,
      offset: index,
      limit: 1,
    });
    const change = result.changes[0];
    return change ? idbChangeToRecord(source, change) : null;
  }

  const positionMs = normalizePositionMs(queryPositionMs.value);
  const rowResult = await invoke<ReplayDatabaseRowsResult>("recording_database_table_rows", {
    databasePath,
    sourceId: source.id,
    positionMs,
    offset: index,
    limit: 1,
  });
  const row = rowResult.rows[0];
  if (!row) return null;

  const changes = await invoke<ReplayDatabaseChange[]>("recording_database_changes_for_keys", {
    databasePath,
    sourceId: source.id,
    positionMs,
    keyJsons: [row.keyJson],
  });

  return decorateIdbRecord(
    {
      key: parseJson(row.keyJson) as IDBValidKey,
      value: parseJson(row.valueJson),
    },
    source,
    changes[0],
  );
}

watch(
  () => props.positionMs,
  (value) => {
    if (positionTimer !== null) clearTimeout(positionTimer);
    positionTimer = setTimeout(() => {
      queryPositionMs.value = normalizePositionMs(value);
      positionTimer = null;
    }, 140);
  },
  { immediate: true },
);

watch(
  () => props.databasePath,
  () => {
    void loadSources();
    void loadSourceChangeSummaries();
  },
  { immediate: true },
);

watch(queryPositionMs, () => void loadSourceChangeSummaries());

watch(
  sources,
  (next) => {
    if (next.length === 0) {
      selectedId.value = "";
      return;
    }

    if (!next.some((source) => source.kind === selectedKind.value)) {
      selectedKind.value = next[0].kind;
      return;
    }

    if (!visibleSources.value.some((source) => source.id === selectedId.value)) {
      selectedId.value = visibleSources.value[0]?.id ?? "";
    }
  },
  { immediate: true },
);

watch(selectedKind, () => {
  if (selectedKind.value !== "indexedDB") selectedIndexedDBGroup.value = "all";
  selectedId.value = visibleSources.value[0]?.id ?? "";
});

watch(indexedDBGroupOptions, (options) => {
  if (selectedIndexedDBGroup.value === "all") return;
  const selected = options.find((option) => option.value === selectedIndexedDBGroup.value);
  if (!selected?.count) selectedIndexedDBGroup.value = "all";
});

watch(selectedIndexedDBGroup, () => {
  selectedId.value = visibleSources.value[0]?.id ?? "";
});

watch(selectedId, () => {
  page.value = 0;
  showChangesOnly.value = false;
  sqliteDiffRowKey.value = "";
});

watch([selectedSource, queryPositionMs, page, pageSize, showChangesOnly], () => void loadRows(), {
  immediate: true,
});
</script>

<template>
  <div class="flex h-full min-h-0 overflow-hidden">
    <aside class="flex w-64 shrink-0 flex-col border-r border-border/20 bg-surface-1/50">
      <div class="shrink-0 space-y-2 border-b border-border/20 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border/30 bg-surface-3 px-2 text-left text-xs transition-colors hover:border-border/50 hover:bg-surface-3/80"
            >
              <span class="truncate">{{ activeTypeLabel }}</span>
              <ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger class="text-xs">
                <span class="flex min-w-0 flex-1 items-center gap-2">
                  <Check v-if="selectedKind === 'indexedDB'" class="h-3 w-3 shrink-0" />
                  <span v-else class="h-3 w-3 shrink-0" />
                  <span class="truncate">IndexedDB</span>
                  <span class="ml-auto text-[10px] text-muted-foreground/50">
                    {{ indexedDBTypeCount.toLocaleString() }}
                  </span>
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="w-52">
                <DropdownMenuItem
                  v-for="option in indexedDBGroupOptions"
                  :key="option.value"
                  class="text-xs"
                  @click="selectIndexedDBGroup(option.value)"
                >
                  <Check
                    v-if="selectedKind === 'indexedDB' && selectedIndexedDBGroup === option.value"
                    class="mr-2 h-3 w-3 shrink-0"
                  />
                  <span v-else class="mr-2 h-3 w-3 shrink-0" />
                  <span class="truncate">{{ option.label }}</span>
                  <span class="ml-auto text-[10px] text-muted-foreground/50">
                    {{ option.count.toLocaleString() }}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              v-for="option in nonIndexedDBTypeOptions"
              :key="option.value"
              class="text-xs"
              @click="selectKind(option.value)"
            >
              <Check v-if="selectedKind === option.value" class="mr-2 h-3 w-3 shrink-0" />
              <span v-else class="mr-2 h-3 w-3 shrink-0" />
              <span class="truncate">{{ option.label }}</span>
              <span class="ml-auto text-[10px] text-muted-foreground/50">
                {{ option.count.toLocaleString() }}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div
          class="flex items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2 py-1.5 transition-colors focus-within:border-border/60"
        >
          <Search class="h-3 w-3 shrink-0 text-muted-foreground/50" />
          <Input
            v-model="sourceSearch"
            class="h-5 border-0 bg-transparent px-0 font-mono text-xs placeholder:text-muted-foreground/40 focus-visible:ring-0"
            placeholder="Search tables…"
          />
        </div>
      </div>
      <ScrollArea class="min-h-0 flex-1">
        <div
          v-if="sources.length === 0 && !isLoadingSources"
          class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground/40"
        >
          <Database class="h-5 w-5 opacity-40" />
          <p class="text-[11px]">No database track captured</p>
        </div>
        <div
          v-else-if="visibleSources.length === 0 && !isLoadingSources"
          class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground/40"
        >
          <Database class="h-5 w-5 opacity-40" />
          <p class="text-[11px]">
            {{ sourceSearch.trim() ? "No matching tables" : `No ${selectedKind} data captured` }}
          </p>
        </div>
        <template v-else>
          <button
            v-for="source in visibleSources"
            :key="source.id"
            class="flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left transition-colors"
            :class="
              selectedSource?.id === source.id
                ? 'border-foreground bg-surface-3 text-foreground'
                : 'border-transparent  hover:bg-surface-3/50 hover:text-foreground/80'
            "
            :style="sourceChangeStyle(source)"
            @click="selectedId = source.id"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-xs font-medium">{{ sourceLabel(source) }}</span>
                <span class="ml-auto text-[10px] text-muted-foreground/40">
                  {{
                    source.kind === "localStorage"
                      ? source.records.length.toLocaleString()
                      : source.recordCount.toLocaleString()
                  }}
                </span>
              </div>
              <div class="mt-0.5 flex items-center gap-1.5">
                <!-- <p
                  class="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground/40"
                >
                  {{ sourceSubLabel(source) }}
                </p> -->
                <div v-if="hasSourceChanges(source)" class="flex h-1 w-10 overflow-hidden rounded">
                  <span
                    v-for="segment in sourceChangeSegments(source)"
                    :key="segment.key"
                    class="h-full"
                    :class="segment.class"
                    :style="{ flex: segment.count }"
                  />
                </div>
              </div>
            </div>
          </button>
        </template>
      </ScrollArea>
    </aside>

    <main class="min-w-0 flex-1">
      <div
        v-if="!selectedSource"
        class="flex h-full items-center justify-center text-sm text-muted-foreground/30"
      >
        Select captured storage
      </div>
      <div v-else class="flex h-full flex-col overflow-hidden">
        <template v-if="isReplaySqliteSource">
          <SqliteTableToolbar
            :table-name="activeStoreName"
            :db-name="activeDatabaseName"
            :is-loading="isLoadingRows"
            :page="page"
            :page-size="pageSize"
            :has-more="hasMore"
            :record-count="recordCount"
            :change-summary="sqliteChangeSummary"
            :show-changes-only="showChangesOnly"
            :show-live-control="false"
            @refresh="refresh"
            @prev="prevPage"
            @next="nextPage"
            @page-size-change="handlePageSizeChange"
            @toggle-live="noop"
            @toggle-changes-only="toggleChangesOnly"
          />
          <div
            class="flex h-7 shrink-0 items-center gap-2 border-b border-border/20 bg-surface-1/40 px-3 text-[10px] text-muted-foreground/50"
          >
            <RefreshCw class="h-3 w-3" />
            <span>{{ statusText }}</span>
            <span v-if="databaseError" class="ml-auto truncate text-error">{{
              databaseError
            }}</span>
          </div>
          <SqliteTable
            :columns="sqliteColumns"
            :rows="sqliteRows"
            :is-loading="isLoadingRows"
            :table-name="activeStoreName"
            :db-name="activeDatabaseName"
            :column-info="sqliteColumnInfo"
            :changes-by-row-key="sqliteChangesByRowKey"
            :show-changes-only="showChangesOnly"
            :row-key-resolver="sqliteRowKey"
            read-only
            @refresh="refresh"
            @record-edit="noop"
            @record-delete="noop"
            @open-row-diff="openSqliteRowDiff"
          />
        </template>

        <template v-else>
          <IDBTableToolbar
            :store-name="activeStoreName"
            :db-name="activeDatabaseName"
            :is-loading="isLoadingRows"
            :page="page"
            :page-size="pageSize"
            :has-more="hasMore"
            :record-count="recordCount"
            :change-summary="isIndexedDBSource ? activeIdbChangeSummary : undefined"
            :show-changes-only="showChangesOnly"
            @refresh="refresh"
            @prev="prevPage"
            @next="nextPage"
            @page-size-change="handlePageSizeChange"
            @toggle-changes-only="toggleChangesOnly"
          />
          <div
            class="flex h-7 shrink-0 items-center gap-2 border-b border-border/20 bg-surface-1/40 px-3 text-[10px] text-muted-foreground/50"
          >
            <RefreshCw class="h-3 w-3" />
            <span>{{ statusText }}</span>
            <span v-if="databaseError" class="ml-auto truncate text-error">{{
              databaseError
            }}</span>
          </div>
          <IDBTable
            :records="idbTableRecords"
            :is-loading="isLoadingRows"
            :store-name="activeStoreName"
            :db-name="activeDatabaseName"
            :total-records="recordCount"
            :store-info="idbStoreInfo"
            :fetch-record="fetchIdbRecord"
            :show-changes-only="showChangesOnly"
            read-only
            @refresh="refresh"
            @record-edit="noop"
            @record-delete="noop"
            @record-delete-bulk="noop"
          />
        </template>
      </div>
    </main>

    <SqliteChangeDiffDialog
      :open="!!sqliteDiffChange"
      :change="sqliteDiffChange"
      @update:open="(value) => (value ? null : closeSqliteDiff())"
    />
  </div>
</template>
