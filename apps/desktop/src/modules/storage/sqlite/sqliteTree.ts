import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import type {
  DataChangeCounts,
  DataCollectionNode,
  DataSection,
  DataSourceNode,
} from "@/modules/storage/frame/dataFrame.types";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import { sqliteSourceDescriptor } from "./sqliteSources";

/** The sidebar id of an opened file; phone and page databases use their path. */
export function fileSourceId(fileId: string): string {
  return `file:${fileId}`;
}

export interface SqliteTreeInput {
  /** Databases of the phone and the page, as discovered. */
  databases: readonly SqliteDbFile[];
  /** Files opened on this computer, each with its sidebar id. */
  files: readonly { sourceId: string; db: SqliteDbFile }[];
  /** The open database's sidebar id and its tables; only it lists tables. */
  open: { sourceId: string; tables: readonly SqliteTableInfo[] } | null;
  settings: (sourceId: string) => SourceSettings;
  databaseChanges: (db: SqliteDbFile) => DataChangeCounts | undefined;
  tableChanges: (db: SqliteDbFile, table: string) => DataChangeCounts | undefined;
  /** Some phone source answered (so an empty phone list means "none", not "not asked"). */
  phoneListed: boolean;
}

function sourceNode(sourceId: string, db: SqliteDbFile, input: SqliteTreeInput): DataSourceNode {
  const settings = input.settings(sourceId);
  const descriptor = sqliteSourceDescriptor(db);
  const isOpen = input.open?.sourceId === sourceId;
  const collections: DataCollectionNode[] = isOpen
    ? (input.open?.tables ?? []).map((table) => ({
        id: table.name,
        label: table.name,
        count: table.rowCount,
        changes: input.tableChanges(db, table.name),
        pinned: settings.pinnedItems.includes(table.name),
        hidden: settings.hiddenItems.includes(table.name),
      }))
    : [];
  const kind = db.sourceKind ?? "native-android";
  const note = db.unreachable
    ? "The page is not answering (app in the background). Its copy is read again when it is back."
    : undefined;
  return {
    id: sourceId,
    label: db.name,
    detail: `${descriptor.label} · ${formatBytes(db.size)}`,
    provenance: kind === "imported" ? "imported" : db.unreachable ? "stale" : "local",
    expanded: settings.expanded || isOpen,
    pinned: settings.pinned,
    hidden: settings.hidden,
    changes: input.databaseChanges(db),
    collections,
    ...(note ? { note } : {}),
  };
}

/**
 * The SQLite sidebar: the app's own databases on the phone, the page's (OPFS, jeep), then the
 * files opened here. Every source is keyed by its path (a file by its id), so pins, hidden
 * entries and the open state follow the database, never the temp copy it is read from. Only the
 * open database lists its tables, so a search never shows another database's tables.
 */
export function buildSqliteSections(input: SqliteTreeInput): DataSection[] {
  const phone = input.databases.filter(
    (db) => (db.sourceKind ?? "native-android") === "native-android",
  );
  const page = input.databases.filter(
    (db) => db.sourceKind === "opfs" || db.sourceKind === "jeep-sqlite",
  );
  const sections: DataSection[] = [
    {
      id: "phone",
      label: "In the app's files",
      sources: phone.map((db) => sourceNode(db.path, db, input)),
      ...(input.phoneListed
        ? { empty: "The app keeps no SQLite file in its databases folder" }
        : {}),
    },
    {
      id: "page",
      label: "In the page",
      sources: page.map((db) => sourceNode(db.path, db, input)),
    },
    {
      id: "files",
      label: "Opened files",
      sources: input.files.map((file) => sourceNode(file.sourceId, file.db, input)),
    },
  ];
  return sections;
}
