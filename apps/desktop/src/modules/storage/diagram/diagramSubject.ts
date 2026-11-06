import type { StoreInfo } from "@capubridge/cdp-protocol";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import type { DiagramKind } from "@/modules/storage/stores/useStorageGraphStore";
import type { IdbOpenDatabase } from "@/modules/storage/indexeddb/useIdbCatalog";
import type { SqliteAddress } from "@/modules/storage/sqlite/sqliteAddress";

/** Who a diagram belongs to: the phone and app (empty for a file opened here), and the database. */
export interface DiagramPlace {
  serial: string;
  packageName: string;
  kind: DiagramKind;
  /** The database's own path: a phone file, `opfs:…`, `jeep-sqlite:…`, `origin/name`, `file:name`. */
  databasePath: string;
}

/** A SQLite database drawn from the copy its tab has open. */
export interface SqliteDiagramSubject {
  kind: "sqlite";
  place: DiagramPlace;
  db: SqliteDbFile;
  address: SqliteAddress;
  tables: readonly SqliteTableInfo[];
  /** The path "Open data" goes to for a table of this database. */
  openTable: (table: string) => string;
}

/** An IndexedDB database drawn from the stores its tab has read (live or an opened export). */
export interface IdbDiagramSubject {
  kind: "indexeddb";
  place: DiagramPlace;
  database: IdbOpenDatabase;
  stores: readonly StoreInfo[];
  targetId: string;
  /** The path "Open data" goes to for a store of this database. */
  openStore: (store: string) => string;
}

export type DiagramSubject = SqliteDiagramSubject | IdbDiagramSubject;

/** The diagram's own database, as the cross-source queries skip it. */
export function ownDatabase(subject: DiagramSubject): {
  sqlitePath: string;
  sqliteName: string;
  idbName: string;
} {
  if (subject.kind === "sqlite") {
    return { sqlitePath: subject.db.path, sqliteName: subject.db.name, idbName: "" };
  }
  return { sqlitePath: "", sqliteName: "", idbName: subject.database.name };
}
