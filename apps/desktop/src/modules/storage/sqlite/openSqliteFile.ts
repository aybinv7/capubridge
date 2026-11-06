import type { Router } from "vue-router";
import { toast } from "vue-sonner";
import { useSqliteFilesStore } from "@/modules/storage/stores/useSqliteFilesStore";
import { pickSqliteFile } from "./sqliteImportExport";
import { sqliteRouteTo } from "./useSqliteLocation";

/**
 * Asks for a SQLite file on this computer and opens it on the ungated file route, so it can be
 * read with no phone at all. The file is copied first; the original is never written.
 */
export async function openSqliteFile(router: Router): Promise<void> {
  let picked;
  try {
    picked = await pickSqliteFile();
  } catch (error) {
    toast.error("Could not read the file", { description: String(error) });
    return;
  }
  if (!picked) return;
  try {
    const file = await useSqliteFilesStore().open(picked.name, picked.bytes);
    await router.push(sqliteRouteTo({ kind: "file", id: file.id }));
  } catch (error) {
    toast.error(`Could not open “${picked.name}”`, { description: String(error) });
  }
}
