<script setup lang="ts">
/**
 * A raised group of settings. Rows inside are separated by hairlines; `padded` is for content
 * that is not rows (theme cards, forms, code).
 */
const props = withDefaults(
  defineProps<{ title?: string; description?: string; padded?: boolean }>(),
  { title: undefined, description: undefined, padded: false },
);

defineSlots<{ default: () => unknown; aside?: () => unknown }>();
</script>

<template>
  <section class="flex flex-col gap-2" :aria-label="props.title">
    <header v-if="props.title" class="flex items-end gap-3 px-1">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 class="text-xs font-medium text-foreground">{{ props.title }}</h2>
        <p v-if="props.description" class="text-2xs text-muted-foreground">
          {{ props.description }}
        </p>
      </div>
      <slot name="aside" />
    </header>
    <div
      class="flex flex-col rounded-well border border-border-subtle bg-surface-1 shadow-bevel"
      :class="props.padded ? 'p-3.5' : 'divide-y divide-border-subtle'"
    >
      <slot />
    </div>
  </section>
</template>
