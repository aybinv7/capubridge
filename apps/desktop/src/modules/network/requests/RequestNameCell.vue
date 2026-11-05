<script setup lang="ts">
import type { RowCells } from "./requestRowCells";

const props = defineProps<{ cells: RowCells }>();
</script>

<template>
  <span class="flex min-w-0 items-baseline gap-2 font-mono" :title="props.cells.url">
    <span v-if="props.cells.method" class="shrink-0 text-[var(--fg-subtle)]">{{
      props.cells.method
    }}</span>
    <span class="shrink truncate text-foreground">{{ props.cells.name }}</span>
    <span v-if="props.cells.detail" class="min-w-0 flex-1 truncate text-[var(--fg-subtle)]">{{
      props.cells.detail
    }}</span>
  </span>
</template>
