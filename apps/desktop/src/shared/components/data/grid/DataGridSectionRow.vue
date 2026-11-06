<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { sectionValueText } from "./gridSections";
import { formatCell } from "./valueFormat";
import type { GridColumnType, GridSection } from "./types";

/**
 * A section header across the whole grid: chevron, the section's name and value, and how many
 * rows it holds. It sits on a raised band with a hairline above and a gap before it, so each
 * group reads as its own block.
 */
const props = defineProps<{
  cellId: string;
  section: GridSection;
  index: number;
  /** Height of the band itself; the row's own height adds the gap above it. */
  bandHeight: number;
  focused: boolean;
  valueType?: GridColumnType;
}>();

const INDENT_PX = 14;

const value = computed(() =>
  sectionValueText(props.section.value, formatCell(props.section.value, props.valueType).text),
);
const countText = computed(() => {
  const count = props.section.count;
  if (count === null) return "";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "row" : "rows"}`;
});
</script>

<template>
  <div
    role="row"
    :aria-rowindex="index + 2"
    :aria-expanded="section.open"
    :aria-level="(section.depth ?? 0) + 1"
    :data-section-row="index"
    class="flex flex-col justify-end"
  >
    <div
      class="flex w-full shrink-0 cursor-default items-center border-t border-cladd-outline bg-cladd-surface text-cladd-xs transition-colors duration-120 select-none hover:bg-cladd-surface-hover"
      :class="focused && 'shadow-[inset_0_0_0_1.5px_var(--cladd-primary)]'"
      :style="{ height: `${bandHeight}px` }"
    >
      <div
        :id="cellId"
        role="gridcell"
        aria-colindex="1"
        class="sticky left-0 flex min-w-0 items-center gap-2 pr-3"
        :style="{ paddingLeft: `${8 + (section.depth ?? 0) * INDENT_PX}px` }"
      >
        <ChevronRight
          :size="14"
          aria-hidden="true"
          class="shrink-0 text-cladd-fg-soft transition-transform duration-200 ease-cladd-settle motion-reduce:transition-none"
          :class="section.open && 'rotate-90'"
        />
        <span class="shrink-0 font-mono text-cladd-2xs text-cladd-fg-soft">{{
          section.label
        }}</span>
        <span
          dir="auto"
          class="max-w-96 truncate"
          :class="
            value.kind === 'value' ? 'font-medium text-cladd-fg' : 'italic text-cladd-fg-softer'
          "
          :title="value.kind === 'value' ? value.text : undefined"
          >{{ value.text }}</span
        >
        <span
          v-if="countText"
          class="shrink-0 font-mono text-cladd-2xs text-cladd-fg-softer tabular-nums"
          >{{ countText }}</span
        >
      </div>
    </div>
  </div>
</template>
