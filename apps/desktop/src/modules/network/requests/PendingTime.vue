<script setup lang="ts">
import { computed } from "vue";
import { formatMs } from "./requestCells";
import { usePendingClock } from "./pendingClock";

const props = defineProps<{ since: number }>();

const now = usePendingClock();
const elapsed = computed(() => formatMs(Math.max(0, now.value - props.since)));
</script>

<template>
  <span class="truncate font-mono text-[var(--fg-subtle)] tabular-nums">
    <span class="sr-only">Open for</span>
    {{ elapsed }}
  </span>
</template>
