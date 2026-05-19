<script setup lang="ts">
import type { ModuleSubNavItem } from "./types";

defineProps<{
  items: readonly ModuleSubNavItem[];
  active: string;
}>();

defineEmits<{ change: [id: string] }>();
</script>

<template>
  <div class="flex items-center gap-1 overflow-x-auto" role="tablist">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      role="tab"
      :aria-selected="active === item.id"
      :class="[
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors duration-150',
        active === item.id
          ? 'border-[var(--border-default)] bg-[var(--bg-surface-raised)] text-[var(--fg-default)]'
          : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-default)]',
      ]"
      @click="$emit('change', item.id)"
    >
      <component
        v-if="item.icon"
        :is="item.icon"
        :size="12"
        class="shrink-0 text-[var(--fg-muted)]"
      />
      {{ item.label }}
    </button>
  </div>
</template>
