<script setup lang="ts">
import { computed } from "vue";
import { SearchField, Segmented, SegmentedButton, Select, Switch } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import type { DiagramSourceFilter, DiagramStrategy } from "./useDiagramFilters";

/** Find, choose how links are drawn, and widen the diagram to the rest of the app's data. */
const search = defineModel<string>("search", { required: true });
const strategy = defineModel<DiagramStrategy>("strategy", { required: true });
const includeOther = defineModel<boolean>("includeOther", { required: true });
const sourceFilter = defineModel<DiagramSourceFilter>("sourceFilter", { required: true });

const props = defineProps<{
  origin: string;
  origins: readonly string[];
  canIncludeOther: boolean;
  nodeCount: number;
  /** What the boxes are called here: tables, stores, or both with the app's other data. */
  nodeWord: { one: string; many: string };
  linkCount: number;
}>();

const emit = defineEmits<{ setOrigin: [origin: string] }>();

const SOURCE_OPTIONS: ReadonlyArray<{ value: DiagramSourceFilter; label: string }> = [
  { value: "all", label: "Every source" },
  { value: "sqlite", label: "SQLite" },
  { value: "indexeddb", label: "IndexedDB" },
  { value: "localforage", label: "LocalForage" },
];

const sourceModel = computed({
  get: () => sourceFilter.value,
  set: (value: unknown) => {
    const found = SOURCE_OPTIONS.find((option) => option.value === value);
    if (found) sourceFilter.value = found.value;
  },
});
const sourceLabel = computed(
  () => SOURCE_OPTIONS.find((option) => option.value === sourceFilter.value)?.label ?? "",
);
const originOptions = computed(() =>
  props.origins.map((origin) => ({ value: origin, label: origin })),
);
const originModel = computed({
  get: () => props.origin,
  set: (value: unknown) => {
    if (typeof value === "string") emit("setOrigin", value);
  },
});
</script>

<template>
  <div
    class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2"
    role="toolbar"
    aria-label="Diagram"
  >
    <SearchField
      v-model="search"
      size="sm"
      class="w-56 min-w-40"
      placeholder="Find a table, field or note"
      aria-label="Find a table, field or note"
    />
    <Segmented size="xs" active-variant="solid" aria-label="Which links lay out the diagram">
      <HintTooltip text="Declared foreign keys and your links, one column per level">
        <SegmentedButton :active="strategy === 'schema'" @click="strategy = 'schema'">
          Schema
        </SegmentedButton>
      </HintTooltip>
      <HintTooltip text="Every link, guessed ones too, with tables named alike kept together">
        <SegmentedButton :active="strategy === 'inferred'" @click="strategy = 'inferred'">
          Inferred
        </SegmentedButton>
      </HintTooltip>
    </Segmented>
    <label v-if="canIncludeOther" class="flex items-center gap-2 text-xs text-foreground">
      <Switch v-model="includeOther" size="sm" aria-label="Include the app's other data" />
      Include the app's other data
    </label>
    <template v-if="includeOther && canIncludeOther">
      <Select
        v-model="sourceModel"
        :options="SOURCE_OPTIONS"
        size="sm"
        :keyboard-hints="false"
        aria-label="Which sources to show"
        class="w-auto shrink-0"
      >
        {{ sourceLabel }}
      </Select>
      <Select
        v-if="origins.length > 1"
        v-model="originModel"
        :options="originOptions"
        size="sm"
        :keyboard-hints="false"
        aria-label="Which origin's IndexedDB and LocalForage"
        class="w-auto max-w-64 shrink-0 font-mono"
      >
        {{ origin || "Choose an origin" }}
      </Select>
    </template>
    <span class="ml-auto text-2xs text-muted-foreground tabular-nums">
      {{ nodeCount }} {{ nodeCount === 1 ? nodeWord.one : nodeWord.many }} · {{ linkCount }}
      {{ linkCount === 1 ? "link" : "links" }}
    </span>
  </div>
</template>
