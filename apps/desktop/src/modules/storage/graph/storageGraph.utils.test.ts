import { expect, test } from "vite-plus/test";
import {
  buildAutoLayoutPositions,
  buildFieldMatchRelationships,
  buildRelationshipClusters,
  buildSchemaLayoutPositions,
} from "./storageGraph.utils";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphField,
} from "../../../types/storageGraph.types";

function field(name: string, isPrimary = false): StorageGraphField {
  return {
    id: name,
    name,
    normalizedName: name.toLowerCase(),
    kind: "column",
    isPrimary,
  };
}

function entity(
  id: string,
  storageKind: StorageGraphEntityDescriptor["storageKind"],
  fields: StorageGraphField[],
): StorageGraphEntityDescriptor {
  return {
    id,
    storageKind,
    entityKind: storageKind === "sqlite" ? "sqlite-table" : "indexeddb-store",
    title: id,
    subtitle: "",
    containerLabel: "database",
    openPath: "",
    groupKey: `${storageKind}:database`,
    changeCount: 0,
    fields,
  };
}

test("the inferred strategy restores SQLite field-match relationships", () => {
  const relationships = buildFieldMatchRelationships([
    entity("users", "sqlite", [field("account_id", true)]),
    entity("messages", "sqlite", [field("account_id")]),
  ]);

  expect(relationships).toHaveLength(1);
  expect(relationships[0]?.kind).toBe("field-match");
});

test("the schema strategy places referenced tables before their dependants", () => {
  const positions = buildSchemaLayoutPositions(
    [
      { id: "users", groupKey: "sqlite:app.db", layoutKey: "users", storageKind: "sqlite" },
      {
        id: "messages",
        groupKey: "sqlite:app.db",
        layoutKey: "messages",
        storageKind: "sqlite",
      },
    ],
    [
      {
        id: "messages-user",
        kind: "foreign-key",
        source: "messages",
        target: "users",
        label: "user_id -> id",
        confidence: "high",
      },
    ],
  );

  expect(positions.users?.x).toBeLessThan(positions.messages?.x ?? 0);
});

test("the inferred strategy arranges cluster members as flower petals", () => {
  const positions = buildAutoLayoutPositions([
    { id: "alpha", groupKey: "sqlite:first.db", layoutKey: "alpha", storageKind: "sqlite" },
    { id: "alphabet", groupKey: "sqlite:second.db", layoutKey: "alphabet", storageKind: "sqlite" },
  ]);

  expect(positions.alpha?.x).toBeCloseTo(positions.alphabet?.x ?? 0);
  expect(positions.alpha?.y).not.toBe(positions.alphabet?.y);
});

test("the schema strategy packs standalone SQLite tables into a balanced grid", () => {
  const positions = buildSchemaLayoutPositions(
    Array.from({ length: 64 }, (_, index) => ({
      id: `table-${index}`,
      groupKey: "sqlite:app.db",
      layoutKey: `table-${index}`,
      storageKind: "sqlite" as const,
    })),
    [],
  );
  const xPositions = new Set(Object.values(positions).map((position) => position.x));
  const yPositions = new Set(Object.values(positions).map((position) => position.y));

  expect(xPositions.size).toBe(8);
  expect(yPositions.size).toBe(8);
});

test("the inferred strategy partitions oversized connected components", () => {
  const nodeIds = Array.from({ length: 25 }, (_, index) => `node-${index}`);
  const relationships = nodeIds.slice(1).map((nodeId, index) => ({
    id: `edge-${index}`,
    kind: "field-match" as const,
    source: nodeIds[index] ?? "",
    target: nodeId,
    label: "shared_id",
    confidence: "medium" as const,
  }));
  const clusters = buildRelationshipClusters(nodeIds, relationships);

  expect(clusters).toHaveLength(3);
  expect(Math.max(...clusters.map((cluster) => cluster.length))).toBe(9);
  expect(new Set(clusters.flat()).size).toBe(25);
});
