<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0"
  >
    <div class="min-w-0">
      <div class="text-sm text-[var(--fg-default)]">{{ label }}</div>
      <p v-if="description" class="mt-0.5 text-xs text-[var(--fg-muted)]">{{ description }}</p>
    </div>
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>
