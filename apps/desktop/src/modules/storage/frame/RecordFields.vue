<script setup lang="ts">
import { computed, ref } from "vue";
import { KeyRound } from "lucide-vue-next";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import { cellToText, formatCell } from "@/shared/components/data/grid";
import type { GridColumn } from "@/shared/components/data/grid";

/** Every field of the record, one per line, findable and copyable. Long values wrap. */
const props = defineProps<{
  columns: readonly GridColumn[];
  cells: Readonly<Record<string, unknown>>;
}>();

const query = ref("");

const KIND_CLASS: Record<string, string> = {
  null: "italic text-[var(--fg-subtle)]",
  blob: "text-cat-storage",
  json: "font-mono text-muted-foreground",
  date: "font-mono tabular-nums",
  number: "font-mono tabular-nums",
  boolean: "font-mono",
  string: "",
};

const fields = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return props.columns
    .filter(
      (column) =>
        !needle ||
        column.title.toLowerCase().includes(needle) ||
        cellToText(props.cells[column.id]).toLowerCase().includes(needle),
    )
    .map((column) => {
      const value = props.cells[column.id];
      const formatted = formatCell(value, column.type);
      const full =
        formatted.kind === "json"
          ? JSON.stringify(value, null, 2)
          : formatted.kind === "string"
            ? cellToText(value)
            : formatted.text;
      return { column, formatted, full, copy: cellToText(value) };
    });
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-3 pt-2 pb-1">
      <input
        v-model="query"
        type="search"
        placeholder="Find a field or value"
        aria-label="Find a field or value"
        class="h-7 w-full rounded-control bg-surface-cut px-2 text-xs text-foreground shadow-cut outline-none placeholder:text-[var(--fg-subtle)] focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
    <dl class="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
      <div
        v-for="field in fields"
        :key="field.column.id"
        class="group/field rounded-control px-2 py-1.5 hover:bg-cladd-surface-hover"
      >
        <dt class="flex items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
          <KeyRound
            v-if="field.column.primaryKey"
            :size="11"
            class="text-signal-mark"
            aria-label="Key"
          />
          <span class="truncate font-medium text-muted-foreground">{{ field.column.title }}</span>
          <span class="flex-1" />
          <CopyAction
            :value="field.copy"
            :label="`Copy ${field.column.title}`"
            class="opacity-0 transition-opacity duration-120 group-hover/field:opacity-100 focus-visible:opacity-100"
          />
        </dt>
        <dd
          dir="auto"
          class="mt-0.5 max-h-48 overflow-y-auto text-xs break-words whitespace-pre-wrap text-foreground select-text"
          :class="KIND_CLASS[field.formatted.kind]"
        >
          {{ field.full }}
        </dd>
      </div>
      <p v-if="fields.length === 0" class="px-2 py-3 text-xs text-muted-foreground">
        No field or value matches “{{ query }}”.
      </p>
    </dl>
  </div>
</template>
