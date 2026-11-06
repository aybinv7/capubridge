import type { StorageGraphRelationship } from "@/types/storageGraph.types";

export interface StorageGraphElkNode {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface StorageGraphNamingFamily {
  key: string;
  anchorId: string;
  memberIds: string[];
}

/** Tables sharing a first name part (three or more), each family anchored on its best-linked table. */
export function buildStorageGraphNamingFamilies(
  nodes: StorageGraphElkNode[],
  relationships: StorageGraphRelationship[],
): StorageGraphNamingFamily[] {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const relationship of relationships) {
    degree.set(relationship.source, (degree.get(relationship.source) ?? 0) + 1);
    degree.set(relationship.target, (degree.get(relationship.target) ?? 0) + 1);
  }
  const tokenized = nodes.map((node) => ({
    node,
    tokens: node.name.toLowerCase().split("_").filter(Boolean),
  }));
  const firstTokenGroups = new Map<string, typeof tokenized>();
  for (const item of tokenized) {
    const prefix = item.tokens[0];
    if (!prefix) {
      continue;
    }
    const group = firstTokenGroups.get(prefix) ?? [];
    group.push(item);
    firstTokenGroups.set(prefix, group);
  }
  const candidateGroups: Array<{ key: string; items: typeof tokenized }> = [];
  for (const [prefix, items] of firstTokenGroups) {
    if (items.length >= 3) {
      candidateGroups.push({ key: prefix, items });
      continue;
    }
  }

  return candidateGroups.map(({ key, items }) => {
    const anchor = [...items].sort((left, right) => {
      const leftExact = left.node.name.toLowerCase() === key ? 1 : 0;
      const rightExact = right.node.name.toLowerCase() === key ? 1 : 0;
      return (
        rightExact - leftExact ||
        (degree.get(right.node.id) ?? 0) - (degree.get(left.node.id) ?? 0) ||
        left.tokens.length - right.tokens.length ||
        left.node.name.localeCompare(right.node.name)
      );
    })[0];
    return {
      key,
      anchorId: anchor?.node.id ?? items[0]?.node.id ?? "",
      memberIds: items.map((item) => item.node.id),
    };
  });
}
