import type { IDBDatabaseInfo, StoreInfo } from "@capubridge/cdp-protocol";
import type {
  DataChangeCounts,
  DataSection,
  DataSelection,
  DataSourceLink,
  DataSourceNode,
} from "@/modules/storage/frame/dataFrame.types";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import type { IdbSnapshotEntry } from "./useIdbSnapshotStore";
import type { IdbMode } from "./useIdbLocation";

/** Databases other Data tabs read for you; they stay listed here with a way there. */
const OWNED_ELSEWHERE: Record<string, DataSourceLink> = {
  localforage: { label: "Read as key-value pairs in LocalForage", to: "/storage/localforage" },
  jeepSQLiteStore: { label: "Used by SQLite (jeep) · open in SQLite", to: "/storage/sqlite" },
  jeepSqliteStore: { label: "Used by SQLite (jeep) · open in SQLite", to: "/storage/sqlite" },
};

export const FILE_PREFIX = "file:";

export interface IdbTreeInput {
  live: readonly IDBDatabaseInfo[];
  hasPhone: boolean;
  files: readonly IdbSnapshotEntry[];
  settings: (sourceId: string) => SourceSettings;
  databaseChanges: (origin: string, database: string) => DataChangeCounts;
  storeChanges: (origin: string, database: string, store: string) => DataChangeCounts;
  /** Record counts of the open database's stores, when read. */
  counts: ReadonlyMap<string, number>;
  /** The open database; it is always shown expanded. */
  openSourceId: string | null;
}

export function liveSourceId(db: Pick<IDBDatabaseInfo, "origin" | "name">): string {
  return `${db.origin}::${db.name}`;
}

export function fileSourceId(fileId: string): string {
  return `${FILE_PREFIX}${fileId}`;
}

/** The route a sidebar source opens: a live database name or a file id. */
export function sourceRoute(
  sourceId: string,
  live: readonly IDBDatabaseInfo[],
): { mode: IdbMode; id: string } | null {
  if (sourceId.startsWith(FILE_PREFIX))
    return { mode: "file", id: sourceId.slice(FILE_PREFIX.length) };
  const db = live.find((entry) => liveSourceId(entry) === sourceId);
  return db ? { mode: "live", id: db.name } : null;
}

function liveSource(db: IDBDatabaseInfo, input: IdbTreeInput): DataSourceNode {
  const id = liveSourceId(db);
  const settings = input.settings(id);
  const open = input.openSourceId === id;
  return {
    id,
    label: db.name,
    detail: `v${db.version}`,
    provenance: "live",
    pinned: settings.pinned,
    hidden: settings.hidden,
    expanded: settings.expanded || open,
    changes: input.databaseChanges(db.origin, db.name),
    link: OWNED_ELSEWHERE[db.name],
    collections: db.objectStoreNames.map((store) => ({
      id: store,
      label: store,
      count: open ? input.counts.get(store) : undefined,
      pinned: settings.pinnedItems.includes(store),
      hidden: settings.hiddenItems.includes(store),
      changes: input.storeChanges(db.origin, db.name, store),
    })),
  };
}

function fileSource(entry: IdbSnapshotEntry, input: IdbTreeInput): DataSourceNode {
  const id = fileSourceId(entry.id);
  const open = input.openSourceId === id;
  return {
    id,
    label: entry.data.database.name,
    detail: `v${entry.data.database.version}`,
    provenance: "imported",
    expanded: open || input.settings(id).expanded,
    collections: entry.data.database.stores.map((store) => ({
      id: store.name,
      label: store.name,
      count: store.records.length,
    })),
  };
}

/** The IndexedDB sidebar: databases on the phone, then opened export files. */
export function buildIdbSections(input: IdbTreeInput): DataSection[] {
  const sections: DataSection[] = [];
  if (input.hasPhone) {
    sections.push({
      id: "live",
      label: "On the phone",
      sources: input.live.map((db) => liveSource(db, input)),
      empty: "This page has no IndexedDB databases",
    });
  }
  sections.push({
    id: "files",
    label: "Opened files",
    sources: input.files.map((entry) => fileSource(entry, input)),
  });
  return sections;
}

/** The sidebar row that matches the route. */
export function selectionFor(
  mode: IdbMode,
  database: string,
  store: string,
  origin: string,
  live: readonly IDBDatabaseInfo[],
): DataSelection | null {
  if (!database) return null;
  if (mode === "file") return { sourceId: fileSourceId(database), collectionId: store || null };
  const db =
    live.find((entry) => entry.name === database && entry.origin === origin) ??
    live.find((entry) => entry.name === database);
  return db ? { sourceId: liveSourceId(db), collectionId: store || null } : null;
}

/** Record counts by store name, for the sidebar. */
export function countsByStore(info: readonly StoreInfo[] | undefined): Map<string, number> {
  return new Map((info ?? []).map((store) => [store.name, store.recordCount]));
}
