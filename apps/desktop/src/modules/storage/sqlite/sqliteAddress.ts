import { LOCAL_SQL_SERIAL, type LocalSqlSession } from "@/stores/sqlSession.store";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { isSameSource } from "./sqliteDatabaseList";

/** Where the Rust side reads a database: a phone file (serial + app) or a file on this computer. */
export interface SqliteAddress {
  serial: string;
  package: string;
  path: string;
}

/** What can be reached right now: the selected app on its phone, and the open pulled copy. */
export interface SqliteReach {
  device: { serial: string; package: string } | null;
  session: LocalSqlSession | null;
}

/**
 * The address a database is read at, or `null` when it cannot be read yet. A phone database is
 * read through the selected app, whatever copy is open; an OPFS or jeep database only through
 * its pulled copy, once it is opened; an opened file through itself.
 */
export function addressOf(db: SqliteDbFile, reach: SqliteReach): SqliteAddress | null {
  const kind = db.sourceKind ?? "native-android";
  if (kind === "imported") return { serial: LOCAL_SQL_SERIAL, package: "file", path: db.path };
  if (kind === "native-android") {
    const device = reach.device;
    if (!device) return null;
    return { serial: device.serial, package: db.packageName || device.package, path: db.path };
  }
  const session = reach.session;
  if (!session || !isSameSource(db, session)) return null;
  return { serial: LOCAL_SQL_SERIAL, package: session.package, path: session.dbPath };
}

/** A key that names one readable copy, for query caches. */
export function addressKey(address: SqliteAddress | null): string {
  return address ? `${address.serial}::${address.package}::${address.path}` : "";
}

/** The arguments every `sqlite_*` command takes. */
export function addressArgs(address: SqliteAddress) {
  return { serial: address.serial, package: address.package, dbPath: address.path };
}
