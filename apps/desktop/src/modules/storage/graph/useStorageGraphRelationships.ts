import { computed, type ComputedRef } from "vue";
import { buildFieldMatchRelationships } from "@/modules/storage/graph/storageGraph.utils";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphManualEdgeRecord,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";

interface RelationshipScopeInput {
  notes: Array<{ id: string }>;
  manualEdges: StorageGraphManualEdgeRecord[];
}

function makeUndirectedPairKey(leftId: string, rightId: string): string {
  return leftId.localeCompare(rightId) <= 0 ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;
}

export function useStorageGraphRelationships(
  entities: ComputedRef<StorageGraphEntityDescriptor[]>,
  persistedScope: ComputedRef<RelationshipScopeInput>,
) {
  const explicitRelationships = computed<StorageGraphRelationship[]>(() => {
    const edges: StorageGraphRelationship[] = [];

    for (const entity of entities.value) {
      for (const field of entity.fields) {
        if (!field.references?.targetNodeId) {
          continue;
        }

        edges.push({
          id: `foreign-key:${entity.id}:${field.name}:${field.references.targetNodeId}`,
          kind: field.references.relationshipKind ?? "foreign-key",
          source: entity.id,
          target: field.references.targetNodeId,
          label: field.references.targetFieldName
            ? `${field.name} -> ${field.references.targetFieldName}`
            : field.name,
          confidence: "high",
          sourceFieldName: field.name,
          targetFieldName: field.references.targetFieldName,
        });
      }
    }

    return edges;
  });

  const inferredRelationships = computed(() => {
    const explicitPairs = new Set(
      explicitRelationships.value.map((edge) => makeUndirectedPairKey(edge.source, edge.target)),
    );

    return buildFieldMatchRelationships(entities.value).filter(
      (edge) => !explicitPairs.has(makeUndirectedPairKey(edge.source, edge.target)),
    );
  });

  const manualRelationships = computed<StorageGraphRelationship[]>(() =>
    persistedScope.value.manualEdges
      .filter((edge) => {
        const knownNodeIds = new Set([
          ...entities.value.map((entity) => entity.id),
          ...persistedScope.value.notes.map((note) => note.id),
        ]);
        return knownNodeIds.has(edge.source) && knownNodeIds.has(edge.target);
      })
      .map((edge) => ({
        id: edge.id,
        kind: "manual",
        source: edge.source,
        target: edge.target,
        label: edge.label,
        confidence: "high",
        userDefined: true,
      })),
  );

  const relationships = computed<StorageGraphRelationship[]>(() => {
    const merged = new Map<string, StorageGraphRelationship>();

    for (const edge of [
      ...explicitRelationships.value,
      ...inferredRelationships.value,
      ...manualRelationships.value,
    ]) {
      const key = `${edge.kind}:${edge.source}:${edge.target}:${edge.label}`;
      if (!merged.has(key)) {
        merged.set(key, edge);
      }
    }

    return Array.from(merged.values());
  });

  const schemaRelationships = computed<StorageGraphRelationship[]>(() => [
    ...explicitRelationships.value,
    ...manualRelationships.value,
  ]);

  return {
    explicitRelationships,
    inferredRelationships,
    manualRelationships,
    relationships,
    schemaRelationships,
  };
}
