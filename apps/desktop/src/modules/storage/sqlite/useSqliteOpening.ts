import { ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useJeepSqlite } from "@/composables/useStorage";
import { useOpfsSnapshotCache } from "@/modules/storage/opfsSnapshotCache";
import { useOpenSqliteSource } from "@/modules/storage/useOpenSqliteSource";
import { useSqlSessionStore } from "@/stores/sqlSession.store";
import { useTargetsStore } from "@/stores/targets.store";
import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { openPlanFor } from "./sqliteOpenPlan";
import type { SqliteDatabaseTarget } from "./useSqliteLocation";

/**
 * Opens a database of the tab: a phone file or an opened file just becomes the place; a page
 * database (OPFS, jeep) is copied to this computer first, once, and that copy is what every
 * read uses. The copy is let go when the page it came from is no longer the selected one.
 */
export function useSqliteOpening(go: (target: SqliteDatabaseTarget, replace?: boolean) => void) {
  const sessions = useSqlSessionStore();
  const targets = useTargetsStore();
  const snapshots = useOpfsSnapshotCache();
  const { openOpfsDatabase, openingPath } = useOpenSqliteSource();
  const { getDomain: jeepDomain } = useJeepSqlite();
  const openingJeep = ref<string | null>(null);

  async function openJeep(db: SqliteDbFile, replace: boolean) {
    const key = db.sourceKey ?? db.name;
    const idbName = db.sourceIdbName ?? "jeepSQLiteStore";
    const storeName = db.sourceStoreName ?? "databases";
    openingJeep.value = db.path;
    const toastId = toast.loading(`Reading “${db.name}”…`);
    try {
      const bytes = await jeepDomain().readDatabaseBytes(
        { key, idbName, storeName },
        (loaded, total) =>
          toast.loading(`Reading “${db.name}” — ${formatBytes(loaded)} of ${formatBytes(total)}`, {
            id: toastId,
          }),
      );
      await sessions.startLocalSession(db.name, bytes, {
        kind: "jeep-sqlite",
        label: "jeep-sqlite",
        targetId: db.sourceTargetId ?? targets.cdpTargetId,
        packageName: "jeep-sqlite",
        idbName,
        storeName,
        key,
      });
      toast.dismiss(toastId);
      go({ kind: "device", path: db.path }, replace);
    } catch (error) {
      toast.error(`Could not read “${db.name}”`, { id: toastId, description: String(error) });
    } finally {
      openingJeep.value = null;
    }
  }

  function adoptCached(db: SqliteDbFile): boolean {
    const path = db.sourceOpfsPath;
    const targetId = db.sourceTargetId ?? targets.cdpTargetId;
    const cached = path ? snapshots.get(targetId, path) : undefined;
    if (!path || !cached) return false;
    sessions.adoptLocalSession(db.name, cached.localPath, cached.sizeBytes, {
      kind: "opfs",
      label: db.stripSahPoolHeader ? "opfs sah-pool" : "opfs",
      targetId,
      opfsPath: path,
      stripSahPoolHeader: db.stripSahPoolHeader ?? false,
    });
    return true;
  }

  /** Opens `db`; `fileId` when it is a file opened on this computer. */
  function open(db: SqliteDbFile, fileId: string | null = null, replace = false) {
    if (fileId) {
      go({ kind: "file", id: fileId }, replace);
      return;
    }
    const cached = Boolean(
      db.sourceOpfsPath &&
      snapshots.get(db.sourceTargetId ?? targets.cdpTargetId, db.sourceOpfsPath),
    );
    const plan = openPlanFor(db, sessions.localSession, cached);
    if (plan === "show") {
      go({ kind: "device", path: db.path }, replace);
    } else if (plan === "adopt") {
      if (adoptCached(db)) go({ kind: "device", path: db.path }, replace);
    } else if (plan === "wait") {
      toast.info(`“${db.name}” cannot be read yet`, {
        description: "The app is in the background. Bring it to the front, then open it again.",
      });
    } else if (db.sourceKind === "jeep-sqlite") {
      void openJeep(db, replace);
    } else if (db.sourceOpfsPath) {
      void openOpfsDatabase({
        path: db.sourceOpfsPath,
        label: db.name,
        stripSahPool: db.stripSahPoolHeader ?? false,
      });
    }
  }

  function isOpening(db: SqliteDbFile): boolean {
    return openingJeep.value === db.path || openingPath.value === db.sourceOpfsPath;
  }

  watch(
    () => targets.cdpTargetId,
    (targetId) => {
      const session = sessions.localSession;
      if (session?.sourceTargetId && session.sourceTargetId !== targetId) {
        sessions.clearLocalSession();
      }
    },
  );

  return { open, isOpening };
}
