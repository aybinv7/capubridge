<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import { Badge } from "@/components/ui/badge";
import type { StorageGraphEntityNodeData } from "@/types/storageGraph.types";

const props = defineProps<NodeProps<StorageGraphEntityNodeData>>();

const title = computed(() => props.data.annotation?.label?.trim() || props.data.title);
const accentClass = computed(() => {
  switch (props.data.storageKind) {
    case "indexeddb":
      return "border-info/20 bg-info/10 text-info";
    case "localforage":
      return "border-warning/20 bg-warning/10 text-warning";
    default:
      return "border-success/20 bg-success/10 text-success";
  }
});

const visibleFields = computed(() => props.data.fields.slice(0, 8));
</script>

<template>
  <div
    class="w-[280px] rounded-2xl border border-border/40 bg-surface-0 shadow-lg ring-1 ring-black/5"
  >
    <Handle id="target" type="target" :position="Position.Left" class="!h-3 !w-3 !border-2" />

    <div class="border-b border-border/20 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-[13px] font-semibold text-foreground">{{ title }}</p>
          <p class="truncate text-[11px] text-muted-foreground/60">{{ data.subtitle }}</p>
        </div>
        <Badge variant="outline" :class="accentClass">
          {{ data.storageKind }}
        </Badge>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/50">
        <span class="rounded-full bg-surface-2 px-2 py-0.5 font-mono">{{ data.containerLabel }}</span>
        <span v-if="data.statsLabel" class="rounded-full bg-surface-2 px-2 py-0.5 font-mono">
          {{ data.statsLabel }}
        </span>
        <span
          v-if="data.changeCount > 0"
          class="rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-destructive"
        >
          {{ data.changeCount }} changes
        </span>
      </div>
    </div>

    <div class="space-y-3 px-4 py-3">
      <div v-if="data.annotation?.note" class="rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-foreground/75">
        {{ data.annotation.note }}
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/35">Fields</span>
          <span class="text-[10px] text-muted-foreground/35">{{ data.fields.length }}</span>
        </div>

        <div class="flex max-h-32 flex-wrap gap-1 overflow-hidden">
          <span
            v-for="field in visibleFields"
            :key="field.id"
            class="rounded-full border border-border/30 bg-surface-1 px-2 py-1 text-[10px] font-mono leading-none text-foreground/75"
          >
            {{ field.name }}
          </span>
          <span
            v-if="data.fields.length > visibleFields.length"
            class="rounded-full border border-border/20 bg-surface-2 px-2 py-1 text-[10px] font-mono leading-none text-muted-foreground/50"
          >
            +{{ data.fields.length - visibleFields.length }}
          </span>
        </div>
      </div>
    </div>

    <Handle id="source" type="source" :position="Position.Right" class="!h-3 !w-3 !border-2" />
  </div>
</template>
