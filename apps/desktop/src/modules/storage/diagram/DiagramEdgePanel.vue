<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, Input } from "@capubridge/cladd";
import FactList from "@/shared/facts/FactList.vue";
import type { Fact } from "@/shared/facts/fact";
import type { StorageGraphRelationship } from "@/types/storageGraph.types";

/** A link between two tables: what kind it is, and its label when it is one of yours. */
const props = defineProps<{
  edge: StorageGraphRelationship;
  entityTitleById: Record<string, string>;
}>();

const emit = defineEmits<{
  save: [payload: { id: string; label: string }];
  remove: [id: string];
}>();

const KIND_WORDS: Record<StorageGraphRelationship["kind"], string> = {
  "foreign-key": "Declared foreign key",
  "logical-reference": "An *_id column whose values match the other table",
  "field-match": "Guessed from a shared field name",
  manual: "Drawn by you",
};

const label = ref("");
watch(
  () => props.edge,
  (edge) => (label.value = edge.label),
  { immediate: true },
);

const facts = computed<Fact[]>(() => [
  {
    key: "from",
    label: "From",
    value: props.entityTitleById[props.edge.source] ?? props.edge.source,
    mono: true,
  },
  {
    key: "to",
    label: "To",
    value: props.entityTitleById[props.edge.target] ?? props.edge.target,
    mono: true,
  },
  { key: "kind", label: "Kind", value: KIND_WORDS[props.edge.kind] },
  ...(props.edge.kind === "field-match"
    ? [{ key: "confidence", label: "Confidence", value: props.edge.confidence }]
    : []),
]);
const manual = computed(() => props.edge.kind === "manual");
</script>

<template>
  <div class="flex flex-col gap-3">
    <FactList title="Link" :facts="facts" />
    <form
      v-if="manual"
      class="flex flex-col gap-3"
      @submit.prevent="emit('save', { id: edge.id, label })"
    >
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-muted-foreground">Label</span>
        <Input v-model="label" size="md" placeholder="What the link means" />
      </label>
      <div class="flex items-center gap-2">
        <Button type="submit" size="sm" variant="solid-fill" color="brand">Save link</Button>
        <Button size="sm" variant="transparent" color="red" @click="emit('remove', edge.id)">
          Delete link
        </Button>
      </div>
    </form>
    <p v-else class="text-xs text-muted-foreground">
      {{ edge.label }}. Only links you draw can be renamed or deleted.
    </p>
  </div>
</template>
