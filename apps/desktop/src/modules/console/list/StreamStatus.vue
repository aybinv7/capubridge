<script setup lang="ts">
import { StatusDot } from "@capubridge/cladd";
import type { StreamStatusView } from "./streamView.types";

/** `StatusDot` plus one word; live is the only state drawn in the live colour. */
const props = defineProps<{ status: StreamStatusView; tally?: string | null }>();
</script>

<template>
  <span class="flex min-w-0 shrink items-center gap-1.5 text-xs" role="status">
    <StatusDot
      :color="props.status.color"
      :variant="props.status.variant"
      :pulse="props.status.pulse"
    />
    <span class="shrink-0 text-muted-foreground">{{ props.status.word }}</span>
    <span
      v-if="props.status.detail"
      class="truncate font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
    >
      {{ props.status.detail }}
    </span>
    <span v-if="props.tally" class="shrink-0 text-2xs text-[var(--fg-subtle)] tabular-nums">
      · {{ props.tally }}
    </span>
  </span>
</template>
