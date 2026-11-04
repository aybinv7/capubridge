<script setup lang="ts">
import { computed } from "vue";
import type { Theme } from "@/themes/types";

const props = defineProps<{
  theme: Theme;
  active: boolean;
}>();

defineEmits<{ select: [id: string] }>();

const swatches = computed(() => {
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
    class="group flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]"
    :class="
      props.active
        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
        : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--bg-surface-raised)]'
    "
    :aria-pressed="props.active"
    @click="$emit('select', props.theme.id)"
  >
    <div class="flex gap-1 overflow-hidden rounded-md">
      <div
        v-for="color in swatches"
        :key="color"
        class="h-10 flex-1"
        :style="{ background: color }"
      />
    </div>
    <div class="flex gap-1.5">
      <span
        v-for="color in signals"
        :key="color"
        class="h-2 flex-1 rounded-full"
        :style="{ background: color }"
      />
    </div>
    <div class="flex items-center justify-between">
      <span
        class="text-sm font-medium text-[var(--fg-default)]"
        :style="{ fontFamily: props.theme.fonts.sans }"
        >{{ props.theme.label }}</span
      >
      <span class="text-xs text-[var(--fg-muted)]">{{ props.theme.meta.contrastClass }}</span>
    </div>
  </button>
</template>
