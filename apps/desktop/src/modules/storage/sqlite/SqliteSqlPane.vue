<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { History, Lock, Play } from "lucide-vue-next";
import { Button, Popover } from "@capubridge/cladd";
import {
  DataGrid,
  DataGridStatus,
  type GridColumn,
  type GridRow,
  type GridSummary,
} from "@/shared/components/data/grid";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { bindingTokens } from "@/lib/commands/keymap";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { SqliteQueryResult } from "@/types/sqlite.types";
import type { SqliteAddress } from "./sqliteAddress";
import { runQuery } from "./sqliteReads";
import { quoteIdent } from "./sqlText";
import { useSqliteSqlHistory } from "./useSqliteSqlHistory";

const PANE_ROWS = 10_000;

/**
 * Free SQL on the open copy. The connection only reads, so any SELECT across any table runs and a
 * statement that would change data is refused by the database itself (C25). Ctrl+Enter runs;
 * the queries run on each database are kept, newest first.
 */
const props = defineProps<{
  address: SqliteAddress | null;
  /** Identity of the database, for its own history. */
  databaseId: string;
  databaseName: string;
  /** The open table, to seed the editor. */
  table: string;
}>();

const history = useSqliteSqlHistory();
const text = ref("");
const running = ref(false);
const error = ref<string | null>(null);
const result = shallowRef<SqliteQueryResult | null>(null);
const editor = ref<HTMLTextAreaElement | null>(null);
const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedCells: 0,
  selectedRowIds: [],
  aggregate: null,
});

const earlier = computed(() => history.list(props.databaseId));

function seed() {
  text.value =
    earlier.value[0] ??
    (props.table
      ? `SELECT * FROM ${quoteIdent(props.table)} LIMIT 100;`
      : "SELECT name, type FROM sqlite_master;");
}

watch(() => [props.databaseId, props.table], seed, { immediate: true });

const columns = computed<GridColumn[]>(() =>
  (result.value?.columns ?? []).map((name, index) => ({ id: `${index}`, title: name })),
);
const capped = computed(() => (result.value?.rows.length ?? 0) > PANE_ROWS);
const rows = computed<GridRow[]>(() =>
  (result.value?.rows ?? []).slice(0, PANE_ROWS).map((values, index) => ({
    id: `${index}`,
    cells: Object.fromEntries(values.map((value, column) => [`${column}`, value])),
  })),
);

async function run() {
  const address = props.address;
  const sql = text.value.trim();
  if (!address || !sql || running.value) return;
  running.value = true;
  error.value = null;
  try {
    result.value = await runQuery(address, sql, false, PANE_ROWS + 1);
    history.remember(props.databaseId, sql);
  } catch (failure) {
    error.value = (failure instanceof Error ? failure.message : String(failure)).replace(
      /^Error:\s*/,
      "",
    );
  } finally {
    running.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void run();
  }
}

function pick(sql: string, close: () => void) {
  text.value = sql;
  close();
  editor.value?.focus();
}

defineExpose({ focus: () => editor.value?.focus() });
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 flex-col gap-2 border-b border-border-subtle px-3 py-2">
      <textarea
        ref="editor"
        v-model="text"
        :aria-label="`SQL to run on ${databaseName}`"
        rows="5"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        class="w-full resize-y rounded-inner bg-surface-cut px-2.5 py-2 font-mono text-xs leading-5 text-foreground shadow-cut outline-none placeholder:text-[var(--fg-subtle)] focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="SELECT * FROM …"
        @keydown="onKeydown"
      />
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="solid-fill"
          color="brand"
          :loading="running"
          :disabled="!address || !text.trim()"
          content-class-name="gap-1.5"
          @click="run"
        >
          <Play :size="12" aria-hidden="true" />
          Run
          <KeyCaps :keys="bindingTokens('mod+enter')" quiet />
        </Button>
        <Popover v-if="earlier.length" position="bottom-start" content-class-name="w-96 p-1">
          <template #trigger>
            <Button size="sm" variant="transparent" :outline="false" content-class-name="gap-1.5">
              <History :size="13" aria-hidden="true" />
              Earlier queries
            </Button>
          </template>
          <template #default="{ close }">
            <div class="flex max-h-80 flex-col overflow-y-auto">
              <Button
                v-for="entry in earlier"
                :key="entry"
                size="sm"
                variant="transparent"
                :outline="false"
                content-class-name="w-full justify-start font-mono text-2xs"
                @click="pick(entry, close)"
              >
                <span class="truncate">{{ entry }}</span>
              </Button>
            </div>
          </template>
        </Popover>
        <span class="flex items-center gap-1 text-2xs text-muted-foreground">
          <Lock :size="11" aria-hidden="true" />
          This pane only reads.
        </span>
      </div>
    </div>

    <DataState
      v-if="error"
      kind="error"
      compact
      title="The query did not run"
      :detail="error"
      @retry="run"
    />
    <DataState
      v-else-if="!result"
      kind="empty"
      title="Run a query to see its rows"
      text="Any SELECT works, across every table of this database."
    />
    <template v-else>
      <div class="min-h-0 flex-1 p-2">
        <DataGrid
          :label="`Result of the query on ${databaseName}`"
          :columns="columns"
          :rows="rows"
          read-only
          @summary="summary = $event"
        >
          <template #empty>The query returned no rows.</template>
        </DataGrid>
      </div>
      <DataGridStatus :summary="summary">
        <span v-if="capped" class="tabular-nums" role="status">
          Showing the first {{ PANE_ROWS.toLocaleString("en-US") }} rows; add a LIMIT or a WHERE to
          see others
        </span>
        <span class="tabular-nums">{{ result.durationMs }} ms</span>
      </DataGridStatus>
    </template>
  </div>
</template>
