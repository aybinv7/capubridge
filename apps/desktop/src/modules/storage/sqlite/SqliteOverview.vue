<script setup lang="ts">
import { computed, ref } from "vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { useSqliteChangeIndex } from "@/modules/storage/changes/useSqliteChangeOverlay";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import type { SqliteAddress } from "./sqliteAddress";
import SqliteOverviewChanges from "./overview/SqliteOverviewChanges.vue";
import SqliteOverviewChecks from "./overview/SqliteOverviewChecks.vue";
import SqliteOverviewFacts from "./overview/SqliteOverviewFacts.vue";
import SqliteOverviewTables from "./overview/SqliteOverviewTables.vue";
import { healthChecks, type HealthCheck } from "./overview/sqliteHealth";
import { overviewRows } from "./overview/sqliteOverviewRows";
import { detectSyncColumns } from "./overview/sqliteSyncColumns";
import { useSqliteFacts } from "./overview/useSqliteFacts";

/**
 * The database's health page: the file's facts, every table in one sortable grid (size on disk
 * from `dbstat`, share, keys, sync columns, changes), what changed while it was watched, schema
 * checks and the sync columns found. One read (`sqlite_database_facts`) feeds it; changes come
 * from the watcher's index. Everything is navigation: no primary action.
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

const summaries = computed(
  () =>
    new Map(
      props.tables.map((table) => [
        table.name,
        getTableSummary(props.changeSerial, props.changePackage, props.db.path, table.name),
      ]),
    ),
);
const sync = computed(() => detectSyncColumns(facts.value?.tables ?? []));
const rows = computed(() =>
  overviewRows({
    tables: props.tables,
    facts: facts.value,
    sync: sync.value.byTable,
    changes: (table) => summaries.value.get(table),
  }),
);
const checks = computed(() =>
  facts.value
    ? healthChecks(facts.value, new Map(props.tables.map((table) => [table.name, table.rowCount])))
    : [],
);
const changed = computed(() =>
  [...summaries.value]
    .filter(([, summary]) => summary.total > 0)
    .map(([table, summary]) => ({ table, summary }))
    .sort((a, b) => (b.summary.latestAt ?? "").localeCompare(a.summary.latestAt ?? "")),
);

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
  <div v-else class="@container flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
    <SqliteOverviewFacts :facts="facts" :db="db" />
    <DataState
      v-if="factsError"
      compact
      kind="error"
      title="Could not read the sizes and checks"
      :detail="factsError"
      @retry="refetch()"
    />
    <div class="flex min-h-0 flex-1 flex-col gap-4 @4xl:flex-row">
      <SqliteOverviewTables
        class="min-h-80 @4xl:min-w-0"
        :rows="rows"
        :only="only"
        @open="emit('open', $event, true)"
        @clear-only="only = null"
      />
      <aside class="flex shrink-0 flex-col gap-5 @4xl:w-80">
        <SqliteOverviewChanges
          :changed="changed"
          :watched="watched"
          @open="emit('open', $event, false)"
        />
        <SqliteOverviewChecks :checks="checks" :address="address" @show="show" />
        <section v-if="sync.counts.length" class="flex flex-col gap-1.5" aria-label="Sync columns">
          <h3 class="text-2xs font-medium text-[var(--fg-subtle)]">Sync columns (detected)</h3>
          <p class="text-xs text-muted-foreground">
            <template v-for="(entry, index) in sync.counts.slice(0, 6)" :key="entry.column">
              <span v-if="index > 0"> · </span>
              <span class="font-mono text-foreground">{{ entry.column }}</span>
              in {{ entry.tables }} {{ entry.tables === 1 ? "table" : "tables" }}
            </template>
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>
