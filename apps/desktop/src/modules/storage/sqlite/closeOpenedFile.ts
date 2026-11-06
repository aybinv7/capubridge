import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { useSqliteFilesStore } from "@/modules/storage/stores/useSqliteFilesStore";
import type { useSqliteUnsavedStore } from "@/modules/storage/stores/useSqliteUnsavedStore";
import { closeFileQuestion } from "./sqliteUnsavedQuestion";

export interface CloseOpenedFileDeps {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  files: ReturnType<typeof useSqliteFilesStore>;
  unsaved: ReturnType<typeof useSqliteUnsavedStore>;
  /** Leaves the file's screen when it is the one open. */
  leave: () => void;
}

/**
 * Closes an opened file. When that would drop staged edits on screen, or changes its working
 * copy never wrote to the file, it asks first and changes nothing on "no". The staged edits
 * are dropped before the screen is left, so leaving does not ask a second time. Resolves
 * whether the file was closed; a failure to remove the working copy rejects after it closed.
 */
export async function closeOpenedFile(
  sourceId: string,
  fileId: string,
  deps: CloseOpenedFileDeps,
): Promise<boolean> {
  const file = deps.files.get(fileId);
  if (!file) return false;
  const question = closeFileQuestion(
    file.name,
    deps.unsaved.stagedIn(sourceId),
    file.unsaved ? file.original : null,
  );
  if (question && !(await deps.confirm(question))) return false;
  deps.unsaved.discardIn(sourceId);
  deps.leave();
  await deps.files.close(fileId);
  return true;
}
