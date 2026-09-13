import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useSQLite } from "@/composables/useSQLite";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import {
  buildAutoLayoutPositions,
  buildSchemaLayoutPositions,
} from "@/modules/storage/graph/storageGraph.utils";
import { makeGraphId } from "@/modules/storage/graph/storageGraphEntityBuilders";
import { useStorageGraphQueries } from "@/modules/storage/graph/useStorageGraphQueries";
import { useStorageGraphRelationships } from "@/modules/storage/graph/useStorageGraphRelationships";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphNodeAnnotation,
  StorageGraphPosition,
} from "@/types/storageGraph.types";

function emptyScopeState() {
  return {
    positions: {} as Record<string, StorageGraphPosition>,
    notes: [],
    manualEdges: [],
    annotations: {} as Record<string, StorageGraphNodeAnnotation>,
  };
}

export function useStorageGraphData() {
  const { getClient } = useCDP();
  const {
    listDatabases,
    openDatabase,
    tableColumns,
    tableIndexes,
    tableForeignKeys,
    executeQuery,
  } = useSQLite();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const storageContextStore = useStorageContextStore();
  const changesStore = useIndexedDBChangesStore();
  const graphStore = useStorageGraphStore();

  const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");
  const targetId = computed(() => targetsStore.cdpTargetId);
  const selectedTarget = computed(() => targetsStore.selectedTarget);
  const selectedOrigin = computed(() => storageContextStore.getSelectedOrigin(targetId.value));
  const availableOriginsQuery = useQuery({
    queryKey: computed(() => ["storage-graph-origins", targetId.value]),
    enabled: computed(() => Boolean(targetId.value)),
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) {
        return [] as string[];
      }

      const domain = new IDBDomain(client);
      const databases = await domain.discoverDatabases();
      return Array.from(new Set(databases.map((database) => database.origin))).sort((left, right) =>
        left.localeCompare(right),
      );
    },
  });
  const selectedPackageName = computed(() => {
    const target = selectedTarget.value;
    if (!target || target.source !== "adb") {
      return "";
    }
    if (target.deviceSerial !== serial.value) {
      return "";
    }
    return target.packageName?.trim() ?? "";
  });

  const scopeKey = computed(() =>
    [
      "storage-graph",
      serial.value || "no-serial",
      targetId.value || "no-target",
      selectedOrigin.value || "no-origin",
      selectedPackageName.value || "no-package",
    ].join(":"),
  );

  const { indexedDbQuery, localForageQuery, sqliteQuery } = useStorageGraphQueries({
    getClient,
    sqlite: {
      listDatabases,
      openDatabase,
      tableColumns,
      tableIndexes,
      tableForeignKeys,
      executeQuery,
    },
    targetId,
    selectedOrigin,
    serial,
    selectedPackageName,
  });

  const indexedDbChangeCounts = computed(() => {
    const counts: Record<string, number> = {};

    for (const change of changesStore.changes) {
      if (change.kind !== "record" || !change.databaseName || !change.objectStoreName) {
        continue;
      }

      const nodeId = makeGraphId("idb", change.origin, change.databaseName, change.objectStoreName);
      counts[nodeId] = (counts[nodeId] ?? 0) + 1;
    }

    return counts;
  });

  const baseEntities = computed(() => [
    ...(indexedDbQuery.data.value ?? []),
    ...(localForageQuery.data.value ?? []),
    ...(sqliteQuery.data.value ?? []),
  ]);

  const entities = computed<StorageGraphEntityDescriptor[]>(() =>
    baseEntities.value.map((entity) => ({
      ...entity,
      changeCount:
        entity.storageKind === "indexeddb" ? (indexedDbChangeCounts.value[entity.id] ?? 0) : 0,
      annotation: graphStore.getNodeAnnotation(scopeKey.value, entity.id),
    })),
  );

  const persistedScope = computed(() => graphStore.scopes[scopeKey.value] ?? emptyScopeState());

  const { relationships, schemaRelationships } = useStorageGraphRelationships(
    entities,
    persistedScope,
  );

  const autoLayoutPositions = computed(() =>
    buildAutoLayoutPositions(
      [
        ...entities.value.map((entity) => ({
          id: entity.id,
          groupKey: entity.groupKey,
          layoutKey: entity.title,
          storageKind: entity.storageKind,
        })),
        ...persistedScope.value.notes.map((note) => ({
          id: note.id,
          groupKey: "notes",
          layoutKey: note.title,
          storageKind: "note" as const,
        })),
      ],
      relationships.value,
    ),
  );

  const schemaLayoutPositions = computed(() =>
    buildSchemaLayoutPositions(
      [
        ...entities.value.map((entity) => ({
          id: entity.id,
          groupKey: entity.groupKey,
          layoutKey: entity.title,
          storageKind: entity.storageKind,
        })),
        ...persistedScope.value.notes.map((note) => ({
          id: note.id,
          groupKey: "notes",
          layoutKey: note.title,
          storageKind: "note" as const,
        })),
      ],
      schemaRelationships.value,
    ),
  );

  const isLoading = computed(
    () =>
      indexedDbQuery.isLoading.value ||
      indexedDbQuery.isFetching.value ||
      localForageQuery.isLoading.value ||
      localForageQuery.isFetching.value ||
      sqliteQuery.isLoading.value ||
      sqliteQuery.isFetching.value,
  );

  const error = computed(() => {
    const firstError =
      indexedDbQuery.error.value || localForageQuery.error.value || sqliteQuery.error.value;
    return firstError ? String(firstError) : null;
  });

  return {
    serial,
    targetId,
    selectedOrigin,
    availableOrigins: computed(() => availableOriginsQuery.data.value ?? []),
    setSelectedOrigin: (origin: string) =>
      storageContextStore.setSelectedOrigin(targetId.value, origin),
    selectedPackageName,
    scopeKey,
    entities,
    notes: computed(() => persistedScope.value.notes),
    persistedPositions: computed(() => persistedScope.value.positions),
    relationships,
    schemaRelationships,
    autoLayoutPositions,
    schemaLayoutPositions,
    isLoading,
    error,
  };
}
