<script setup lang="ts">
import { ref } from "vue";
import { ArrowLeft, ArrowRight, TableProperties } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type {
  StorageGraphEntityNodeData,
  StorageGraphNodeAnnotation,
  StorageGraphRelatedTable,
} from "@/types/storageGraph.types";
import DiagramFieldTable from "./DiagramFieldTable.vue";
import DiagramMetadataDialog from "./DiagramMetadataDialog.vue";

/** A table or store: open its data, describe it, its fields and the tables it links to. */
defineProps<{
  data: StorageGraphEntityNodeData;
  relatedTables: readonly StorageGraphRelatedTable[];
  entityTitleById: Record<string, string>;
}>();

const emit = defineEmits<{
  open: [path: string];
  saveAnnotation: [annotation: StorageGraphNodeAnnotation];
  focusNode: [nodeId: string];
}>();

const describing = ref(false);

const LINK_WORDS: Record<StorageGraphRelatedTable["kind"], string> = {
  "foreign-key": "foreign key",
  "logical-reference": "checked in the data",
  "field-match": "guessed",
  manual: "your link",
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="data.annotation?.note" class="text-xs leading-5 text-foreground">
      {{ data.annotation.note }}
    </p>
    <div class="flex items-center gap-2">
      <Button size="sm" variant="solid" @click="emit('open', data.openPath)">
        <TableProperties :size="14" :stroke-width="1.8" />
        Open data
      </Button>
      <Button size="sm" variant="transparent" @click="describing = true">Describe…</Button>
    </div>

    <section class="flex flex-col gap-1.5">
      <h3 class="text-2xs text-muted-foreground">Fields · {{ data.fields.length }}</h3>
      <DiagramFieldTable
        :fields="data.fields"
        :target-titles="entityTitleById"
        @open-reference="emit('focusNode', $event)"
      />
    </section>

    <section v-if="relatedTables.length > 0" class="flex flex-col gap-1.5">
      <h3 class="text-2xs text-muted-foreground">Linked · {{ relatedTables.length }}</h3>
      <ul class="flex flex-col gap-px">
        <li v-for="relation in relatedTables" :key="relation.relationshipId">
          <button
            type="button"
            class="flex w-full flex-col gap-0.5 rounded-inner px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-signal-select"
            @click="emit('focusNode', relation.nodeId)"
          >
            <span class="flex items-center gap-1.5 text-xs text-foreground">
              <component
                :is="relation.direction === 'outgoing' ? ArrowRight : ArrowLeft"
                :size="12"
                class="shrink-0 text-muted-foreground"
                :aria-label="relation.direction === 'outgoing' ? 'Links to' : 'Linked from'"
              />
              <span class="truncate">{{ relation.title }}</span>
              <span class="ml-auto shrink-0 text-2xs text-muted-foreground">
                {{ LINK_WORDS[relation.kind] }}
              </span>
            </span>
            <span
              v-if="relation.sourceFieldName || relation.targetFieldName"
              class="truncate pl-[18px] font-mono text-2xs text-muted-foreground"
            >
              {{ relation.sourceFieldName || "table" }} → {{ relation.targetFieldName || "table" }}
            </span>
          </button>
        </li>
      </ul>
    </section>

    <DiagramMetadataDialog
      v-model:open="describing"
      :title="data.title"
      :annotation="data.annotation"
      @save="emit('saveAnnotation', $event)"
    />
  </div>
</template>
