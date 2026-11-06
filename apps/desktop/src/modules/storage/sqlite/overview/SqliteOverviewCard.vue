<script setup lang="ts">
/** One dashboard card: a quiet title, an optional note on the right, and its content. */
const props = defineProps<{ title: string; note?: string | null }>();

defineSlots<{ default: () => unknown; aside?: () => unknown }>();
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3 rounded-well border border-border-subtle bg-surface-1 p-3.5 shadow-bevel"
    :aria-label="props.title"
  >
    <header class="flex items-baseline justify-between gap-2">
      <h3 class="text-xs font-medium text-foreground">{{ props.title }}</h3>
      <slot name="aside">
        <span v-if="props.note" class="text-2xs text-[var(--fg-subtle)]">{{ props.note }}</span>
      </slot>
    </header>
    <slot />
  </section>
</template>
