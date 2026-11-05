<script setup lang="ts">
import { Surface } from "@capubridge/cladd";

const props = withDefaults(
  defineProps<{
    title: string;
    value?: string;
    valueClass?: string;
    detail?: string;
  }>(),
  { value: undefined, valueClass: "text-foreground", detail: undefined },
);
</script>

<template>
  <Surface
    as="section"
    variant="solid"
    level="+1"
    outline
    class="min-w-0 rounded-well"
    content-class-name="flex h-full flex-col gap-3 p-3.5"
    :aria-label="props.title"
  >
    <header class="flex items-start justify-between gap-3">
      <h3 class="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
        <slot name="icon" />
        {{ props.title }}
      </h3>
      <div v-if="props.value !== undefined" class="flex flex-col items-end gap-0.5 text-right">
        <span class="font-mono text-xl leading-none tabular-nums" :class="props.valueClass">
          {{ props.value }}
        </span>
        <span v-if="props.detail" class="text-2xs text-[var(--fg-subtle)] tabular-nums">
          {{ props.detail }}
        </span>
      </div>
      <slot name="aside" />
    </header>
    <slot />
  </Surface>
</template>
