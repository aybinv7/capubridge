import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, type IDBDatabaseInfo, type IDBRecord } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import type { StorageGraphEntityDescriptor } from "@/types/storageGraph.types";
import { sqliteQueryRoot } from "@/modules/storage/sqlite/browse/useSqliteRows";
import { readTableSchema, runQuery } from "@/modules/storage/sqlite/sqliteReads";
import type { DiagramSubject, IdbDiagramSubject, SqliteDiagramSubject } from "./diagramSubject";
import { mapLimited } from "./mapLimited";
import { sqliteDiagramEntities } from "./sqliteDiagramEntities";
import { buildIndexedDbDescriptor } from "./storageGraphEntityBuilders";

const SAMPLE_SIZE = 12;
const PARALLEL_READS = 6;

function message(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The database did not answer.";
}

/**
 * The tables of the SQLite database the tab has open, read from that same copy: nothing is
 * pulled again, and "Read again" in the tab reads the diagram again too (F13).
 */
export async function readSqliteDiagram(subject: SqliteDiagramSubject) {
  const { address, db, tables } = subject;
  const schemas = await mapLimited(tables, PARALLEL_READS, async (table) => ({
    table,
    ...(await readTableSchema(address, table.name)),
  }));
  return sqliteDiagramEntities(
    address.package,
    [{ name: db.name, path: db.path, tables: schemas, openPath: subject.openTable }],
    (_path, sql) => runQuery(address, sql),
  );
}

function idbInfo(subject: IdbDiagramSubject): IDBDatabaseInfo {
  const { database } = subject;
  return {
    name: database.name,
    version: database.version,
    origin: database.origin,
    objectStoreNames: [...database.storeNames],
  };
}

/** A store's first records from an opened export file, read with no phone. */
function fileSamples(subject: IdbDiagramSubject, store: string): IDBRecord[] {
  const entry = subject.database.file?.data.database.stores.find((item) => item.name === store);
  return (entry?.records ?? [])
    .slice(0, SAMPLE_SIZE)
    .map((record) => ({ key: record.key as IDBValidKey, value: record.value }));
}

/**
 * The stores of the IndexedDB database the tab has open: their shape comes from what the tab
 * already read, and only a few records per store are sampled for field names.
 */
async function idbEntities(
  subject: IdbDiagramSubject,
  getClient: ReturnType<typeof useCDP>["getClient"],
): Promise<StorageGraphEntityDescriptor[]> {
  const info = idbInfo(subject);
  const client = subject.database.mode === "live" ? getClient(subject.targetId) : null;
  if (subject.database.mode === "live" && !client) throw new Error("The page is not connected.");
  const domain = client ? new IDBDomain(client) : null;
  return mapLimited(subject.stores, PARALLEL_READS, async (store) => {
    const records = domain
      ? (
          await domain.getData({
            securityOrigin: info.origin,
            databaseName: info.name,
            objectStoreName: store.name,
            skipCount: 0,
            pageSize: SAMPLE_SIZE,
          })
        ).records
      : fileSamples(subject, store.name);
    return buildIndexedDbDescriptor(info, store, records, subject.openStore(store.name));
  });
}

function subjectKey(subject: DiagramSubject | null): readonly unknown[] {
  if (!subject) return ["diagram", "none"];
  if (subject.kind === "sqlite") return [...sqliteQueryRoot(subject.address), "diagram"];
  const { database } = subject;
  return [
    "idb-diagram",
    database.mode,
    database.mode === "live" ? subject.targetId : database.id,
    database.origin,
    database.name,
    subject.stores.map((store) => `${store.name}:${store.recordCount}`).join("|"),
  ];
}

/** The diagram's own database, read the way its tab reads it. */
export function useOwnDiagramEntities(subject: Ref<DiagramSubject | null>) {
  const { getClient } = useCDP();
  const query = useQuery({
    queryKey: computed(() => subjectKey(subject.value)),
    enabled: computed(() => subject.value !== null),
    staleTime: computed(() => (subject.value?.kind === "sqlite" ? Infinity : 60_000)),
    gcTime: 60_000,
    retry: false,
    queryFn: () => {
      const current = subject.value;
      if (!current) return Promise.resolve([] as StorageGraphEntityDescriptor[]);
      return current.kind === "sqlite"
        ? readSqliteDiagram(current)
        : idbEntities(current, getClient);
    },
  });
  return {
    entities: computed(() => query.data.value ?? []),
    loading: computed(() => query.isPending.value && query.fetchStatus.value !== "idle"),
    fetching: query.isFetching,
    error: computed(() => message(query.error.value)),
    refetch: () => query.refetch(),
  };
}
