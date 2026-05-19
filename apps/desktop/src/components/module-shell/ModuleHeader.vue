<script setup lang="ts">
import { RefreshCw, MoreHorizontal, HelpCircle, type LucideIcon } from "lucide-vue-next";
import type { TabScope } from "@/types/tabs.types";
import TargetChip from "./TargetChip.vue";

defineProps<{
  toolLabel: string;
  toolIcon?: LucideIcon;
  scope: TabScope;
  status?: string | null;
  /** Hide the standard refresh / overflow / help cluster. */
  hideActions?: boolean;
}>();

defineEmits<{ refresh: [] }>();
</script>

<template>
  <div class="flex w-full items-center gap-3">
    <span class="inline-flex items-center gap-2 text-sm text-[var(--fg-default)]">
      <component
        v-if="toolIcon"
        :is="toolIcon"
        :size="14"
        class="shrink-0 text-[var(--fg-muted)]"
      />
      <span class="font-medium">{{ toolLabel }}</span>
    </span>
    <span class="text-[var(--fg-subtle)]">·</span>
    <TargetChip :scope="scope" :status="status" />

    <div class="ml-auto flex items-center gap-0.5" v-if="!hideActions">
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]"
        title="Refresh"
        aria-label="Refresh"
        @click="$emit('refresh')"
      >
        <RefreshCw :size="13" />
      </button>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]"
        title="More"
        aria-label="More actions"
      >
        <MoreHorizontal :size="13" />
      </button>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]"
        title="Help"
        aria-label="Help"
      >
        <HelpCircle :size="13" />
      </button>
    </div>
  </div>
</template>
