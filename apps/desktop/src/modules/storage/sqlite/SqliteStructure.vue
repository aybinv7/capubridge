<script setup lang="ts">
import { computed } from "vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { SqliteStructure } from "./sqliteReads";

/** How a table is built, read from the same copy as its rows. */
const props = defineProps<{
  structure: SqliteStructure | null;
  createSql: string;
  loading: boolean;
  error: string | null;
  /** Tables of the database, so a foreign key can open the table it points at. */
  tableNames: ReadonlySet<string>;
}>();

const emit = defineEmits<{ openTable: [table: string]; retry: [] }>();

const compositeKey = computed(
  () => (props.structure?.columns.filter((column) => column.pk > 0).length ?? 0) > 1,
);

function keyText(position: number): string {
  if (position <= 0) return "";
  return compositeKey.value ? `Yes, part ${position}` : "Yes";
}
</script>

<template>
  <DataState
    v-if="error"
    kind="error"
    title="Could not read how the table is built"
    :detail="error"
    @retry="emit('retry')"
  />
  <DataState
    v-else-if="loading || !structure"
    kind="loading"
    title="Reading how the table is built"
  />
  <div v-else class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
    <div class="flex max-w-4xl flex-col gap-6 text-xs">
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-foreground">Columns</h2>
        <p v-if="structure.columns.length === 0" class="text-muted-foreground">
          The database reported no columns.
        </p>
        <table v-else class="w-full text-left">
          <thead class="text-2xs text-muted-foreground">
            <tr class="border-b border-border-subtle">
              <th class="w-10 py-1.5 pr-4 font-normal">#</th>
              <th class="py-1.5 pr-4 font-normal">Column</th>
              <th class="py-1.5 pr-4 font-normal">Type</th>
              <th class="py-1.5 pr-4 font-normal">Required</th>
              <th class="py-1.5 pr-4 font-normal">Default</th>
              <th class="py-1.5 font-normal">Primary key</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            <tr v-for="column in structure.columns" :key="column.cid">
              <td class="py-1.5 pr-4 font-mono text-[var(--fg-subtle)] tabular-nums">
                {{ column.cid }}
              </td>
              <td class="py-1.5 pr-4 font-mono text-foreground">{{ column.name }}</td>
              <td class="py-1.5 pr-4 font-mono text-muted-foreground">
                {{ column.colType || "—" }}
              </td>
              <td class="py-1.5 pr-4 text-muted-foreground">{{ column.notnull ? "Yes" : "No" }}</td>
              <td class="py-1.5 pr-4 font-mono text-muted-foreground">
                {{ column.defaultValue ?? "NULL" }}
              </td>
              <td class="py-1.5 text-muted-foreground">
                {{ keyText(column.pk) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-foreground">Indexes</h2>
        <p v-if="structure.indexes.length === 0" class="text-muted-foreground">
          No indexes: rows are found by scanning the table, or by its primary key.
        </p>
        <ul v-else class="flex flex-col gap-3">
          <li v-for="index in structure.indexes" :key="index.name" class="flex flex-col gap-1">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-mono text-foreground">{{ index.name }}</span>
              <span class="text-muted-foreground">
                {{ index.unique ? "unique" : "not unique" }} · on
                <span class="font-mono">{{ index.columns.join(", ") || "an expression" }}</span>
              </span>
            </p>
            <pre
              v-if="index.sql"
              class="overflow-x-auto rounded-inner bg-surface-cut px-3 py-2 font-mono text-2xs text-muted-foreground shadow-cut select-text"
              >{{ index.sql }}</pre
            >
            <p v-else class="text-2xs text-[var(--fg-subtle)]">
              Made by SQLite for a UNIQUE or PRIMARY KEY constraint, so it has no SQL of its own.
            </p>
          </li>
        </ul>
      </section>

      <section v-if="structure.foreignKeys.length" class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-foreground">Foreign keys</h2>
        <table class="w-full text-left">
          <thead class="text-2xs text-muted-foreground">
            <tr class="border-b border-border-subtle">
              <th class="py-1.5 pr-4 font-normal">Column</th>
              <th class="py-1.5 pr-4 font-normal">Points at</th>
              <th class="py-1.5 pr-4 font-normal">On update</th>
              <th class="py-1.5 font-normal">On delete</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            <tr v-for="key in structure.foreignKeys" :key="`${key.id}-${key.seq}`">
              <td class="py-1.5 pr-4 font-mono text-foreground">{{ key.fromColumn }}</td>
              <td class="py-1.5 pr-4 font-mono">
                <button
                  v-if="tableNames.has(key.toTable)"
                  type="button"
                  class="text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                  @click="emit('openTable', key.toTable)"
                >
                  {{ key.toTable }}.{{ key.toColumn ?? "rowid" }}
                </button>
                <span v-else class="text-muted-foreground">
                  {{ key.toTable }}.{{ key.toColumn ?? "rowid" }}
                </span>
              </td>
              <td class="py-1.5 pr-4 text-muted-foreground">{{ key.onUpdate ?? "—" }}</td>
              <td class="py-1.5 text-muted-foreground">{{ key.onDelete ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-foreground">Triggers</h2>
        <p v-if="structure.triggers.length === 0" class="text-muted-foreground">
          No triggers run on this table.
        </p>
        <ul v-else class="flex flex-col gap-3">
          <li v-for="trigger in structure.triggers" :key="trigger.name" class="flex flex-col gap-1">
            <span class="font-mono text-foreground">{{ trigger.name }}</span>
            <pre
              class="overflow-x-auto rounded-inner bg-surface-cut px-3 py-2 font-mono text-2xs text-muted-foreground shadow-cut select-text"
              >{{ trigger.sql }}</pre
            >
          </li>
        </ul>
      </section>

      <section v-if="createSql" class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-foreground">CREATE statement</h2>
        <pre
          class="overflow-x-auto rounded-inner bg-surface-cut px-3 py-2 font-mono text-2xs text-muted-foreground shadow-cut select-text"
          >{{ createSql }}</pre
        >
      </section>
    </div>
  </div>
</template>
