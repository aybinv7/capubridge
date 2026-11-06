import { toast } from "vue-sonner";
import {
  KeyValueConflictError,
  KeyValueDeleteError,
  type KeyValueConflict,
  type KeyValueDomain,
  type KeyValueWriteInput,
} from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { targetOf, type KvEntry, type KvSource } from "./kvModel";

/** A save from the pane: a new key (`entry` null), or the entry as it was read, renamed or not. */
export interface KvSaveRequest {
  entry: KvEntry | null;
  key: string;
  value: unknown;
}

/** How a save ended: written, refused by the person (their edit stays), or failed. */
export type KvSaveOutcome = "saved" | "kept" | "failed";

function quoted(key: string): string {
  return `“${key}”`;
}

function question(conflict: KeyValueConflict, key: string): ConfirmRequest {
  if (conflict === "exists") {
    return {
      title: `Replace the value of ${quoted(key)}?`,
      text: `${quoted(key)} already has a value on the phone. Saving replaces it with yours. This cannot be undone.`,
      confirmLabel: "Replace it",
      danger: true,
    };
  }
  if (conflict === "changed") {
    return {
      title: `${quoted(key)} changed on the phone`,
      text: "The app changed this value after it was read. Saving puts your version over the app's. Read the list again first to see what the app wrote.",
      confirmLabel: "Save mine over it",
      danger: true,
    };
  }
  return {
    title: `${quoted(key)} is no longer on the phone`,
    text: "The app deleted it after it was read. Saving creates it again with your value.",
    confirmLabel: "Create it again",
    danger: true,
  };
}

/** The question every delete asks first, naming the key (or how many) and the list. */
export function deleteQuestion(entries: readonly KvEntry[], listName: string): ConfirmRequest {
  const single = entries.length === 1 ? entries[0] : undefined;
  return {
    title: single ? `Delete ${quoted(single.key)}?` : `Delete ${entries.length} keys?`,
    text: single
      ? `${quoted(single.key)} is deleted from ${listName} on the phone. This cannot be undone.`
      : `${entries.length} keys are deleted from ${listName} on the phone. This cannot be undone.`,
    confirmLabel: single ? "Delete key" : `Delete ${entries.length} keys`,
    danger: true,
  };
}

function changedQuestion(entries: readonly KvEntry[], changed: readonly number[]): ConfirmRequest {
  const single = changed.length === 1 ? entries[changed[0] ?? -1] : undefined;
  return {
    title: single
      ? `${quoted(single.key)} changed on the phone`
      : `${changed.length} keys changed on the phone`,
    text: "The app wrote a new value after the list was read, so it is not what you saw. Delete the new value anyway?",
    confirmLabel: changed.length === 1 ? "Delete it anyway" : "Delete them anyway",
    danger: true,
  };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function reportDeletes(entries: readonly KvEntry[], deleted: number, gone: number, kept: number) {
  const single = entries.length === 1 ? entries[0] : undefined;
  if (single) {
    if (deleted === 1) toast.success(`Deleted ${quoted(single.key)} on the phone`);
    else if (gone === 1) toast.info(`${quoted(single.key)} was already gone from the phone`);
    else toast.info("Nothing was deleted", { description: "The app's new value was kept." });
    return;
  }
  const parts = [
    gone > 0 ? `${plural(gone, "was", "were")} already gone` : "",
    kept > 0 ? `${kept} changed on the phone and ${kept === 1 ? "was" : "were"} kept` : "",
  ].filter(Boolean);
  const description = parts.length ? `${parts.join("; ")}.` : undefined;
  if (deleted > 0)
    toast.success(`Deleted ${plural(deleted, "key", "keys")} on the phone`, { description });
  else toast.info("Nothing was deleted", { description });
}

function reportFailure(total: number, done: number, error: unknown) {
  const description = error instanceof Error ? error.message : String(error);
  if (total === 1) toast.error("The key was not deleted", { description });
  else if (done === 0) toast.error("No key was deleted", { description });
  else toast.error(`${done} of ${total} keys were deleted before it failed`, { description });
}

function savedText(request: KvSaveRequest): string {
  if (!request.entry) return `Added ${quoted(request.key)} on the phone`;
  if (request.entry.key !== request.key) {
    return `Renamed ${quoted(request.entry.key)} to ${quoted(request.key)} on the phone`;
  }
  return `Saved ${quoted(request.key)} on the phone`;
}

function inputFor(request: KvSaveRequest): KeyValueWriteInput {
  const entry = request.entry;
  if (!entry) return { op: "set", key: request.key, value: request.value, expected: null };
  const renames = entry.key !== request.key;
  return renames
    ? {
        op: "rename",
        key: entry.rawKey,
        nextKey: request.key,
        value: request.value,
        expected: entry.stored,
      }
    : { op: "set", key: entry.rawKey, value: request.value, expected: entry.stored };
}

/**
 * Writes for one key-value list. The phone refuses anything the person did not see (a key
 * that exists, a value the app changed or deleted); each refusal is asked about in plain
 * words and only then written over. Success is reported after the phone answered.
 */
export function kvWrites(
  domain: KeyValueDomain,
  source: KvSource,
  confirm: (request: ConfirmRequest) => Promise<boolean>,
) {
  const target = targetOf(source);

  async function save(request: KvSaveRequest): Promise<KvSaveOutcome> {
    const input = inputFor(request);
    for (;;) {
      try {
        await domain.write(target, input);
        toast.success(savedText(request));
        return "saved";
      } catch (error) {
        if (!(error instanceof KeyValueConflictError)) {
          toast.error("Nothing was saved", {
            description: error instanceof Error ? error.message : String(error),
          });
          return "failed";
        }
        const flag = error.conflict === "exists" ? "replaceExisting" : "overwriteChanged";
        if (input[flag]) {
          toast.error("Nothing was saved", { description: error.message });
          return "failed";
        }
        const conflictKey = error.conflict === "exists" ? request.key : (request.entry?.key ?? "");
        if (!(await confirm(question(error.conflict, conflictKey)))) {
          toast.info("Nothing was saved", {
            description: "The value on the phone was kept. Your edit is still here.",
          });
          return "kept";
        }
        input[flag] = true;
      }
    }
  }

  /**
   * Deletes `entries` in batches. A key whose value the app changed since it was read is kept
   * and asked about; only a yes deletes it. Resolves how many are no longer on the phone.
   */
  async function remove(
    entries: readonly KvEntry[],
    onProgress?: (done: number, total: number) => void,
    onRemoved?: (ids: readonly string[]) => void,
  ): Promise<number> {
    const removedIds: string[] = [];
    const note = (indexes: readonly number[], from: readonly KvEntry[]) => {
      for (const index of indexes) {
        const entry = from[index];
        if (entry) removedIds.push(entry.id);
      }
    };
    const items = entries.map((entry) => ({ key: entry.rawKey, expected: entry.stored }));
    let deleted = 0;
    let gone = 0;
    let kept = 0;
    try {
      const first = await domain.deleteMany(target, items, { onProgress });
      deleted = first.deleted.length;
      gone = first.gone.length;
      kept = first.changed.length;
      note([...first.deleted, ...first.gone], entries);
      if (kept > 0 && (await confirm(changedQuestion(entries, first.changed)))) {
        const changedEntries = first.changed
          .map((index) => entries[index])
          .filter((entry): entry is KvEntry => entry !== undefined);
        const again = changedEntries.map((entry) => ({
          key: entry.rawKey,
          expected: entry.stored,
        }));
        const forced = await domain.deleteMany(target, again, { force: true });
        deleted += forced.deleted.length;
        gone += forced.gone.length;
        kept = forced.changed.length;
        note([...forced.deleted, ...forced.gone], changedEntries);
      }
    } catch (error) {
      if (error instanceof KeyValueDeleteError) {
        deleted += error.done.deleted.length;
        gone += error.done.gone.length;
        note([...error.done.deleted, ...error.done.gone], entries);
      }
      reportFailure(entries.length, deleted + gone, error);
      onRemoved?.(removedIds);
      return deleted + gone;
    }
    reportDeletes(entries, deleted, gone, kept);
    onRemoved?.(removedIds);
    return deleted + gone;
  }

  return { save, remove };
}
