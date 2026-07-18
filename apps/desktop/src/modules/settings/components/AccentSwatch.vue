<script setup lang="ts">
import type { AccentRamp } from "@/themes/types";

const props = defineProps<{
  accent: AccentRamp;
  active: boolean;
}>();

defineEmits<{ select: [id: string] }>();
</script>

<template>
  <button
    type="button"
    :title="props.accent.label"
    :aria-pressed="props.active"
    class="relative size-9 rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
    :class="props.active ? 'scale-110 ring-2 ring-[var(--fg-default)]' : 'hover:scale-105'"
    :style="{ background: props.accent.steps[4] }"
    @click="$emit('select', props.accent.id)"
  />
</template>
