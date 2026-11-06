import { onScopeDispose, watch, type Ref } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { useJeepSqlite, useOPFS } from "@/composables/useStorage";
import { useOpfsSnapshotCache } from "@/modules/storage/opfsSnapshotCache";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import { invokeCommand } from "@/runtime/ipc/client";
import { useSqlSessionStore, type LocalSqlSession } from "@/stores/sqlSession.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { diffSqliteSnapshots } from "./diffSqliteSnapshots";
import { addressArgs, type SqliteAddress } from "./sqliteAddress";

const POLL_MS = 5000;
const JEEP_FULL_CHECK_EVERY = 12;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export interface SqliteSyncSubject {
  db: Ref<SqliteDbFile | null>;
  address: Ref<SqliteAddress | null>;
  /** Change records are filed under the phone and app, never a temp copy's path. */
  changeSerial: Ref<string>;
  changePackage: Ref<string>;
  /** Runs after a read again found new data (re-read tables and rows). */
  onChanged: () => void;
}

/**
 * Keeps the open database current: a phone database is stat'ed every 5 s and pulled again only
 * when it changed; a page database is hashed on the page first; the new copy is compared with
 * the previous one and every row the app changed is recorded. One check at a time; checks
 * pause while the window is hidden, and for a page database while the app is away.
 */
export function useSqliteSnapshotSync(subject: SqliteSyncSubject) {
  const sessions = useSqlSessionStore();
  const targets = useTargetsStore();
  const presence = useTargetPresenceStore();
  const snapshots = useOpfsSnapshotCache();
  const changes = useSqliteChangesStore();
  const { getDomain: opfsDomain } = useOPFS();
  const { getDomain: jeepDomain } = useJeepSqlite();
  const visibility = useDocumentVisibility();

  let baselinePath = "";
  let baselineBytes: Uint8Array | null = null;
  const statSignatures = new Map<string, string>();
  const jeepSignatures = new Map<string, { signature: string; unchanged: number }>();
  const reportedSkipped = new Map<string, string>();

  function kindOf(db: SqliteDbFile | null) {
    return db?.sourceKind ?? "native-android";
  }

  function takeBaseline(path: string, bytes: Uint8Array): Uint8Array | null {
    const previous = baselinePath === path ? baselineBytes : null;
    baselinePath = path;
    baselineBytes = bytes;
    return previous;
  }

  async function recordDiff(previous: Uint8Array, next: Uint8Array, dbPath: string) {
    const diff = await diffSqliteSnapshots(previous, next);
    const serial = subject.changeSerial.value;
    const packageName = subject.changePackage.value;
    for (const op of diff.changes) {
      changes.recordChange({ ...op, serial, packageName, dbPath });
    }
    if (diff.truncated) {
      changes.recordSystemChange({
        serial,
        packageName,
        dbPath,
        message: `Snapshot diff truncated — more than ${diff.changes.length} ops detected`,
      });
    }
    const skipped = diff.skippedTablesWithoutPk.join(",");
    if (skipped && reportedSkipped.get(dbPath) !== skipped) {
      reportedSkipped.set(dbPath, skipped);
      changes.recordSystemChange({
        serial,
        packageName,
        dbPath,
        message: `Change tracking unavailable for ${diff.skippedTablesWithoutPk.length} table(s) with no primary key — rows there have no stable identity: ${diff.skippedTablesWithoutPk.join(", ")}`,
      });
    } else if (!skipped) reportedSkipped.delete(dbPath);
  }

  async function exportBytes(address: SqliteAddress): Promise<Uint8Array> {
    return base64ToBytes(await invokeCommand("sqlite_export_bytes", addressArgs(address)));
  }

  async function phoneDirty(address: SqliteAddress): Promise<boolean> {
    const stat = await invokeCommand("sqlite_stat_database", addressArgs(address));
    const signature = `${stat.size}:${stat.modifiedAt}`;
    if (statSignatures.get(address.path) === signature) return false;
    statSignatures.set(address.path, signature);
    return true;
  }

  async function syncPhone(db: SqliteDbFile, address: SqliteAddress, force: boolean) {
    if (!force && !(await phoneDirty(address))) return false;
    await invokeCommand("sqlite_refresh_database", addressArgs(address));
    const bytes = await exportBytes(address);
    if (!bytes.byteLength) return false;
    const previous = takeBaseline(db.path, bytes);
    if (previous?.byteLength) await recordDiff(previous, bytes, db.path);
    return true;
  }

  /**
   * Whether a jeep database may have changed, from its size and header change counter instead
   * of hashing every byte each check (P2). Every twelfth unchanged check reads in full anyway,
   * in case a writer left the counter as it was.
   */
  async function jeepDirty(session: LocalSqlSession, key: string): Promise<boolean> {
    const signature = await jeepDomain().headerSignature({
      key,
      idbName: session.sourceIdbName,
      storeName: session.sourceStoreName,
    });
    const seen = jeepSignatures.get(session.dbPath);
    if (signature && seen?.signature === signature && seen.unchanged < JEEP_FULL_CHECK_EVERY) {
      jeepSignatures.set(session.dbPath, { signature, unchanged: seen.unchanged + 1 });
      return false;
    }
    jeepSignatures.set(session.dbPath, { signature: signature ?? "", unchanged: 0 });
    return true;
  }

  async function pageDirty(session: LocalSqlSession): Promise<boolean> {
    if (session.sourceKind === "jeep-sqlite" && session.sourceKey) {
      return jeepDirty(session, session.sourceKey);
    }
    const wsUrl = targets.selectedTarget?.webSocketDebuggerUrl;
    if (session.sourceKind !== "opfs" || !session.sourceOpfsPath || !wsUrl) return true;
    const stat = await invokeCommand("opfs_stat_file", { wsUrl, path: session.sourceOpfsPath });
    return !snapshots.isFresh(
      snapshots.get(session.sourceTargetId ?? "", session.sourceOpfsPath),
      stat,
    );
  }

  async function readPage(
    session: LocalSqlSession,
  ): Promise<{ bytes: Uint8Array; hash: string | null } | null> {
    if (session.sourceKind === "opfs" && session.sourceOpfsPath) {
      const options = { stripSahPoolHeader: session.stripSahPoolHeader ?? false };
      const hash = await opfsDomain().hashSqliteBytes(session.sourceOpfsPath, options);
      if (hash && hash === sessions.lastSourceHash) return null;
      return { bytes: await opfsDomain().readSqliteBytes(session.sourceOpfsPath, options), hash };
    }
    if (session.sourceKind === "jeep-sqlite" && session.sourceKey) {
      const params = {
        key: session.sourceKey,
        idbName: session.sourceIdbName,
        storeName: session.sourceStoreName,
      };
      const hash = await jeepDomain().hashDatabaseBytes(params);
      if (hash && hash === sessions.lastSourceHash) return null;
      return { bytes: await jeepDomain().readDatabaseBytes(params), hash };
    }
    return null;
  }

  async function remember(session: LocalSqlSession, sizeBytes: number) {
    const wsUrl = targets.selectedTarget?.webSocketDebuggerUrl;
    const path = session.sourceOpfsPath;
    if (!path || !wsUrl) return;
    try {
      const stat = await invokeCommand("opfs_stat_file", { wsUrl, path });
      snapshots.remember(session.sourceTargetId ?? "", path, {
        localPath: session.dbPath,
        size: stat.size,
        lastModified: stat.lastModified,
        sizeBytes,
      });
    } catch {
      snapshots.forget(session.sourceTargetId ?? "", path);
    }
  }

  async function syncPage(db: SqliteDbFile, force: boolean) {
    const session = sessions.localSession;
    if (!session) return false;
    if (!force && !(await pageDirty(session))) return false;
    const read = await readPage(session);
    if (!read) return false;
    sessions.setLastSourceHash(read.hash);
    const onDisk = sessions.lastSourceBytes
      ? null
      : base64ToBytes(await invokeCommand("read_local_file_base64", { path: session.dbPath }));
    const previous = sessions.swapSnapshot(read.bytes) ?? onDisk;
    if (previous?.byteLength && read.bytes.byteLength) {
      await recordDiff(previous, read.bytes, db.path);
    }
    await sessions.refreshLocalSession(read.bytes);
    await remember(session, read.bytes.byteLength);
    return true;
  }

  /** Checks the source and reads it again when it changed; `force` always reads it again. */
  async function check(force: boolean): Promise<boolean> {
    const db = subject.db.value;
    const address = subject.address.value;
    if (!db || !address) return false;
    const kind = kindOf(db);
    if (kind === "imported") return force;
    if (kind === "native-android") return syncPhone(db, address, force);
    return syncPage(db, force);
  }

  /** Takes a first copy of a phone database to compare the next read against. */
  async function prime() {
    const db = subject.db.value;
    const address = subject.address.value;
    if (!db || !address || kindOf(db) !== "native-android") return;
    if (baselinePath === db.path && baselineBytes) return;
    takeBaseline(db.path, await exportBytes(address));
  }

  let inFlight: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  /** One check at a time: a check asked for while one runs waits for it, then runs. */
  async function refresh(force: boolean): Promise<boolean> {
    while (inFlight) await inFlight.catch(() => false);
    const run = check(force);
    inFlight = run;
    try {
      const changed = await run;
      if (changed) subject.onChanged();
      return changed;
    } finally {
      inFlight = null;
    }
  }

  function paused(): boolean {
    if (visibility.value === "hidden") return true;
    const kind = kindOf(subject.db.value);
    return (
      (kind === "opfs" || kind === "jeep-sqlite") &&
      (presence.presence === "background" || presence.presence === "view-hidden")
    );
  }

  function schedule() {
    if (stopped) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      if (!paused() && !inFlight) {
        try {
          await refresh(false);
        } catch (error) {
          console.warn("[SQLite] background check failed", error);
        }
      }
      schedule();
    }, POLL_MS);
  }

  watch(
    () => subject.db.value?.path ?? "",
    () => {
      statSignatures.clear();
      jeepSignatures.clear();
      schedule();
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
  });

  return { refresh, prime };
}
