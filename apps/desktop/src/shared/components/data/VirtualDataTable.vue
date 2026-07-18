<script setup lang="ts">
import { computed, ref } from "vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";

const props = defineProps<{
  columns: readonly string[];
  rows: readonly (readonly unknown[])[];
}>();

const scrollElement = ref<HTMLElement | null>(null);
const sourceRows = computed(() => props.rows);
const {
  items: virtualRows,
  topSpacerHeight,
  bottomSpacerHeight,
} = useFixedVirtualList(sourceRows, scrollElement, { itemHeight: 32, overscan: 10 });

function renderCell(value: unknown): { text: string; tone: "null" | "blob" | "value" } {
  if (value === null || value === undefined) return { text: "NULL", tone: "null" };
  if (value instanceof Uint8Array) return { text: `<blob ${value.byteLength} B>`, tone: "blob" };
  if (typeof value === "string" && value.startsWith("[BLOB ")) {
    return { text: value, tone: "blob" };
  }
  if (typeof value === "object") return { text: JSON.stringify(value), tone: "value" };
  return { text: String(value), tone: "value" };
}
</script>

<template>
  <div ref="scrollElement" class="min-h-0 overflow-auto">
    <table v-if="props.columns.length" class="w-full text-xs">
      <thead class="sticky top-0 z-10">
        <tr
          class="border-b border-border/30 bg-surface-2 text-left uppercase tracking-wider text-muted-foreground/50"
        >
          <th
            v-for="column in props.columns"
            :key="column"
            class="whitespace-nowrap px-3 py-2 font-medium"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="topSpacerHeight" aria-hidden="true">
          <td :colspan="props.columns.length" :style="{ height: `${topSpacerHeight}px` }" />
        </tr>
        <tr
          v-for="virtualRow in virtualRows"
          :key="virtualRow.index"
          class="data-row border-b border-border/20"
        >
          <td
            v-for="(cell, cellIndex) in virtualRow.data"
            :key="cellIndex"
            class="px-3 py-1.5 align-top font-mono"
          >
            <span
              class="block max-w-md truncate"
              :class="{
                'italic text-muted-foreground/40': renderCell(cell).tone === 'null',
                'text-violet-300': renderCell(cell).tone === 'blob',
                'text-secondary-foreground': renderCell(cell).tone === 'value',
              }"
            >
              {{ renderCell(cell).text }}
            </span>
          </td>
        </tr>
        <tr v-if="bottomSpacerHeight" aria-hidden="true">
          <td :colspan="props.columns.length" :style="{ height: `${bottomSpacerHeight}px` }" />
        </tr>
      </tbody>
    </table>
  </div>
</template>
