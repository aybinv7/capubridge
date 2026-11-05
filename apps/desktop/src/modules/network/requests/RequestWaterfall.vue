<script setup lang="ts">
import type { WaterfallBar } from "./waterfall";

const props = defineProps<{ bar: WaterfallBar; failed: boolean }>();
</script>

<template>
  <span class="relative h-2.5 w-full" aria-hidden="true">
    <span
      class="absolute top-0 flex h-full min-w-0.75 overflow-hidden rounded-inner"
      :class="[props.bar.open && 'opacity-60', props.failed ? 'bg-error' : 'bg-cat-network']"
      :style="{ left: `${props.bar.left}%`, width: `${props.bar.waiting + props.bar.receiving}%` }"
    >
      <span
        v-if="props.bar.waiting > 0"
        class="h-full bg-background/55"
        :style="{ flexGrow: props.bar.waiting }"
      />
      <span
        v-if="props.bar.receiving > 0"
        class="h-full"
        :style="{ flexGrow: props.bar.receiving }"
      />
    </span>
  </span>
</template>
