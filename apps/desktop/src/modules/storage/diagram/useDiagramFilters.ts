import { computed, ref, type Ref } from "vue";
import { refDebounced } from "@vueuse/core";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphNoteRecord,
  StorageGraphPosition,
  StorageGraphRelationship,
  StorageGraphStorageKind,
} from "@/types/storageGraph.types";

export type DiagramStrategy = "inferred" | "schema";
export type DiagramSourceFilter = "all" | StorageGraphStorageKind;

const SEARCH_DELAY_MS = 200;

interface DiagramFilterInput {
  entities: Ref<StorageGraphEntityDescriptor[]>;
  notes: Ref<readonly StorageGraphNoteRecord[]>;
  relationships: Ref<StorageGraphRelationship[]>;
  schemaRelationships: Ref<StorageGraphRelationship[]>;
  autoLayoutPositions: Ref<Record<string, StorageGraphPosition>>;
  schemaLayoutPositions: Ref<Record<string, StorageGraphPosition>>;
}

function haystack(entity: StorageGraphEntityDescriptor): string {
  return [
    entity.title,
    entity.subtitle,
    entity.containerLabel,
    entity.fields.map((field) => `${field.name} ${field.valueType ?? ""}`).join(" "),
    entity.annotation?.label ?? "",
    entity.annotation?.note ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * What the canvas shows: the search (applied after a pause in typing), the source filter, the
 * strategy that picks the links and the layout, and whether guessed links are drawn.
 */
export function useDiagramFilters(input: DiagramFilterInput, initialStrategy: DiagramStrategy) {
  const search = ref("");
  const searchApplied = refDebounced(search, SEARCH_DELAY_MS);
  const sourceFilter = ref<DiagramSourceFilter>("all");
  const strategy = ref<DiagramStrategy>(initialStrategy);
  const showGuessed = ref(true);

  const haystacks = computed(
    () => new Map(input.entities.value.map((entity) => [entity.id, haystack(entity)])),
  );

  const filteredEntities = computed(() => {
    const query = searchApplied.value.trim().toLowerCase();
    return input.entities.value.filter((entity) => {
      if (sourceFilter.value !== "all" && entity.storageKind !== sourceFilter.value) return false;
      return !query || (haystacks.value.get(entity.id) ?? "").includes(query);
    });
  });

  const visibleNodeIds = computed(() => {
    const ids = new Set(filteredEntities.value.map((entity) => entity.id));
    for (const note of input.notes.value) ids.add(note.id);
    return ids;
  });

  const activeRelationships = computed(() =>
    strategy.value === "schema" ? input.schemaRelationships.value : input.relationships.value,
  );

  const visibleRelationships = computed(() =>
    activeRelationships.value.filter(
      (relationship) =>
        (showGuessed.value || relationship.kind !== "field-match") &&
        visibleNodeIds.value.has(relationship.source) &&
        visibleNodeIds.value.has(relationship.target),
    ),
  );

  const activeAutoLayoutPositions = computed(() =>
    strategy.value === "schema"
      ? input.schemaLayoutPositions.value
      : input.autoLayoutPositions.value,
  );

  return {
    search,
    sourceFilter,
    strategy,
    showGuessed,
    filteredEntities,
    visibleRelationships,
    activeAutoLayoutPositions,
  };
}
