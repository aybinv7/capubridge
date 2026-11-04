<script setup lang="ts">
import { computed } from "vue";
import { Copy, KeyRound, Link2, X } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import JsonViewer from "../JsonViewer.vue";
import { cellToText, formatCell } from "./valueFormat";
import type { GridColumn, GridRow, GridRowState } from "./types";

const props = defineProps<{
  columns: readonly GridColumn[];
  row: GridRow | null;
  title?: string;
  state?: GridRowState;
}>();

const emit = defineEmits<{ close: []; followForeignKey: [target: string, value: unknown] }>();

const STATE_LABEL: Record<GridRowState, string> = {
  "staged-edit": "edited, not saved",
  "staged-insert": "new, not saved",
  "staged-delete": "will be deleted",
  conflict: "changed on the device",
  recent: "written by the app just now",
};

const fields = computed(() => {
  const row = props.row;
  if (!row) return [];
  return props.columns.map((column) => {
    const value = row.cells[column.id];
    const formatted = formatCell(value, column.type);
    const structured =
      formatted.kind === "json" || (typeof value === "string" && value.length > 120);
    return { column, value, formatted, structured };
  });
});

async function copyField(value: unknown) {
  try {
    await navigator.clipboard.writeText(cellToText(value));
    toast.success("Copied value");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

async function copyRow() {
  if (!props.row) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.row.cells, null, 2));
    toast.success("Copied row as JSON");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}
</script>

<template>
  <aside
    class="flex h-full min-h-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    aria-label="Row inspector"
  >
    <header
      class="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3"
    >
      <span class="truncate text-xs font-medium text-foreground">{{ title ?? "Row" }}</span>
      <span v-if="state" class="truncate text-2xs text-signal-mark">{{ STATE_LABEL[state] }}</span>
      <span class="flex-1" />
      <Button
        v-if="row"
        size="xs"
        square
        variant="transparent"
        :outline="false"
        aria-label="Copy row as JSON"
        @click="copyRow"
      >
        <Copy :size="12" aria-hidden="true" />
      </Button>
      <Button
        size="xs"
        square
        variant="transparent"
        :outline="false"
        aria-label="Close inspector"
        @click="emit('close')"
      >
        <X :size="12" aria-hidden="true" />
      </Button>
    </header>

    <div v-if="!row" class="flex flex-1 items-center justify-center px-6 text-center">
      <p class="text-xs text-muted-foreground">
        Select a row to see every field. Arrow keys move; the inspector follows.
      </p>
    </div>

    <dl v-else class="min-h-0 flex-1 overflow-auto py-1">
      <div
        v-for="field in fields"
        :key="field.column.id"
        class="group/field border-b border-[var(--border-subtle)] px-3 py-1.5"
      >
        <dt class="flex items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
          <KeyRound v-if="field.column.primaryKey" :size="11" class="text-signal-mark" />
          <span class="truncate font-medium text-muted-foreground">{{ field.column.title }}</span>
          <span v-if="field.column.typeLabel" class="truncate font-mono">{{
            field.column.typeLabel
          }}</span>
          <span class="flex-1" />
          <button
            v-if="field.column.foreignKey && field.value !== null && field.value !== undefined"
            type="button"
            class="flex items-center gap-1 rounded-sm px-1 text-signal-select hover:bg-[var(--bg-surface-raised)]"
            :title="`Open ${field.column.foreignKey} = ${cellToText(field.value)}`"
            @click="emit('followForeignKey', field.column.foreignKey ?? '', field.value)"
          >
            <Link2 :size="11" />
            {{ field.column.foreignKey }}
          </button>
          <button
            type="button"
            class="rounded-sm p-0.5 opacity-0 group-hover/field:opacity-100 hover:bg-[var(--bg-surface-raised)] focus-visible:opacity-100"
            :aria-label="`Copy ${field.column.title}`"
            @click="copyField(field.value)"
          >
            <Copy :size="11" />
          </button>
        </dt>
        <dd class="mt-0.5 min-w-0 font-mono text-xs">
          <JsonViewer
            v-if="field.formatted.kind === 'json'"
            :value="field.value"
            hide-line-numbers
          />
          <p
            v-else-if="field.structured"
            dir="auto"
            class="whitespace-pre-wrap break-words text-foreground select-text"
          >
            {{ cellToText(field.value) }}
          </p>
          <p
            v-else
            dir="auto"
            class="break-words select-text"
            :class="
              field.formatted.kind === 'null'
                ? 'italic text-[var(--fg-subtle)]'
                : field.formatted.kind === 'blob'
                  ? 'text-cat-storage'
                  : 'text-foreground'
            "
          >
            {{ field.formatted.text }}
          </p>
        </dd>
      </div>
    </dl>
  </aside>
</template>
