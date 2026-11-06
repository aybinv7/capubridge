<script setup lang="ts">
import { computed, ref } from "vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { hexRows } from "./hexDump";

const ROW_HEIGHT = 20;

/**
 * Bytes as a classic hex dump (offset, 16 bytes, their printable text), virtualised so a
 * megabyte costs the rows on screen. The one byte view of the app: files and cached bodies.
 */
const props = defineProps<{ bytes: Uint8Array; label: string }>();

const scroller = ref<HTMLElement | null>(null);
const rows = computed(() => hexRows(props.bytes));
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
});
</script>

<template>
  <div
    v-if="rows.length > 0"
    ref="scroller"
    class="min-h-0 flex-1 overflow-auto px-5 py-3 font-mono text-xs leading-5"
    role="table"
    :aria-label="props.label"
  >
    <div class="flex gap-6 pb-1 text-2xs text-[var(--fg-subtle)] uppercase select-none" role="row">
      <span class="w-[8ch] shrink-0" role="columnheader">Offset</span>
      <span class="w-[48ch] shrink-0" role="columnheader">Bytes</span>
      <span role="columnheader">Text</span>
    </div>
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="item in items"
      :key="item.index"
      class="flex gap-6 whitespace-pre"
      role="row"
      :style="{ height: `${ROW_HEIGHT}px` }"
    >
      <span class="w-[8ch] shrink-0 text-[var(--fg-subtle)] select-none" role="cell">{{
        item.data.offset
      }}</span>
      <span class="w-[48ch] shrink-0 text-foreground" role="cell">{{ item.data.hex }}</span>
      <span class="text-muted-foreground" role="cell">{{ item.data.ascii }}</span>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
