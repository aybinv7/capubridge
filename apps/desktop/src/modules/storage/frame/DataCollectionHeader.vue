<script setup lang="ts">
import { Spinner } from "@capubridge/cladd";
import DataFreshness from "./DataFreshness.vue";
import type { DataProvenance } from "./dataFrame.types";

/**
 * The head of the open source or collection: its name, a quiet identity line, where the rows
 * came from and how fresh they are, then the tab's own controls.
 */
const props = defineProps<{
  title: string;
  identity?: string;
  provenance: DataProvenance;
  readAt: number | null;
  busy?: boolean;
  /** The change watcher keeps these rows current (live dot). */
  watched?: boolean;
}>();

defineSlots<{ default?: () => unknown; actions?: () => unknown }>();
</script>

<template>
  <header
    class="flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-1.5"
  >
    <div class="flex min-w-0 items-baseline gap-2">
      <h2 class="truncate text-sm font-medium text-foreground">{{ props.title }}</h2>
      <span v-if="props.identity" class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
        {{ props.identity }}
      </span>
    </div>
    <DataFreshness
      :provenance="props.provenance"
      :read-at="props.readAt"
      :watched="props.watched"
    />
    <Spinner v-if="props.busy" size="xs" aria-label="Reading again" />
    <slot />
    <span class="flex-1" />
    <div class="flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
  </header>
</template>
