import { computed, watch, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useSQLite } from "@/composables/useSQLite";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import {
  diagramScopeKey,
  useStorageGraphStore,
} from "@/modules/storage/stores/useStorageGraphStore";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphPersistedScope,
} from "@/types/storageGraph.types";
import { ownDatabase, type DiagramSubject } from "./diagramSubject";
import { buildAutoLayoutPositions, buildSchemaLayoutPositions } from "./storageGraph.utils";
import { makeGraphId } from "./storageGraphEntityBuilders";
import { useOwnDiagramEntities } from "./useOwnDiagramEntities";
import { useStorageGraphQueries } from "./useStorageGraphQueries";
import { useStorageGraphRelationships } from "./useStorageGraphRelationships";

const EMPTY_SCOPE: StorageGraphPersistedScope = {
  positions: {},
  notes: [],
  manualEdges: [],
  annotations: {},
  groups: [],
};

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The device did not answer.";
}

/**
 * What one database's diagram shows: its own tables or stores, read the way its tab reads them,
 * and, when asked, the rest of the app's data (IndexedDB of the page's origin, LocalForage, the
 * app's other SQLite files); the saved layout of this database; the links and the two layouts.
 */
export function useDiagramModel(subject: Ref<DiagramSubject>, includeOther: Ref<boolean>) {
  const { getClient } = useCDP();
  const sqlite = useSQLite();
  const targetsStore = useTargetsStore();
  const storageContext = useStorageContextStore();
  const changesStore = useIndexedDBChangesStore();
  const graphStore = useStorageGraphStore();

  const own = useOwnDiagramEntities(subject);
  const targetId = computed(() => targetsStore.cdpTargetId);
  const contextOrigin = computed(() => storageContext.getSelectedOrigin(targetId.value));
  const origin = computed(() =>
    subject.value.kind === "indexeddb" ? subject.value.database.origin : contextOrigin.value,
  );

  const originsQuery = useQuery({
    queryKey: computed(() => ["storage-graph-origins", targetId.value]),
    enabled: computed(() => includeOther.value && Boolean(targetId.value)),
    staleTime: 60_000,
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) return [] as string[];
      const databases = await new IDBDomain(client).discoverDatabases();
      return [...new Set(databases.map((database) => database.origin))].sort((a, b) =>
        a.localeCompare(b),
      );
    },
  });
  const availableOrigins = computed(() => originsQuery.data.value ?? []);

  watch(
    availableOrigins,
    (origins) => {
      if (subject.value.kind === "sqlite" && !contextOrigin.value && origins[0]) {
        storageContext.setSelectedOrigin(targetId.value, origins[0]);
      }
    },
    { immediate: true },
  );

  const skip = computed(() => ownDatabase(subject.value));
  const other = useStorageGraphQueries({
    getClient,
    sqlite,
    targetId,
    selectedOrigin: origin,
    serial: computed(() => subject.value.place.serial),
    selectedPackageName: computed(() =>
      subject.value.place.packageName === "file" ? "" : subject.value.place.packageName,
    ),
    enabled: includeOther,
    skipSqlitePath: computed(() => skip.value.sqlitePath),
    ownSqliteName: computed(() => skip.value.sqliteName),
    skipIdbDatabase: computed(() => skip.value.idbName),
  });

  const scopeKey = computed(() => {
    const { place } = subject.value;
    return diagramScopeKey(place.serial, place.packageName, place.kind, place.databasePath);
  });

  watch(
    scopeKey,
    (key) => {
      const { place } = subject.value;
      if (place.packageName === "file") return;
      graphStore.adoptLegacyScope(key, {
        serial: place.serial,
        packageName: place.packageName,
        origin: origin.value,
      });
    },
    { immediate: true },
  );

  const changeCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const change of changesStore.changes) {
      if (change.kind !== "record" || !change.databaseName || !change.objectStoreName) continue;
      const nodeId = makeGraphId("idb", change.origin, change.databaseName, change.objectStoreName);
      counts[nodeId] = (counts[nodeId] ?? 0) + 1;
    }
    return counts;
  });

  const baseEntities = computed<StorageGraphEntityDescriptor[]>(() => {
    const mine = own.entities.value;
    if (!includeOther.value) return mine;
    const seen = new Set(mine.map((entity) => entity.id));
    const rest = [
      ...(other.indexedDbQuery.data.value ?? []),
      ...(other.localForageQuery.data.value ?? []),
      ...(other.sqliteQuery.data.value ?? []),
    ].filter((entity) => !seen.has(entity.id));
    return [...mine, ...rest];
  });

  const persistedScope = computed(() => graphStore.scopes[scopeKey.value] ?? EMPTY_SCOPE);

  const entities = computed<StorageGraphEntityDescriptor[]>(() => {
    const annotations = persistedScope.value.annotations;
    return baseEntities.value.map((entity) => ({
      ...entity,
      changeCount: entity.storageKind === "indexeddb" ? (changeCounts.value[entity.id] ?? 0) : 0,
      annotation: annotations[entity.id],
    }));
  });

  const { relationships, schemaRelationships } = useStorageGraphRelationships(
    entities,
    persistedScope,
  );

  const layoutItems = computed(() => [
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
  ]);
  const autoLayoutPositions = computed(() =>
    buildAutoLayoutPositions(layoutItems.value, relationships.value),
  );
  const schemaLayoutPositions = computed(() =>
    buildSchemaLayoutPositions(layoutItems.value, schemaRelationships.value),
  );

  const otherQueries = [other.indexedDbQuery, other.localForageQuery, other.sqliteQuery];
  const otherLoading = computed(
    () => includeOther.value && otherQueries.some((query) => query.isFetching.value),
  );
  const otherError = computed(() => {
    if (!includeOther.value) return null;
    for (const query of otherQueries) {
      const text = errorText(query.error.value);
      if (text) return text;
    }
    return null;
  });

  function refetchOther() {
    for (const query of otherQueries) void query.refetch();
  }

  return {
    scopeKey,
    origin,
    availableOrigins,
    setOrigin: (value: string) => storageContext.setSelectedOrigin(targetId.value, value),
    entities,
    notes: computed(() => persistedScope.value.notes),
    persistedPositions: computed(() => persistedScope.value.positions),
    persistedGroups: computed(() => persistedScope.value.groups),
    relationships,
    schemaRelationships,
    autoLayoutPositions,
    schemaLayoutPositions,
    loading: own.loading,
    fetching: computed(() => own.fetching.value || otherLoading.value),
    error: own.error,
    otherError,
    refetch: () => {
      void own.refetch();
      if (includeOther.value) refetchOther();
    },
  };
}
