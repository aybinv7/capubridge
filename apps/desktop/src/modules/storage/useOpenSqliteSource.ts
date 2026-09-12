import { onScopeDispose, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { useSqlSessionStore } from "@/stores/sqlSession.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useOpfsSnapshotCache } from "@/modules/storage/opfsSnapshotCache";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Opens an OPFS-backed SQLite database in the SQL Explorer. Rust streams the
 * file straight to disk, so the database never passes through the JS heap, and
 * an unchanged file that was already pulled is reused instead of re-read.
 */
export function useOpenSqliteSource() {
  const router = useRouter();
  const sqlSessionStore = useSqlSessionStore();
  const targetsStore = useTargetsStore();
  const snapshotCache = useOpfsSnapshotCache();
  const openingPath = ref<string | null>(null);

  function targetWsUrl(): string {
    const url = targetsStore.selectedTarget?.webSocketDebuggerUrl;
    if (!url) throw new Error("No active CDP target");
    return url;
  }

  async function openOpfsDatabase(opts: {
    path: string;
    label: string;
    stripSahPool: boolean;
    directory?: string;
  }) {
    const targetId = targetsStore.cdpTargetId;
    openingPath.value = opts.path;
    const toastId = toast.loading(`Opening "${opts.label}"…`);
    let unlisten: (() => void) | null = null;

    try {
      const wsUrl = targetWsUrl();
      const stat = await invokeCommand("opfs_stat_file", { wsUrl, path: opts.path });

      const cached = snapshotCache.get(targetId, opts.path);
      let dbPath: string;
      let sizeBytes: number;

      if (snapshotCache.isFresh(cached, stat)) {
        dbPath = cached.localPath;
        sizeBytes = cached.sizeBytes;
      } else {
        unlisten = await listenEvent("capubridge:opfs-pull-progress", (payload) => {
          if (payload.opfsPath !== opts.path) return;
          toast.loading(
            `Reading "${opts.label}" — ${formatBytes(payload.loaded)} of ${formatBytes(payload.total)}`,
            { id: toastId },
          );
        });

        const pulled = await invokeCommand("opfs_pull_sqlite", {
          wsUrl,
          path: opts.path,
          label: opts.label,
          stripSahPoolHeader: opts.stripSahPool,
        });
        dbPath = pulled.path;
        sizeBytes = pulled.size;
        snapshotCache.remember(targetId, opts.path, {
          localPath: pulled.path,
          size: stat.size,
          lastModified: stat.lastModified,
          sizeBytes: pulled.size,
        });
      }

      const session = sqlSessionStore.adoptLocalSession(opts.label, dbPath, sizeBytes, {
        kind: "opfs",
        label: opts.stripSahPool ? "opfs sah-pool" : "opfs",
        targetId,
        opfsPath: opts.path,
        stripSahPoolHeader: opts.stripSahPool,
      });
      toast.success(`Opened "${opts.label}" in SQL Explorer`, { id: toastId });
      await router.push(`/storage/sqlite/${encodeURIComponent(session.fileName)}`);
    } catch (err) {
      snapshotCache.forget(targetId, opts.path);
      toast.error("Failed to open in SQL Explorer", { id: toastId, description: String(err) });
    } finally {
      unlisten?.();
      openingPath.value = null;
    }
  }

  onScopeDispose(() => {
    openingPath.value = null;
  });

  return { openOpfsDatabase, openingPath };
}
