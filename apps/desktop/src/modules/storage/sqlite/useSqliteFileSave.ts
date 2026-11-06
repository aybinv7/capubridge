import { toast } from "vue-sonner";
import { invokeCommand } from "@/runtime/ipc/client";
import type { SqliteSavedOpenedFile } from "@/runtime/ipc/contracts/storage";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import {
  openedFileArgs,
  useSqliteFilesStore,
  type SqliteOpenedFile,
} from "@/modules/storage/stores/useSqliteFilesStore";
import { pickSqliteDestination } from "./sqliteImportExport";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The name the previous version of `file` is kept under, beside it. */
export function backupName(file: Pick<SqliteOpenedFile, "name">): string {
  return `${file.name}.bak`;
}

/** What saving over a picked file says once, before the first time: the path and the backup. */
export function firstSaveText(file: Pick<SqliteOpenedFile, "name" | "original">): string {
  return `Saving writes over ${file.original}. The version there now is kept beside it as ${backupName(file)}.`;
}

/**
 * Writing an opened file's working copy back to the file that was picked, or to another file.
 * Every message names the exact path written, and nothing is called saved unless Rust wrote it.
 */
export function useSqliteFileSave(confirm: (request: ConfirmRequest) => Promise<boolean>) {
  const files = useSqliteFilesStore();

  /** Asks once per opened file, naming the path, before saving writes over it. */
  async function confirmFirstSave(file: SqliteOpenedFile): Promise<boolean> {
    if (file.saveConfirmed) return true;
    const confirmed = await confirm({
      title: `Save the changes to “${file.name}”?`,
      text: `${firstSaveText(file)} Later saves of this file do not ask again.`,
      confirmLabel: "Save to the file",
      danger: false,
    });
    if (confirmed) files.confirmSave(file.id);
    return confirmed;
  }

  /**
   * Writes the working copy over the picked file. `done` names what changed in the copy (it
   * already happened there); a failure says the picked file was not written and keeps the
   * file marked as not saved. Resolves where it was saved, or `null`.
   */
  async function writeBack(
    file: SqliteOpenedFile,
    done: string,
  ): Promise<SqliteSavedOpenedFile | null> {
    files.setUnsaved(file.id, true);
    try {
      const saved = await invokeCommand("sqlite_save_opened_file", openedFileArgs(file));
      files.setUnsaved(file.id, false);
      return saved;
    } catch (error) {
      toast.error(`${done} in the copy opened here, but ${file.original} was not written`, {
        description: `${describe(error)}. Save to the file tries again; Save as… writes it to another file.`,
      });
      return null;
    }
  }

  /** Retries writing an opened file whose changes are only in its working copy. */
  async function saveToFile(file: SqliteOpenedFile): Promise<boolean> {
    if (!(await confirmFirstSave(file))) return false;
    const saved = await writeBack(file, "The changes are kept");
    if (saved) {
      toast.success(`Saved ${saved.path}`, {
        description: `The earlier version is kept as ${saved.backup}.`,
      });
    }
    return saved !== null;
  }

  /** Writes the working copy to a file the person picks; the picked original is unchanged. */
  async function saveAs(file: SqliteOpenedFile): Promise<string | null> {
    let dest: string | null;
    try {
      dest = await pickSqliteDestination(file.name);
    } catch (error) {
      toast.error("Could not ask where to save", { description: describe(error) });
      return null;
    }
    if (!dest) return null;
    try {
      const saved = await invokeCommand("sqlite_save_opened_file_as", {
        ...openedFileArgs(file),
        dest,
      });
      const current = files.get(file.id);
      toast.success(`Saved a copy to ${saved}`, {
        description: current?.unsaved
          ? `${file.original} itself still does not have these changes.`
          : `${file.original} is unchanged.`,
      });
      return saved;
    } catch (error) {
      toast.error(`Nothing was saved to ${dest}`, { description: describe(error) });
      return null;
    }
  }

  return { confirmFirstSave, writeBack, saveToFile, saveAs };
}
