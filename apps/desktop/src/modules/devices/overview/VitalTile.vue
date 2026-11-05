<script setup lang="ts">
import { Surface } from "@capubridge/cladd";
import Sparkline from "../shared/Sparkline.vue";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    valueClass?: string;
    detail?: string;
    values: readonly (number | null)[];
    domain?: readonly [number, number];
    live: boolean;
    tone?: "device" | "network";
  }>(),
  { valueClass: "text-foreground", detail: undefined, domain: undefined, tone: "device" },
);

const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <Surface
    as="button"
    type="button"
    variant="solid"
    level="+1"
    outline
    hoverable
    clickable
    class="min-w-0 rounded-well text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
    content-class-name="flex flex-col gap-2 p-3"
    :aria-label="`${props.label} ${props.value}. Open Performance`"
    @click="emit('open')"
  >
    <span class="flex items-baseline justify-between gap-2">
      <span class="text-xs text-muted-foreground">{{ props.label }}</span>
      <span class="truncate text-2xs text-[var(--fg-subtle)] tabular-nums">{{ props.detail }}</span>
    </span>
    <span class="font-mono text-2xl leading-none tabular-nums" :class="props.valueClass">
      {{ props.value }}
    </span>
    <Sparkline
      :values="props.values"
      :domain="props.domain"
      :live="props.live"
      class="h-8"
      :class="props.tone === 'network' ? 'text-cat-network' : 'text-cat-device'"
    />
  </Surface>
</template>
