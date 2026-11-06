<script setup lang="ts">
import { Crosshair } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { StorageGraphField } from "@/types/storageGraph.types";

/** A table's fields: name, type, and whether each is a key, indexed, or links elsewhere. */
defineProps<{
  fields: readonly StorageGraphField[];
  targetTitles: Record<string, string>;
}>();

const emit = defineEmits<{ openReference: [nodeId: string] }>();

const KIND_WORDS: Record<StorageGraphField["kind"], string> = {
  "key-path": "key path",
  index: "index",
  column: "column",
  "foreign-key": "foreign key",
  "sample-field": "seen in records",
  "entry-key": "entry key",
};
</script>

<template>
  <div
    class="overflow-hidden rounded-well bg-surface-cut shadow-cut"
    role="table"
    aria-label="Fields"
  >
    <div
      class="grid grid-cols-[minmax(0,1fr)_4.5rem_2rem_3rem_3rem] items-center gap-1 border-b border-border-subtle px-2.5 py-1.5 text-2xs text-muted-foreground"
      role="row"
    >
      <span role="columnheader">Name</span>
      <span role="columnheader">Type</span>
      <span role="columnheader" class="text-center">Key</span>
      <span role="columnheader" class="text-center">Indexed</span>
      <span role="columnheader" class="text-center">Links to</span>
    </div>
    <p v-if="fields.length === 0" class="px-2.5 py-3 text-xs text-muted-foreground">
      No fields were found.
    </p>
    <div v-else class="max-h-[22rem] overflow-y-auto">
      <div
        v-for="field in fields"
        :key="field.id"
        class="grid grid-cols-[minmax(0,1fr)_4.5rem_2rem_3rem_3rem] items-center gap-1 border-t border-border-subtle px-2.5 py-1 text-xs first:border-t-0"
        role="row"
      >
        <div class="min-w-0" role="cell">
          <div class="truncate font-mono text-foreground">{{ field.name }}</div>
          <div class="truncate text-2xs text-muted-foreground">
            {{
              field.references?.targetNodeId
                ? `→ ${targetTitles[field.references.targetNodeId] ?? "another table"}${field.references.targetFieldName ? `.${field.references.targetFieldName}` : ""}`
                : KIND_WORDS[field.kind]
            }}
          </div>
        </div>
        <span class="truncate font-mono text-2xs text-muted-foreground" role="cell">
          {{ field.valueType || "—" }}
        </span>
        <span class="flex justify-center" role="cell">
          <span
            v-if="field.isPrimary"
            class="size-2 rounded-full bg-signal-mark"
            aria-label="Primary key"
          />
        </span>
        <span class="flex justify-center" role="cell">
          <span v-if="field.isIndexed" class="size-2 rounded-full bg-info" aria-label="Indexed" />
        </span>
        <span class="flex justify-center" role="cell">
          <IconAction
            v-if="field.references?.targetNodeId"
            size="sm"
            :label="`Show ${targetTitles[field.references.targetNodeId] ?? 'the linked table'}`"
            @click="emit('openReference', field.references.targetNodeId)"
          >
            <Crosshair :stroke-width="1.8" />
          </IconAction>
          <span
            v-else-if="field.isForeignKey"
            class="size-2 rounded-full bg-success"
            aria-label="Foreign key"
          />
        </span>
      </div>
    </div>
  </div>
</template>
