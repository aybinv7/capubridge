import type {
  StorageGraphEntityDescriptor,
  StorageGraphField,
  StorageGraphPosition,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";

const MIN_FIELD_NAME_LENGTH = 3;
const MAX_FIELD_POPULARITY = 8;
const MAX_INFERRED_EDGES = 180;
const MAX_INFERRED_EDGES_PER_NODE = 6;
const MAX_FIELDS_PER_EDGE = 3;
const IGNORED_FIELD_NAMES = new Set([
  "id",
  "key",
  "keys",
  "value",
  "values",
  "data",
  "type",
  "name",
  "title",
  "label",
  "status",
  "count",
  "total",
  "items",
  "item",
  "index",
  "order",
  "sort",
  "path",
  "url",
  "uri",
  "code",
  "body",
  "payload",
  "metadata",
  "createdat",
  "updatedat",
  "deletedat",
  "timestamp",
]);

interface LayoutItem {
  id: string;
  groupKey: string;
  layoutKey: string;
  storageKind: StorageGraphEntityDescriptor["storageKind"] | "note";
}

interface SharedFieldMatch {
  name: string;
  displayName: string;
  popularity: number;
  leftRank: number;
  rightRank: number;
  combinedRank: number;
  source: string;
  target: string;
}

export function normalizeGraphFieldName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function dedupeGraphFields(fields: StorageGraphField[]): StorageGraphField[] {
  const seen = new Set<string>();
  const result: StorageGraphField[] = [];

  for (const field of fields) {
    const key = `${field.normalizedName}:${field.kind}:${field.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(field);
  }

  return result;
}

function isLikelyPrimary(field: StorageGraphField): boolean {
  return Boolean(field.isPrimary) || field.kind === "key-path" || field.kind === "entry-key";
}

function fieldRank(field: StorageGraphField, popularity: number): number {
  let score = 0;

  if (field.isForeignKey || field.kind === "foreign-key") {
    score += 7;
  }

  if (isLikelyPrimary(field)) {
    score += 6;
  }

  if (field.isIndexed) {
    score += 3;
  }

  if (field.kind === "column" || field.kind === "index" || field.kind === "key-path") {
    score += 2;
  }

  if (popularity <= 3) {
    score += 4;
  } else if (popularity <= 5) {
    score += 2;
  } else {
    score += 1;
  }

  return score;
}

function buildFieldPopularity(entities: StorageGraphEntityDescriptor[]): Map<string, number> {
  const popularity = new Map<string, number>();

  for (const entity of entities) {
    const uniqueNames = new Set(entity.fields.map((field) => field.normalizedName).filter(Boolean));
    for (const name of uniqueNames) {
      popularity.set(name, (popularity.get(name) ?? 0) + 1);
    }
  }

  return popularity;
}

function buildFieldBuckets(fields: StorageGraphField[]): Map<string, StorageGraphField[]> {
  const buckets = new Map<string, StorageGraphField[]>();

  for (const field of fields) {
    if (!field.normalizedName) {
      continue;
    }

    const bucket = buckets.get(field.normalizedName) ?? [];
    bucket.push(field);
    buckets.set(field.normalizedName, bucket);
  }

  return buckets;
}

function shouldIgnoreFieldName(name: string, popularity: number): boolean {
  return (
    name.length < MIN_FIELD_NAME_LENGTH ||
    popularity < 2 ||
    popularity > MAX_FIELD_POPULARITY ||
    IGNORED_FIELD_NAMES.has(name)
  );
}

function undirectedPairKey(leftId: string, rightId: string): string {
  return leftId.localeCompare(rightId) <= 0 ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;
}

function buildPairRelationship(
  source: StorageGraphEntityDescriptor,
  target: StorageGraphEntityDescriptor,
  sourceBuckets: Map<string, StorageGraphField[]>,
  targetBuckets: Map<string, StorageGraphField[]>,
  popularity: Map<string, number>,
): { edge: StorageGraphRelationship; score: number } | null {
  const sharedFields: SharedFieldMatch[] = [];

  for (const [fieldName, sourceFields] of sourceBuckets) {
    const targetFields = targetBuckets.get(fieldName);
    if (!targetFields) {
      continue;
    }

    const fieldPopularity = popularity.get(fieldName) ?? 0;
    if (shouldIgnoreFieldName(fieldName, fieldPopularity)) {
      continue;
    }

    const displayName = [...sourceFields, ...targetFields]
      .map((field) => field.name)
      .sort((left, right) => left.length - right.length || left.localeCompare(right))[0];
    const leftRank = Math.max(...sourceFields.map((field) => fieldRank(field, fieldPopularity)));
    const rightRank = Math.max(...targetFields.map((field) => fieldRank(field, fieldPopularity)));
    const sourceId = leftRank > rightRank ? target.id : source.id;
    const targetId = leftRank > rightRank ? source.id : target.id;

    sharedFields.push({
      name: fieldName,
      displayName: displayName ?? fieldName,
      popularity: fieldPopularity,
      leftRank,
      rightRank,
      combinedRank: leftRank + rightRank,
      source: sourceId,
      target: targetId,
    });
  }

  if (sharedFields.length === 0) {
    return null;
  }

  sharedFields.sort((left, right) => {
    if (right.combinedRank !== left.combinedRank) {
      return right.combinedRank - left.combinedRank;
    }

    if (left.popularity !== right.popularity) {
      return left.popularity - right.popularity;
    }

    return left.name.localeCompare(right.name);
  });

  const best = sharedFields[0];
  if (!best || best.combinedRank < 8) {
    return null;
  }

  const topFields = sharedFields.slice(0, MAX_FIELDS_PER_EDGE).map((field) => field.displayName);
  const label =
    sharedFields.length > MAX_FIELDS_PER_EDGE
      ? `${topFields.join(", ")} +${sharedFields.length - MAX_FIELDS_PER_EDGE}`
      : topFields.join(", ");

  return {
    edge: {
      id: `field-match:${best.source}->${best.target}:${best.name}`,
      kind: "field-match",
      source: best.source,
      target: best.target,
      label,
      confidence: best.combinedRank >= 15 ? "high" : best.combinedRank >= 11 ? "medium" : "low",
      sourceFieldName: best.displayName,
      targetFieldName: best.displayName,
    },
    score: sharedFields.slice(0, 3).reduce((total, field) => total + field.combinedRank, 0),
  };
}

export function buildFieldMatchRelationships(
  entities: StorageGraphEntityDescriptor[],
): StorageGraphRelationship[] {
  const popularity = buildFieldPopularity(entities);
  const bucketsByEntityId = new Map(
    entities.map((entity) => [entity.id, buildFieldBuckets(entity.fields)]),
  );
  const pairCandidates: Array<{ edge: StorageGraphRelationship; score: number }> = [];

  for (let index = 0; index < entities.length; index += 1) {
    const source = entities[index];
    const sourceBuckets = bucketsByEntityId.get(source.id);
    if (!sourceBuckets) {
      continue;
    }

    for (let otherIndex = index + 1; otherIndex < entities.length; otherIndex += 1) {
      const target = entities[otherIndex];
      const targetBuckets = bucketsByEntityId.get(target.id);
      if (!targetBuckets) {
        continue;
      }

      const candidate = buildPairRelationship(
        source,
        target,
        sourceBuckets,
        targetBuckets,
        popularity,
      );
      if (candidate) {
        pairCandidates.push(candidate);
      }
    }
  }

  pairCandidates.sort((left, right) => right.score - left.score);

  const results: StorageGraphRelationship[] = [];
  const nodeEdgeCounts = new Map<string, number>();
  const seenPairs = new Set<string>();

  for (const candidate of pairCandidates) {
    if (results.length >= MAX_INFERRED_EDGES) {
      break;
    }

    const pairKey = undirectedPairKey(candidate.edge.source, candidate.edge.target);
    if (seenPairs.has(pairKey)) {
      continue;
    }

    const sourceCount = nodeEdgeCounts.get(candidate.edge.source) ?? 0;
    const targetCount = nodeEdgeCounts.get(candidate.edge.target) ?? 0;
    if (sourceCount >= MAX_INFERRED_EDGES_PER_NODE || targetCount >= MAX_INFERRED_EDGES_PER_NODE) {
      continue;
    }

    seenPairs.add(pairKey);
    nodeEdgeCounts.set(candidate.edge.source, sourceCount + 1);
    nodeEdgeCounts.set(candidate.edge.target, targetCount + 1);
    results.push(candidate.edge);
  }

  return results;
}

export function buildAutoLayoutPositions(
  items: LayoutItem[],
  relationships: StorageGraphRelationship[] = [],
): Record<string, StorageGraphPosition> {
  const positions: Record<string, StorageGraphPosition> = {};
  const entityItems = items.filter((item) => item.storageKind !== "note");
  const itemById = new Map(entityItems.map((item) => [item.id, item]));
  const clusters = buildRelationshipClusters(
    entityItems.map((item) => item.id),
    relationships,
  );
  const petalDistance = 440;
  const maxClusterRing = Math.max(
    1,
    ...clusters.map((cluster) => Math.ceil((Math.sqrt(cluster.length) - 1) / 2)),
  );
  const clusterDiameter = maxClusterRing * petalDistance * 2 + 620;
  const orbitRadius = Math.max(1400, (clusters.length * clusterDiameter) / (2 * Math.PI));

  clusters.forEach((cluster, clusterIndex) => {
    const clusterAngle = (clusterIndex / Math.max(1, clusters.length)) * Math.PI * 2 - Math.PI / 2;
    const centerX = Math.cos(clusterAngle) * orbitRadius;
    const centerY = Math.sin(clusterAngle) * orbitRadius;
    const sortedIds = [...cluster].sort((left, right) => {
      const leftItem = itemById.get(left);
      const rightItem = itemById.get(right);
      return (leftItem?.layoutKey ?? left).localeCompare(rightItem?.layoutKey ?? right);
    });

    sortedIds.forEach((id, index) => {
      if (index === 0) {
        positions[id] = { x: centerX, y: centerY };
        return;
      }
      const ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
      const previousCapacity = ring === 1 ? 1 : (ring * 2 - 1) ** 2;
      const ringIndex = index - previousCapacity;
      const ringCapacity = Math.max(8, ring * 8);
      const angle = (ringIndex / ringCapacity) * Math.PI * 2 - Math.PI / 2;
      const radius = ring * petalDistance;
      positions[id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
  });

  items
    .filter((item) => item.storageKind === "note")
    .forEach((item, index) => {
      positions[item.id] = { x: orbitRadius + 900, y: index * 240 };
    });

  return positions;
}

export function buildRelationshipClusters(
  nodeIds: string[],
  relationships: StorageGraphRelationship[],
  maxClusterSize = 9,
): string[][] {
  const knownIds = new Set(nodeIds);
  const adjacency = new Map(nodeIds.map((id) => [id, new Set<string>()]));
  for (const relationship of relationships) {
    if (!knownIds.has(relationship.source) || !knownIds.has(relationship.target)) {
      continue;
    }
    adjacency.get(relationship.source)?.add(relationship.target);
    adjacency.get(relationship.target)?.add(relationship.source);
  }

  const visited = new Set<string>();
  const connected: string[][] = [];
  const isolated: string[] = [];
  for (const id of [...nodeIds].sort()) {
    if (visited.has(id)) {
      continue;
    }
    if ((adjacency.get(id)?.size ?? 0) === 0) {
      visited.add(id);
      isolated.push(id);
      continue;
    }
    const cluster: string[] = [];
    const pending = [id];
    visited.add(id);
    while (pending.length > 0) {
      const current = pending.shift();
      if (!current) {
        continue;
      }
      cluster.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    const remaining = new Set(cluster);
    while (remaining.size > 0) {
      const seed = Array.from(remaining).sort(
        (left, right) =>
          Array.from(adjacency.get(right) ?? []).filter((id) => remaining.has(id)).length -
            Array.from(adjacency.get(left) ?? []).filter((id) => remaining.has(id)).length ||
          left.localeCompare(right),
      )[0];
      if (!seed) {
        break;
      }
      const community: string[] = [];
      const communityQueue = [seed];
      const queued = new Set([seed]);
      while (communityQueue.length > 0 && community.length < maxClusterSize) {
        const current = communityQueue.shift();
        if (!current || !remaining.has(current)) {
          continue;
        }
        remaining.delete(current);
        community.push(current);
        const neighbors = Array.from(adjacency.get(current) ?? [])
          .filter((neighbor) => remaining.has(neighbor) && !queued.has(neighbor))
          .sort(
            (left, right) =>
              (adjacency.get(right)?.size ?? 0) - (adjacency.get(left)?.size ?? 0) ||
              left.localeCompare(right),
          );
        for (const neighbor of neighbors) {
          queued.add(neighbor);
          communityQueue.push(neighbor);
        }
      }
      connected.push(community);
    }
  }

  for (let index = 0; index < isolated.length; index += maxClusterSize) {
    connected.push(isolated.slice(index, index + maxClusterSize));
  }
  return connected.sort(
    (left, right) => right.length - left.length || left[0]?.localeCompare(right[0] ?? "") || 0,
  );
}

export function buildSchemaLayoutPositions(
  items: LayoutItem[],
  relationships: StorageGraphRelationship[],
): Record<string, StorageGraphPosition> {
  const positions: Record<string, StorageGraphPosition> = {};
  const groups = new Map<string, LayoutItem[]>();
  const columnWidth = 360;
  const rowHeight = 220;
  const groupGap = 72;
  let xCursor = 40;

  for (const item of items) {
    const group = groups.get(item.groupKey) ?? [];
    group.push(item);
    groups.set(item.groupKey, group);
  }

  for (const groupItems of groups.values()) {
    const ids = new Set(groupItems.map((item) => item.id));
    const schemaEdges = relationships.filter(
      (relationship) =>
        (relationship.kind === "foreign-key" || relationship.kind === "logical-reference") &&
        ids.has(relationship.source) &&
        ids.has(relationship.target),
    );
    const parents = new Map(groupItems.map((item) => [item.id, new Set<string>()]));
    const children = new Map(groupItems.map((item) => [item.id, new Set<string>()]));
    for (const relationship of schemaEdges) {
      parents.get(relationship.source)?.add(relationship.target);
      children.get(relationship.target)?.add(relationship.source);
    }

    const remainingParents = new Map(
      groupItems.map((item) => [item.id, parents.get(item.id)?.size ?? 0]),
    );
    const ranks = new Map(groupItems.map((item) => [item.id, 0]));
    const queue = groupItems
      .filter((item) => (remainingParents.get(item.id) ?? 0) === 0)
      .map((item) => item.id);
    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId) {
        continue;
      }
      for (const childId of children.get(parentId) ?? []) {
        ranks.set(childId, Math.max(ranks.get(childId) ?? 0, (ranks.get(parentId) ?? 0) + 1));
        const remaining = Math.max(0, (remainingParents.get(childId) ?? 0) - 1);
        remainingParents.set(childId, remaining);
        if (remaining === 0) {
          queue.push(childId);
        }
      }
    }

    const rankedItems = groupItems.filter(
      (item) => (parents.get(item.id)?.size ?? 0) > 0 || (children.get(item.id)?.size ?? 0) > 0,
    );
    const isolatedItems = groupItems.filter(
      (item) => (parents.get(item.id)?.size ?? 0) === 0 && (children.get(item.id)?.size ?? 0) === 0,
    );
    const rankRows = new Map<number, number>();
    let maxRank = 0;
    for (const item of rankedItems.sort((left, right) =>
      left.layoutKey.localeCompare(right.layoutKey),
    )) {
      const rank = ranks.get(item.id) ?? 0;
      const row = rankRows.get(rank) ?? 0;
      positions[item.id] = { x: xCursor + rank * columnWidth, y: 40 + row * rowHeight };
      rankRows.set(rank, row + 1);
      maxRank = Math.max(maxRank, rank);
    }

    const rankedHeight = Math.max(0, ...rankRows.values()) * rowHeight;
    const isolatedColumns = Math.max(1, Math.ceil(Math.sqrt(isolatedItems.length)));
    isolatedItems.forEach((item, index) => {
      positions[item.id] = {
        x: xCursor + (index % isolatedColumns) * columnWidth,
        y: 40 + rankedHeight + groupGap + Math.floor(index / isolatedColumns) * rowHeight,
      };
    });
    const consumedColumns = Math.max(maxRank + 1, isolatedColumns);
    xCursor += consumedColumns * columnWidth + groupGap;
  }

  return positions;
}
