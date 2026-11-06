import type { Router } from "vue-router";
import { toast } from "@/lib/toast";
import { pickIdbExport } from "./idbExportFile";
import { useIdbSnapshotStore } from "./useIdbSnapshotStore";

export const IDB_FILE_ROUTE = "storage-indexeddb-snapshot";

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Asks for an IndexedDB export and opens it read-only under "Opened files", on the ungated
 * file route, so it works with no phone connected.
 */
export async function openIdbExport(router: Router): Promise<void> {
  let picked: Awaited<ReturnType<typeof pickIdbExport>>;
  try {
    picked = await pickIdbExport();
  } catch (error) {
    toast.error("Could not read that file", {
      description: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  if (!picked) return;
  const entry = useIdbSnapshotStore().addSnapshot(
    picked.path,
    picked.data,
    picked.lossy,
    picked.bytes,
  );
  toast.success(`Opened "${picked.data.database.name}" from ${fileName(picked.path)}`, {
    description: "Read-only. It stays open until Capubridge closes.",
  });
  await router.push({ name: IDB_FILE_ROUTE, params: { db: entry.id } });
}
