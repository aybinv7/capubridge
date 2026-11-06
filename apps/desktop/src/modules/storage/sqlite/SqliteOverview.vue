<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, Eye, Table2 } from "lucide-vue-next";
import DataOverview, {
  type OverviewBars,
  type OverviewStat,
} from "@/modules/storage/frame/DataOverview.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { formatBytes } from "@/shared/format/numbers";
import type { SqliteTableInfo } from "@/types/sqlite.types";

/** A database at a glance: counts, the biggest tables, and every table with its CREATE SQL. */
const props = defineProps<{
  tables: readonly SqliteTableInfo[];
  size: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ open: [table: string]; retry: [] }>();

const opened = ref<string | null>(null);

const count = (value: number) => value.toLocaleString("en-US");

const plain = computed(() => props.tables.filter((table) => table.tableType === "table"));
const views = computed(() => props.tables.filter((table) => table.tableType === "view"));

const stats = computed<OverviewStat[]>(() => [
  { label: "Tables", value: count(plain.value.length) },
  { label: "Views", value: count(views.value.length) },
  {
    label: "Rows",
    value: count(plain.value.reduce((sum, table) => sum + table.rowCount, 0)),
    detail: "in tables",
  },
  { label: "Size", value: formatBytes(props.size) },
]);

const bars = computed<OverviewBars[]>(() => [
  {
    id: "rows",
    title: "Most rows",
    empty: "No table has rows yet.",
    items: [...plain.value]
      .filter((table) => table.rowCount > 0)
      .sort((left, right) => right.rowCount - left.rowCount)
      .slice(0, 10)
      .map((table) => ({
        id: table.name,
        label: table.name,
        value: table.rowCount,
        display: count(table.rowCount),
      })),
  },
]);
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
  <DataOverview v-else :stats="stats" :bars="bars" @open="emit('open', $event)">
    <section class="flex flex-col gap-2">
      <h3 class="text-xs font-medium text-foreground">Tables and views</h3>
      <ul class="flex flex-col">
        <li v-for="table in tables" :key="table.name" class="flex flex-col">
          <div
            class="group/row flex h-7 items-center gap-2 rounded-control px-2 hover:bg-cladd-surface-hover"
          >
            <button
              type="button"
              class="flex size-5 shrink-0 items-center justify-center rounded-inner text-[var(--fg-subtle)] hover:text-foreground"
              :aria-expanded="opened === table.name"
              :aria-label="
                opened === table.name
                  ? `Hide the SQL of ${table.name}`
                  : `Show the SQL of ${table.name}`
              "
              @click="opened = opened === table.name ? null : table.name"
            >
              <ChevronRight
                :size="12"
                class="transition-transform duration-120"
                :class="opened === table.name && 'rotate-90'"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-foreground/85"
              @click="emit('open', table.name)"
            >
              <component
                :is="table.tableType === 'view' ? Eye : Table2"
                :size="13"
                class="shrink-0 text-[var(--fg-subtle)]"
                aria-hidden="true"
              />
              <span class="truncate">{{ table.name }}</span>
              <span v-if="table.tableType === 'view'" class="text-2xs text-[var(--fg-subtle)]"
                >view</span
              >
            </button>
            <span class="font-mono text-2xs text-muted-foreground tabular-nums">
              {{ count(table.rowCount) }} rows
            </span>
          </div>
          <pre
            v-if="opened === table.name"
            class="mx-2 mb-2 ml-9 overflow-x-auto rounded-inner bg-surface-cut px-3 py-2 font-mono text-2xs text-muted-foreground shadow-cut select-text"
            >{{ table.sql || "No CREATE statement is stored for it." }}</pre
          >
        </li>
      </ul>
    </section>
  </DataOverview>
</template>
