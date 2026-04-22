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

function storageOrder(kind: LayoutItem["storageKind"]): number {
  switch (kind) {
    case "indexeddb":
      return 0;
    case "localforage":
      return 1;
    case "sqlite":
      return 2;
    default:
      return 3;
  }
}

export function normalizeGraphFieldName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
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

function layoutPrefix(value: string): string {
  const normalized = normalizeGraphFieldName(value);
  return normalized.slice(0, 4) || "misc";
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
      confidence:
        best.combinedRank >= 15 ? "high" : best.combinedRank >= 11 ? "medium" : "low",
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
    if (
      sourceCount >= MAX_INFERRED_EDGES_PER_NODE ||
      targetCount >= MAX_INFERRED_EDGES_PER_NODE
    ) {
      continue;
    }

    seenPairs.add(pairKey);
    nodeEdgeCounts.set(candidate.edge.source, sourceCount + 1);
    nodeEdgeCounts.set(candidate.edge.target, targetCount + 1);
    results.push(candidate.edge);
  }

  return results;
}

export function buildAutoLayoutPositions(items: LayoutItem[]): Record<string, StorageGraphPosition> {
  const sortedItems = [...items].sort((left, right) => {
    const storageDelta = storageOrder(left.storageKind) - storageOrder(right.storageKind);
    if (storageDelta !== 0) {
      return storageDelta;
    }
    const prefixDelta = layoutPrefix(left.layoutKey).localeCompare(layoutPrefix(right.layoutKey));
    if (prefixDelta !== 0) {
      return prefixDelta;
    }
    return left.layoutKey.localeCompare(right.layoutKey) || left.id.localeCompare(right.id);
  });

  const groups = new Map<string, LayoutItem[]>();
  for (const item of sortedItems) {
    const key = `${item.storageKind}:${layoutPrefix(item.layoutKey)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  const positions: Record<string, StorageGraphPosition> = {};
  const columnWidth = 360;
  const rowHeight = 220;
  const groupGapX = 56;
  const maxRowsPerMiniColumn = 4;
  const noteX = 1120;
  let xCursor = 40;

  for (const [groupKey, groupItems] of groups) {
    const [storageKind] = groupKey.split(":");
    if (storageKind === "note") {
      groupItems.forEach((item, itemIndex) => {
        positions[item.id] = {
          x: noteX,
          y: 40 + itemIndex * 220,
        };
      });
      continue;
    }

    const x = xCursor;
    const y = 40;

    for (let itemIndex = 0; itemIndex < groupItems.length; itemIndex += 1) {
      const item = groupItems[itemIndex];
      if (!item) {
        continue;
      }

      const localColumn = Math.floor(itemIndex / maxRowsPerMiniColumn);
      const localRow = itemIndex % maxRowsPerMiniColumn;

      positions[item.id] = {
        x: x + localColumn * columnWidth,
        y: y + localRow * rowHeight,
      };
    }

    const consumedColumns = Math.max(1, Math.ceil(groupItems.length / maxRowsPerMiniColumn));
    xCursor += consumedColumns * columnWidth + groupGapX;
  }

  return positions;
}
