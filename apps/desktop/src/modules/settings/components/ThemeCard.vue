<script setup lang="ts">
import type { Theme } from "@/themes/types";

const props = defineProps<{
  theme: Theme;
  active: boolean;
}>();

defineEmits<{ select: [id: string] }>();
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
      <div class="h-10 flex-1" :style="{ background: props.theme.semantics.bgApp }" />
      <div class="h-10 flex-1" :style="{ background: props.theme.semantics.bgSurface }" />
      <div class="h-10 flex-1" :style="{ background: props.theme.semantics.bgSurfaceRaised }" />
      <div class="h-10 flex-1" :style="{ background: 'var(--accent)' }" />
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-[var(--fg-default)]">{{ props.theme.label }}</span>
      <span class="text-xs text-[var(--fg-muted)]">{{ props.theme.meta.contrastClass }}</span>
    </div>
  </button>
</template>
