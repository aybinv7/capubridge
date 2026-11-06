<script setup lang="ts">
import { computed, ref } from "vue";
import DataOverview, {
  type OverviewBars,
  type OverviewStat,
} from "@/modules/storage/frame/DataOverview.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { useSqliteChangeIndex } from "@/modules/storage/changes/useSqliteChangeOverlay";
import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import type { SqliteAddress } from "./sqliteAddress";
import SqliteOverviewChanges from "./overview/SqliteOverviewChanges.vue";
import SqliteOverviewChecks from "./overview/SqliteOverviewChecks.vue";
import SqliteOverviewConfig from "./overview/SqliteOverviewConfig.vue";
import SqliteOverviewList from "./overview/SqliteOverviewList.vue";
import { freeShare, healthChecks, type HealthCheck } from "./overview/sqliteHealth";
import { detectSyncColumns } from "./overview/sqliteSyncColumns";
import { useSqliteFacts } from "./overview/useSqliteFacts";

/**
 * The database at a glance, as a dashboard: big numbers (tables, rows, size, free space), the
 * biggest tables on disk and by rows (each bar opens its table), then cards for health, how the
 * file is configured, and what changed while it was watched, and a quiet list of every table.
 * One read (`sqlite_database_facts`) feeds it; changes come from the watcher's index.
 */
const props = defineProps<{
  tables: readonly SqliteTableInfo[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  db: SqliteDbFile;
  address: SqliteAddress | null;
  changeSerial: string;
  changePackage: string;
  /** The 5 s check keeps this copy current (not a file opened here). */
  watched: boolean;
}>();

const emit = defineEmits<{ open: [table: string, keep: boolean]; retry: [] }>();

const address = computed(() => props.address);
const { facts, error: factsError, refetch } = useSqliteFacts(address);
const { getTableSummary } = useSqliteChangeIndex();
const count = (value: number) => value.toLocaleString("en-US");

const plain = computed(() => props.tables.filter((table) => table.tableType === "table"));
const views = computed(() => props.tables.length - plain.value.length);
const totalRows = computed(() => plain.value.reduce((sum, table) => sum + table.rowCount, 0));

const summaries = computed(
  () =>
    new Map(
      props.tables.map((table) => [
        table.name,
        getTableSummary(props.changeSerial, props.changePackage, props.db.path, table.name),
      ]),
    ),
);
const changed = computed(() =>
  [...summaries.value]
    .filter(([, summary]) => summary.total > 0)
    .map(([table, summary]) => ({ table, summary }))
    .sort((a, b) => (b.summary.latestAt ?? "").localeCompare(a.summary.latestAt ?? "")),
);
const sync = computed(() => detectSyncColumns(facts.value?.tables ?? []));
const checks = computed(() =>
  facts.value
    ? healthChecks(facts.value, new Map(props.tables.map((table) => [table.name, table.rowCount])))
    : [],
);

const stats = computed<OverviewStat[]>(() => {
  const current = facts.value;
  const free = current ? freeShare(current) : 0;
  return [
    {
      label: "Tables",
      value: count(plain.value.length),
      detail: views.value > 0 ? `${count(views.value)} views` : undefined,
    },
    { label: "Rows", value: count(totalRows.value), detail: "in tables" },
    {
      label: "On disk",
      value: current ? formatBytes(current.fileBytes) : "…",
      detail: current?.walBytes ? `+ ${formatBytes(current.walBytes)} WAL` : undefined,
    },
    {
      label: "Free space",
      value: current ? `${free > 0 && free < 0.01 ? "<1" : Math.round(free * 100)} %` : "…",
      detail: current ? `${count(current.freelistCount)} pages` : undefined,
    },
  ];
});

const bars = computed<OverviewBars[]>(() => {
  const sized = (facts.value?.tables ?? [])
    .filter((table) => table.kind === "table" && (table.bytes ?? 0) > 0)
    .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))
    .slice(0, 8);
  const rows = [...plain.value]
    .filter((table) => table.rowCount > 0)
    .sort((a, b) => b.rowCount - a.rowCount)
    .slice(0, 8);
  return [
    {
      id: "size",
      title: "Biggest on disk",
      empty:
        facts.value?.sizesKnown === false
          ? "Sizes are not readable here."
          : "No table holds data yet.",
      items: sized.map((table) => ({
        id: table.name,
        label: table.name,
        value: table.bytes ?? 0,
        display: formatBytes(table.bytes ?? 0),
      })),
    },
    {
      id: "rows",
      title: "Most rows",
      empty: "No table has rows yet.",
      items: rows.map((table) => ({
        id: table.name,
        label: table.name,
        value: table.rowCount,
        display: count(table.rowCount),
      })),
    },
  ];
});

const only = ref<{ label: string; tables: ReadonlySet<string> } | null>(null);

function show(check: HealthCheck) {
  only.value = { label: check.text, tables: new Set(check.tables) };
}
</script>

<template>
  <DataState
    v-if="error"
    kind="error"
    title="Could not open the database"
    :detail="error"
    @retry="emit('retry')"
  />
  <DataState v-else-if="loading && !loaded" kind="loading" title="Opening the database" />
  <DataState
    v-else-if="loaded && tables.length === 0"
    kind="empty"
    title="This database has no tables"
    text="It may be new, or the app has not created its schema yet."
  />
  <DataOverview v-else :stats="stats" :bars="bars" @open="emit('open', $event, true)">
    <DataState
      v-if="factsError"
      compact
      kind="error"
      title="Could not read the sizes and checks"
      :detail="factsError"
      @retry="refetch()"
    />
    <div class="grid grid-cols-1 gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3">
      <SqliteOverviewChecks :checks="checks" :address="address" @show="show" />
      <SqliteOverviewConfig :facts="facts" :db="db" />
      <div class="flex min-w-0 flex-col gap-3">
        <SqliteOverviewChanges
          :changed="changed"
          :watched="watched"
          @open="emit('open', $event, false)"
        />
        <section
          v-if="sync.counts.length"
          class="flex flex-col gap-1.5 rounded-well border border-border-subtle bg-surface-1 p-3.5 shadow-bevel"
          aria-label="Sync columns"
        >
          <h3 class="text-xs font-medium text-foreground">Sync columns</h3>
          <p class="text-xs leading-5 text-muted-foreground">
            <template v-for="(entry, index) in sync.counts.slice(0, 6)" :key="entry.column">
              <span v-if="index > 0"> · </span>
              <span class="font-mono text-foreground">{{ entry.column }}</span>
              in {{ entry.tables }} {{ entry.tables === 1 ? "table" : "tables" }}
            </template>
          </p>
        </section>
      </div>
    </div>
    <SqliteOverviewList
      :tables="tables"
      :facts="facts"
      :only="only"
      @open="emit('open', $event, true)"
      @clear-only="only = null"
    />
  </DataOverview>
</template>
