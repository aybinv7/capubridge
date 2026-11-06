<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import { Chip } from "@capubridge/cladd";
import type { StorageGraphEntityNodeData } from "@/types/storageGraph.types";

const props = defineProps<NodeProps<StorageGraphEntityNodeData>>();

const KIND_WORDS: Record<StorageGraphEntityNodeData["storageKind"], string> = {
  indexeddb: "IndexedDB",
  localforage: "LocalForage",
  sqlite: "SQLite",
};

const title = computed(() => props.data.annotation?.label?.trim() || props.data.title);
const visibleFields = computed(() => props.data.fields.slice(0, 8));
const hiddenFields = computed(() => props.data.fields.length - visibleFields.value.length);
</script>

<template>
  <div
    class="w-[280px] rounded-well bg-surface-0 shadow-bevel ring-1 ring-border-subtle"
    :class="selected ? 'ring-2 ring-signal-select' : ''"
  >
    <Handle id="target" type="target" :position="Position.Left" class="!h-3 !w-3 !border-2" />

    <div class="border-b border-border-subtle px-3.5 py-2.5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-foreground">{{ title }}</p>
          <p
            v-if="data.storageKind !== 'sqlite'"
            class="truncate font-mono text-2xs text-muted-foreground"
          >
            {{ data.subtitle }}
          </p>
        </div>
        <Chip size="xs">{{ KIND_WORDS[data.storageKind] }}</Chip>
      </div>
      <div
        class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground"
      >
        <span v-if="data.statsLabel" class="font-mono tabular-nums">{{ data.statsLabel }}</span>
        <span v-if="data.changeCount > 0" class="flex items-center gap-1 text-warning">
          <span class="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          {{ data.changeCount }} {{ data.changeCount === 1 ? "change" : "changes" }}
        </span>
      </div>
    </div>

    <div class="space-y-2 px-3.5 py-2.5">
      <p
        v-if="data.annotation?.note"
        class="rounded-inner bg-surface-cut px-2.5 py-1.5 text-2xs text-foreground shadow-cut"
      >
        {{ data.annotation.note }}
      </p>
      <div class="flex max-h-32 flex-wrap gap-1 overflow-hidden">
        <span
          v-for="field in visibleFields"
          :key="field.id"
          class="rounded-inner bg-surface-2 px-1.5 py-0.5 font-mono text-2xs leading-4 text-foreground"
          :class="field.isPrimary ? 'font-medium' : ''"
        >
          {{ field.name }}
        </span>
        <span
          v-if="hiddenFields > 0"
          class="px-1.5 py-0.5 font-mono text-2xs leading-4 text-muted-foreground"
        >
          +{{ hiddenFields }}
        </span>
      </div>
    </div>

    <Handle id="source" type="source" :position="Position.Right" class="!h-3 !w-3 !border-2" />
  </div>
</template>
