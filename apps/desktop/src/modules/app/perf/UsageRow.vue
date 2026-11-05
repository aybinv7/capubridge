<script setup lang="ts">
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    /** 0–100 fill of a bar under the row; no bar when absent. */
    meter?: number;
    hint?: string;
  }>(),
  { meter: undefined, hint: undefined },
);
</script>

<template>
  <div class="flex flex-col gap-1.5 py-1.5">
    <div class="flex items-baseline justify-between gap-3">
      <HintTooltip :text="props.hint ?? null" position="top">
        <span class="text-xs text-muted-foreground">{{ props.label }}</span>
      </HintTooltip>
      <span class="font-mono text-sm text-foreground tabular-nums">{{ props.value }}</span>
    </div>
    <span
      v-if="props.meter !== undefined"
      class="h-1 overflow-hidden rounded-full bg-surface-cut shadow-cut"
      aria-hidden="true"
    >
      <span
        class="block h-full rounded-full bg-foreground/60"
        :style="{ width: `${props.meter}%` }"
      />
    </span>
  </div>
</template>
