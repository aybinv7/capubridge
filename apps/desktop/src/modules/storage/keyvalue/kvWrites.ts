import { toast } from "vue-sonner";
import {
  KeyValueConflictError,
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

  async function remove(entries: readonly KvEntry[]): Promise<number> {
    let deleted = 0;
    let gone = 0;
    const failures: string[] = [];
    for (const entry of entries) {
      try {
        const result = await domain.write(target, { op: "delete", key: entry.rawKey });
        if (result.gone) gone += 1;
        else deleted += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    const alreadyGone = gone > 0 ? ` ${gone} ${gone === 1 ? "was" : "were"} already gone.` : "";
    if (failures.length === 0) {
      const single = entries.length === 1 ? entries[0] : undefined;
      if (single && gone === 1) toast.info(`${quoted(single.key)} was already gone from the phone`);
      else if (single) toast.success(`Deleted ${quoted(single.key)} on the phone`);
      else toast.success(`Deleted ${deleted} keys on the phone.${alreadyGone}`);
    } else {
      toast.error(
        entries.length === 1
          ? "The key was not deleted"
          : `${failures.length} of ${entries.length} deletes failed`,
        { description: failures[0] },
      );
    }
    return deleted + gone;
  }

  return { save, remove };
}
