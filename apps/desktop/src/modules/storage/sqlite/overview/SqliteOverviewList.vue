<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, Eye, Table2, X } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDatabaseFacts, SqliteTableInfo } from "@/types/sqlite.types";
import SqliteOverviewCard from "./SqliteOverviewCard.vue";

/**
 * Every table and view as one quiet line (rows, size on disk when known), with its CREATE
 * statement one click away. A health check can narrow the list to the tables it is about.
 */
const props = defineProps<{
  tables: readonly SqliteTableInfo[];
  facts: SqliteDatabaseFacts | null;
  only: { label: string; tables: ReadonlySet<string> } | null;
}>();

const emit = defineEmits<{ open: [table: string]; clearOnly: [] }>();

const opened = ref<string | null>(null);
const count = (value: number) => value.toLocaleString("en-US");

const sizes = computed(
  () => new Map((props.facts?.tables ?? []).map((table) => [table.name, table.bytes])),
);
const shown = computed(() =>
  props.only ? props.tables.filter((table) => props.only?.tables.has(table.name)) : props.tables,
);

function sizeOf(name: string): string {
  const bytes = sizes.value.get(name);
  return bytes === null || bytes === undefined ? "" : formatBytes(bytes);
}
</script>

<template>
  <SqliteOverviewCard
    :title="props.only ? props.only.label : 'Tables and views'"
    :note="`${count(shown.length)} of ${count(props.tables.length)}`"
  >
    <template v-if="props.only" #aside>
      <IconAction label="Show every table" size="sm" @click="emit('clearOnly')">
        <X :stroke-width="1.8" />
      </IconAction>
    </template>
    <ul class="flex flex-col">
      <li v-for="table in shown" :key="table.name" class="flex flex-col">
        <div
          class="flex h-7 items-center gap-2 rounded-control px-1.5 hover:bg-cladd-surface-hover"
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
              class="transition-transform duration-150 ease-cladd-settle"
              :class="opened === table.name && 'rotate-90'"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-foreground/85 hover:text-foreground"
            @click="emit('open', table.name)"
          >
            <component
              :is="table.tableType === 'view' ? Eye : Table2"
              :size="13"
              class="shrink-0 text-[var(--fg-subtle)]"
              aria-hidden="true"
            />
            <span class="truncate">{{ table.name }}</span>
            <span v-if="table.tableType === 'view'" class="text-2xs text-[var(--fg-subtle)]">
              view
            </span>
          </button>
          <span class="w-16 text-right font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
            {{ sizeOf(table.name) }}
          </span>
          <span class="w-20 text-right font-mono text-2xs text-muted-foreground tabular-nums">
            {{ count(table.rowCount) }} rows
          </span>
        </div>
        <pre
          v-if="opened === table.name"
          class="mx-1.5 mb-2 ml-8 overflow-x-auto rounded-inner bg-surface-cut px-3 py-2 font-mono text-2xs text-muted-foreground shadow-cut select-text"
          >{{ table.sql || "No CREATE statement is stored for it." }}</pre
        >
      </li>
    </ul>
  </SqliteOverviewCard>
</template>
