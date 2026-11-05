<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";
import type { LocalPageVisit } from "@/lib/local-page-history";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { formatAgo } from "./deviceState";
import PageIcon from "./PageIcon.vue";

const props = defineProps<{ visit: LocalPageVisit; now: number }>();
const emit = defineEmits<{ open: []; forget: [] }>();

const title = computed(() => {
  if (props.visit.title) return props.visit.title;
  try {
    return new URL(props.visit.url).host;
  } catch {
    return props.visit.url;
  }
});
</script>

<template>
  <div
    class="group/visit flex items-center gap-1 rounded-control pr-1.5 transition-colors duration-120 hover:bg-cladd-surface-hover"
  >
    <button
      type="button"
      data-roving-item
      class="flex min-w-0 flex-1 items-center gap-2.5 rounded-control py-1.5 pr-1 pl-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :title="`Open ${props.visit.url}`"
      @click="emit('open')"
    >
      <PageIcon :icon="props.visit.icon" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm text-foreground">{{ title }}</span>
        <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
          {{ props.visit.url }}
        </span>
      </span>
      <span class="shrink-0 text-2xs text-[var(--fg-subtle)] group-hover/visit:hidden">
        {{ formatAgo(props.now - props.visit.openedAt) }}
      </span>
    </button>
    <IconAction
      label="Remove from history"
      size="sm"
      position="top"
      class="hidden shrink-0 group-hover/visit:flex group-focus-within/visit:flex"
      @click="emit('forget')"
    >
      <X :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
