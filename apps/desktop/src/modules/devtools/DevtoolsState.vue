<script setup lang="ts">
import { Spinner } from "@capubridge/cladd";

/** How a DevTools tab says it is checking, or that there is nothing for it on this page. */
const props = withDefaults(defineProps<{ title: string; text?: string; loading?: boolean }>(), {
  text: undefined,
  loading: false,
});

defineSlots<{ default?: () => unknown }>();
</script>

<template>
  <div
    role="status"
    class="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-8 py-10 text-center"
  >
    <div class="flex items-center gap-2">
      <Spinner v-if="props.loading" size="xs" />
      <p class="text-sm font-medium text-foreground">{{ props.title }}</p>
    </div>
    <p v-if="props.text" class="max-w-md text-xs leading-5 text-muted-foreground">
      {{ props.text }}
    </p>
    <div v-if="$slots.default" class="flex items-center gap-2">
      <slot />
    </div>
  </div>
</template>
