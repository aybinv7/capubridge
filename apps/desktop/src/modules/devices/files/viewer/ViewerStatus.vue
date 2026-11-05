<script setup lang="ts">
import { Spinner } from "@capubridge/cladd";

const props = defineProps<{
  title: string;
  detail?: string;
  raw?: string;
  busy?: boolean;
  alert?: boolean;
}>();
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-3 px-8 text-center"
    :role="props.alert ? 'alert' : 'status'"
    :aria-busy="props.busy || undefined"
  >
    <span
      v-if="props.busy || $slots.icon"
      class="grid size-10 place-items-center rounded-well bg-surface-0 text-[var(--fg-subtle)] shadow-bevel"
      aria-hidden="true"
    >
      <Spinner v-if="props.busy" size="sm" />
      <slot v-else name="icon" />
    </span>
    <div class="flex max-w-md flex-col gap-1">
      <p class="text-sm text-foreground">{{ props.title }}</p>
      <p v-if="props.detail" class="text-xs text-muted-foreground">{{ props.detail }}</p>
    </div>
    <p
      v-if="props.raw"
      class="max-w-lg rounded-control bg-surface-0 px-3 py-2 font-mono text-2xs break-all text-error shadow-cut"
    >
      {{ props.raw }}
    </p>
    <div v-if="$slots.default" class="mt-1 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
