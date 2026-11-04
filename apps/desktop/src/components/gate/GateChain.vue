<script setup lang="ts">
import type { ChainLink, ChainLinkState } from "@/lib/gates/types";

defineProps<{ links: readonly ChainLink[] }>();

const MARK: Record<ChainLinkState, string> = {
  ok: "rounded-full bg-success",
  pending: "rounded-full ring-1 ring-inset ring-warning",
  broken: "rounded-none bg-error",
  idle: "rounded-full ring-1 ring-inset ring-[var(--border-strong)]",
};

const VALUE: Record<ChainLinkState, string> = {
  ok: "text-foreground",
  pending: "text-warning",
  broken: "text-error",
  idle: "text-[var(--fg-subtle)]",
};
</script>

<template>
  <ol
    class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-surface-cut px-2.5 py-1.5 font-mono text-2xs shadow-cut"
    aria-label="Connection chain"
  >
    <li
      v-for="(link, index) in links"
      :key="link.key"
      class="flex min-w-0 items-center gap-2"
      :data-state="link.state"
    >
      <span v-if="index > 0" class="text-[var(--fg-subtle)]" aria-hidden="true">›</span>
      <span class="size-1.5 shrink-0" :class="MARK[link.state]" aria-hidden="true" />
      <span class="text-muted-foreground">{{ link.label }}</span>
      <span class="max-w-48 truncate" :class="VALUE[link.state]">{{ link.value }}</span>
      <span class="sr-only">({{ link.state }})</span>
    </li>
  </ol>
</template>
