<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <section>
    <header class="mb-3">
      <h2 class="text-sm font-medium text-[var(--fg-default)]">{{ title }}</h2>
      <p v-if="description" class="text-xs text-[var(--fg-muted)]">{{ description }}</p>
    </header>
    <div class="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
      <slot />
    </div>
  </section>
</template>
