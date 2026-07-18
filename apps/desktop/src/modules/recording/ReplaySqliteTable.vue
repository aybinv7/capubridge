<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Eye, GitCompare } from "lucide-vue-next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import JsonViewer from "@/shared/components/data/JsonViewer.vue";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";

const props = defineProps<{
  columns: string[];
  rows: unknown[][];
  isLoading: boolean;
  changesByRowKey?: Map<string, SqliteRecordChange>;
  rowKeyResolver: (record: Record<string, unknown>) => string;
}>();

const emit = defineEmits<{
  openRowDiff: [rowKey: string];
}>();

const selectedRecord = shallowRef<Record<string, unknown> | null>(null);
const records = computed(() =>
  props.rows
    .slice(0, 50)
    .map((row) =>
      Object.fromEntries(props.columns.map((column, index) => [column, row[index] ?? null])),
    ),
);

function displayValue(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function changeFor(record: Record<string, unknown>) {
  return props.changesByRowKey?.get(props.rowKeyResolver(record)) ?? null;
}

function rowClass(record: Record<string, unknown>) {
  switch (changeFor(record)?.operation) {
    case "add":
      return "bg-emerald-500/10";
    case "update":
      return "bg-amber-500/10";
    case "delete":
      return "bg-red-500/10 opacity-70";
    default:
      return "hover:bg-surface-2/70";
  }
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto">
    <div
      v-if="isLoading"
      class="flex h-full items-center justify-center text-xs text-muted-foreground/40"
    >
      Loading rows…
    </div>
    <div
      v-else-if="records.length === 0"
      class="flex h-full items-center justify-center text-xs text-muted-foreground/40"
    >
      No rows captured
    </div>
    <table v-else class="min-w-full border-collapse text-left text-xs">
      <thead class="sticky top-0 z-10 bg-surface-1 text-[10px] uppercase text-muted-foreground/50">
        <tr>
          <th
            v-for="column in columns"
            :key="column"
            class="min-w-40 border-b border-border/30 px-3 py-2 font-medium"
          >
            {{ column }}
          </th>
          <th class="sticky right-0 w-20 border-b border-border/30 bg-surface-1 px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(record, index) in records"
          :key="`${rowKeyResolver(record)}:${index}`"
          class="border-b border-border/15 transition-colors"
          :class="rowClass(record)"
        >
          <td
            v-for="column in columns"
            :key="column"
            class="max-w-80 truncate px-3 py-2 font-mono text-foreground/70"
            :title="displayValue(record[column])"
          >
            {{ displayValue(record[column]) }}
          </td>
          <td class="sticky right-0 bg-inherit px-2 py-1.5">
            <div class="flex items-center gap-1">
              <button
                v-if="changeFor(record)"
                type="button"
                class="flex size-7 items-center justify-center rounded-md text-amber-300/70 hover:bg-amber-500/15 hover:text-amber-200"
                aria-label="View row change"
                @click="emit('openRowDiff', rowKeyResolver(record))"
              >
                <GitCompare :size="13" />
              </button>
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-surface-3 hover:text-foreground"
                aria-label="Inspect row"
                @click="selectedRecord = record"
              >
                <Eye :size="13" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Dialog
    :open="selectedRecord !== null"
    @update:open="(open) => (open ? null : (selectedRecord = null))"
  >
    <DialogContent class="flex h-[75vh] w-[80vw] max-w-[80vw] flex-col gap-0 p-0">
      <DialogHeader class="shrink-0 border-b border-border/30 px-5 py-3">
        <DialogTitle class="truncate text-sm">Captured row</DialogTitle>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-hidden">
        <JsonViewer v-if="selectedRecord" :value="selectedRecord" />
      </div>
    </DialogContent>
  </Dialog>
</template>
