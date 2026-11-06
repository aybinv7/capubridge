<script setup lang="ts">
import { computed, ref } from "vue";
import { DiagramViewAsync as DiagramView } from "@/modules/storage/diagram/diagramAsync";
import { RefreshCw } from "lucide-vue-next";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { SqliteDiagramSubject } from "@/modules/storage/diagram/diagramSubject";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import type { DataAction, DataProvenance } from "@/modules/storage/frame/dataFrame.types";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import SqliteOverview from "./SqliteOverview.vue";
import SqliteSourceBadge from "./SqliteSourceBadge.vue";
import SqliteSqlPane from "./SqliteSqlPane.vue";
import type { SqliteAddress } from "./sqliteAddress";
import type { SqliteDatabaseView } from "./useSqliteLocation";

/** The open database: its header, then the overview, free SQL, or its diagram. */
const props = defineProps<{
  db: SqliteDbFile;
  databaseId: string;
  address: SqliteAddress | null;
  tables: readonly SqliteTableInfo[];
  loading: boolean;
  loaded: boolean;
  fetching: boolean;
  error: string | null;
  readAt: number | null;
  view: SqliteDatabaseView;
  provenance: DataProvenance;
  actions: readonly DataAction[];
  /** The phone and app the database belongs to (empty for a file opened here). */
  owner: { serial: string; packageName: string };
  /** The address of one of its tables, for the diagram's "Open data". */
  tablePath: (table: string) => string;
}>();

const emit = defineEmits<{
  setView: [view: SqliteDatabaseView];
  openTable: [table: string];
  action: [id: string];
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
  <DataCollectionHeader
    :title="db.name"
    :identity="db.sourceOpfsPath ?? db.sourceFilePath ?? db.path"
    :provenance="provenance"
    :read-at="readAt"
    :busy="fetching && !loading"
  >
    <SqliteSourceBadge :db="db" />
    <template #actions>
      <Segmented size="xs" active-variant="solid" aria-label="What to show of the database">
        <SegmentedButton :active="view === 'overview'" @click="emit('setView', 'overview')">
          Overview
        </SegmentedButton>
        <SegmentedButton :active="view === 'sql'" @click="emit('setView', 'sql')"
          >SQL</SegmentedButton
        >
        <SegmentedButton :active="view === 'diagram'" @click="emit('setView', 'diagram')">
          Diagram
        </SegmentedButton>
      </Segmented>
      <IconAction
        label="Read again"
        :hint="
          db.sourceKind === 'imported'
            ? 'Reads the file again'
            : 'Copies the database again and compares it'
        "
        @click="emit('refresh')"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
      <DataRowMenu
        v-if="actions.length"
        :actions="actions"
        :label="`Actions for ${db.name}`"
        @select="emit('action', $event)"
      />
    </template>
  </DataCollectionHeader>

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
    @open="emit('openTable', $event)"
    @retry="emit('refresh')"
  />
</template>
