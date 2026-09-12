import type { LocalSqlSession } from "@/stores/sqlSession.store";
import type { SqliteDbFile } from "@/types/sqlite.types";

function sessionEntry(session: LocalSqlSession): SqliteDbFile {
  return {
    name: session.fileName,
    path: session.dbPath,
    size: session.sizeBytes,
    packageName: session.package,
    sourceKind: session.sourceKind,
    sourceLabel: session.sourceLabel,
    sourceTargetId: session.sourceTargetId,
    sourceIdbName: session.sourceIdbName,
    sourceStoreName: session.sourceStoreName,
    sourceKey: session.sourceKey,
    sourceOpfsPath: session.sourceOpfsPath,
    stripSahPoolHeader: session.stripSahPoolHeader,
  };
}

export function isSameSource(db: SqliteDbFile, session: LocalSqlSession): boolean {
  if (session.sourceOpfsPath) return db.sourceOpfsPath === session.sourceOpfsPath;
  if (session.sourceKey) return db.sourceKey === session.sourceKey;
  return db.name === session.fileName;
}

/**
 * The path to actually read a database from: the session's on-disk snapshot when
 * this entry is the open one, otherwise the entry's own path. Resolving it here
 * keeps opening correct even when the discovered list has not been refetched yet.
 */
export function resolveDbPath(db: SqliteDbFile, session: LocalSqlSession | null): string {
  return session && isSameSource(db, session) ? session.dbPath : db.path;
}

/**
 * Keeps every discovered database visible while one of them is open as a local
 * session. A database that discovery already found stays exactly as discovered —
 * its path is the sidebar's identity for pin, hide and change tracking, so it
 * must not be swapped for the session's temporary snapshot path. Only a session
 * with no discovered counterpart, such as an imported file, contributes an entry.
 */
export function mergeSessionIntoList(
  session: LocalSqlSession | null,
  discovered: SqliteDbFile[],
): SqliteDbFile[] {
  if (!session) return discovered;
  const alreadyListed = discovered.some((db) => isSameSource(db, session));
  return alreadyListed ? discovered : [sessionEntry(session), ...discovered];
}
