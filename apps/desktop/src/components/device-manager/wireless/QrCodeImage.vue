<script setup lang="ts">
import { computed } from "vue";
import type { QrMatrix } from "@/types/wireless.types";

const QUIET_ZONE = 4;

const props = defineProps<{ matrix: QrMatrix; label: string; dimmed?: boolean }>();

const viewBox = computed(() => {
  const side = props.matrix.size + QUIET_ZONE * 2;
  return `${-QUIET_ZONE} ${-QUIET_ZONE} ${side} ${side}`;
});
</script>

<template>
  <svg
    :viewBox="viewBox"
    role="img"
    :aria-label="props.label"
    shape-rendering="crispEdges"
    class="block size-full rounded-well transition-opacity duration-200 ease-in-out"
    :class="props.dimmed ? 'opacity-20' : 'opacity-100'"
  >
    <rect :x="-QUIET_ZONE" :y="-QUIET_ZONE" width="100%" height="100%" class="fill-white" />
    <path :d="props.matrix.path" class="fill-black" />
  </svg>
</template>
