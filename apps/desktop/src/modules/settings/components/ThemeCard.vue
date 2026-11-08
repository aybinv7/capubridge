<script setup lang="ts">
import { computed } from "vue";
import type { Theme } from "@/themes/types";

/** A theme as a small picture of itself: its surfaces, its signal colours and its type. */
const props = defineProps<{ theme: Theme; active: boolean }>();

const emit = defineEmits<{ select: [id: string] }>();

const surfaces = computed(() => {
  const tokens = props.theme.tokens;
  return [tokens.bgApp, tokens.bgSurface, tokens.bgSurfaceRaised];
});

const signals = computed(() => {
  const tokens = props.theme.tokens;
  return [tokens.signalLive, tokens.signalRec, tokens.signalSelect, tokens.signalMark];
});
</script>

<template>
  <button
    type="button"
    class="group flex flex-col gap-2.5 rounded-well border bg-surface-2 p-2.5 text-left shadow-bevel transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-signal-select"
    :class="
      props.active
        ? 'border-signal-select ring-1 ring-signal-select'
        : 'border-border-subtle hover:border-border'
    "
    :aria-pressed="props.active"
    @click="emit('select', props.theme.id)"
  >
    <span class="flex h-12 overflow-hidden rounded-md" aria-hidden="true">
      <span v-for="color in surfaces" :key="color" class="flex-1" :style="{ background: color }" />
    </span>
    <span class="flex gap-1" aria-hidden="true">
      <span
        v-for="color in signals"
        :key="color"
        class="h-1.5 flex-1 rounded-full"
        :style="{ background: color }"
      />
    </span>
    <span class="flex items-baseline justify-between gap-2">
      <span
        class="truncate text-xs font-medium text-foreground"
        :style="{ fontFamily: props.theme.fonts.sans }"
        >{{ props.theme.label }}</span
      >
      <span class="shrink-0 text-2xs text-[var(--fg-subtle)]">{{
        props.theme.meta.contrastClass
      }}</span>
    </span>
  </button>
</template>
