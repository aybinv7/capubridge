<script setup lang="ts">
import type { StorageGraphField } from "@/types/storageGraph.types";

defineProps<{
  fields: StorageGraphField[];
}>();
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-border/25 bg-surface-0">
    <div
      class="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem_2.5rem_2.5rem] items-center gap-1 border-b border-border/20 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/40"
    >
      <span>Name</span>
      <span class="text-center">Type</span>
      <span class="text-center">PK</span>
      <span class="text-center">IX</span>
      <span class="text-center">FK</span>
    </div>

    <div v-if="fields.length === 0" class="px-3 py-4 text-xs text-muted-foreground/40">
      No fields discovered.
    </div>

    <div v-else>
      <div
        v-for="field in fields"
        :key="field.id"
        class="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem_2.5rem_2.5rem] items-center gap-1 border-t border-border/15 px-3 py-2 text-xs first:border-t-0"
      >
        <div class="min-w-0">
          <div class="truncate font-mono text-foreground/85">{{ field.name }}</div>
          <div
            v-if="field.references?.targetNodeId"
            class="truncate pt-0.5 text-[10px] text-muted-foreground/45"
          >
            {{ field.references.targetFieldName || "linked" }}
          </div>
          <div
            v-else
            class="truncate pt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/35"
          >
            {{ field.kind }}
          </div>
        </div>

        <span class="text-center text-[11px] text-muted-foreground/70">
          {{ field.valueType || "field" }}
        </span>

        <div class="flex justify-center">
          <span
            v-if="field.isPrimary"
            class="h-2.5 w-2.5 rounded-full bg-warning"
          />
        </div>

        <div class="flex justify-center">
          <span
            v-if="field.isIndexed"
            class="h-2.5 w-2.5 rounded-full bg-info"
          />
        </div>

        <div class="flex justify-center">
          <span
            v-if="field.isForeignKey || field.references"
            class="h-2.5 w-2.5 rounded-full bg-success"
          />
        </div>
      </div>
    </div>
  </div>
</template>
