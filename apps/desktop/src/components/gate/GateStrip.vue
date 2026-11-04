<script setup lang="ts">
import { CircleX, TriangleAlert } from "lucide-vue-next";
import { Spinner } from "@/components/ui/spinner";
import GateActions from "@/components/gate/GateActions.vue";
import ProvenanceTag from "@/components/gate/ProvenanceTag.vue";
import { useGateActions } from "@/composables/useGateActions";
import type { GateCopy } from "@/lib/gates/types";

defineProps<{
  content: GateCopy;
  stale?: boolean;
}>();

const { run, running } = useGateActions();
</script>

<template>
  <div
    class="flex h-8 shrink-0 items-center gap-2.5 border-b border-[var(--border-subtle)] bg-surface-2 px-3 text-xs"
    :class="stale && 'prov-stale'"
    role="status"
    aria-live="polite"
  >
    <Spinner v-if="content.tone === 'waiting'" class="size-3.5 text-warning" />
    <CircleX v-else-if="content.tone === 'error'" :size="14" class="shrink-0 text-error" />
    <TriangleAlert v-else :size="14" class="shrink-0 text-warning" />
    <span class="shrink-0 font-medium text-foreground">{{ content.title }}</span>
    <span class="min-w-0 truncate text-muted-foreground">{{ content.detail }}</span>
    <span class="flex-1" />
    <ProvenanceTag v-if="stale" kind="stale" />
    <GateActions
      v-if="content.actions.length"
      :actions="content.actions"
      :running="running"
      :limit="1"
      @run="run"
    />
  </div>
</template>
