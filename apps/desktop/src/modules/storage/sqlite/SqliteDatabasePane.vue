<script setup lang="ts">
import { computed, ref } from "vue";
import { DiagramViewAsync as DiagramView } from "@/modules/storage/diagram/diagramAsync";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { SqliteDiagramSubject } from "@/modules/storage/diagram/diagramSubject";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import SqliteOverview from "./SqliteOverview.vue";
import SqliteSqlPane from "./SqliteSqlPane.vue";
import type { SqliteAddress } from "./sqliteAddress";
import type { SqliteDatabaseView } from "./useSqliteLocation";

/**
 * The body of one of the open database's own tabs: the overview, free SQL, or its diagram. Its
 * name, freshness, Read again and menu sit at the tab strip's right end.
 */
const props = defineProps<{
  db: SqliteDbFile;
  databaseId: string;
  address: SqliteAddress | null;
  tables: readonly SqliteTableInfo[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  view: SqliteDatabaseView;
  /** The phone and app the database belongs to (empty for a file opened here). */
  owner: { serial: string; packageName: string };
  /** The address of one of its tables, for the diagram's "Open data". */
  tablePath: (table: string) => string;
}>();

const emit = defineEmits<{
  openTable: [table: string, keep: boolean];
  refresh: [];
}>();

const sql = ref<InstanceType<typeof SqliteSqlPane> | null>(null);

const diagram = computed<SqliteDiagramSubject | null>(() => {
  const address = props.address;
  if (!address) return null;
  const file = props.db.sourceKind === "imported";
  return {
    kind: "sqlite",
    place: {
      serial: file ? "" : props.owner.serial,
      packageName: file ? "file" : props.owner.packageName,
      kind: "sqlite",
      databasePath: file ? `file:${props.db.sourceFilePath ?? props.db.name}` : props.db.path,
    },
    db: props.db,
    address,
    tables: props.tables,
    openTable: props.tablePath,
  };
});

defineExpose({ focusSearch: () => sql.value?.focus() });
</script>

<template>
  <SqliteSqlPane
    v-if="view === 'sql'"
    ref="sql"
    :address="address"
    :database-id="databaseId"
    :database-name="db.name"
    table=""
  />
  <template v-else-if="view === 'diagram'">
    <DataState
      v-if="error && !loaded"
      kind="error"
      title="Could not open the database"
      :detail="error"
      @retry="emit('refresh')"
    />
    <DataState v-else-if="!diagram || !loaded" kind="loading" title="Opening the database" />
    <DiagramView v-else :subject="diagram" />
  </template>
  <SqliteOverview
    v-else
    :tables="tables"
    :size="db.size"
    :loading="loading"
    :loaded="loaded"
    :error="error"
    @open="emit('openTable', $event, false)"
    @retry="emit('refresh')"
  />
</template>
