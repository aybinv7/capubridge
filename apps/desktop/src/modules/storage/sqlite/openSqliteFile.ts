import type { Router } from "vue-router";
import { toast } from "@/lib/toast";
import { useSqliteFilesStore } from "@/modules/storage/stores/useSqliteFilesStore";
import { pickSqliteFile } from "./sqliteImportExport";
import { sqliteRouteTo } from "./useSqliteLocation";

/**
 * Asks for a SQLite file on this computer and opens it on the ungated file route, so it can be
 * read with no phone at all. Rust copies it to a working copy first; the picked file is only
 * written when the person saves, after saying yes once.
 */
export async function openSqliteFile(router: Router): Promise<void> {
  let picked: string | null;
  try {
    picked = await pickSqliteFile();
  } catch (error) {
    toast.error("Could not read the file", { description: String(error) });
    return;
  }
  if (!picked) return;
  try {
    const file = await useSqliteFilesStore().open(picked);
    if (file.walBeside) {
      toast.info(`“${file.name}” had a write-ahead log beside it`, {
        description:
          "Its rows were read too. Saving back to the file waits until the program that keeps the log closes it.",
      });
    }
    await router.push(sqliteRouteTo({ kind: "file", id: file.id }));
  } catch (error) {
    toast.error(`Could not open ${picked}`, { description: String(error) });
  }
}
