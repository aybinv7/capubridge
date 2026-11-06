import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { KeyValueDomain } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { KvChange, KvEntry, KvSource } from "./kvModel";
import { deleteQuestion, kvWrites, type KvSaveOutcome, type KvSaveRequest } from "./kvWrites";

/**
 * Saves and deletes for the list on screen. The list is fixed for the life of the screen that
 * shows it, so a write can only reach the list its rows were read from. Writes wait while the
 * list is still being read and while the app is away from the screen, and say why.
 */
export function useKvWrites(options: {
  source: KvSource;
  domain: () => KeyValueDomain;
  /** No rows of this list are on screen yet. */
  pending: Ref<boolean>;
  /** Why the phone cannot answer now, or `null`. */
  away: Ref<string | null>;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  /** What changed on the phone, so the list can follow it. */
  afterWrite: (change: KvChange) => void;
}) {
  const saving = ref(false);
  /** Keys handled so far by a long delete, or `null`. */
  const progress = ref<{ done: number; total: number } | null>(null);

  const blockedReason = computed(() => {
    if (options.away.value) return options.away.value;
    if (options.pending.value) return "The keys are still being read.";
    return null;
  });

  function writer(nothing: string) {
    const blocked = blockedReason.value;
    if (blocked) {
      toast.info(nothing, { description: blocked });
      return null;
    }
    try {
      return kvWrites(options.domain(), options.source, options.confirm);
    } catch (error) {
      toast.error(nothing, {
        description: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async function run<T>(task: () => Promise<T>): Promise<T> {
    saving.value = true;
    try {
      return await task();
    } finally {
      saving.value = false;
    }
  }

  async function save(request: KvSaveRequest): Promise<KvSaveOutcome> {
    const writes = writer("Nothing was saved");
    if (!writes) return "kept";
    const outcome = await run(() => writes.save(request));
    if (outcome === "saved") {
      options.afterWrite({
        kind: "saved",
        previous: request.entry,
        key: request.key,
        value: request.value,
      });
    }
    return outcome;
  }

  async function remove(entries: readonly KvEntry[]): Promise<number> {
    const writes = writer("Nothing was deleted");
    if (!writes || entries.length === 0) return 0;
    let removedIds: readonly string[] = [];
    try {
      const removed = await run(() =>
        writes.remove(
          entries,
          (done, total) => {
            progress.value = done < total ? { done, total } : null;
          },
          (ids) => (removedIds = ids),
        ),
      );
      if (removedIds.length > 0) options.afterWrite({ kind: "removed", ids: removedIds });
      return removed;
    } finally {
      progress.value = null;
    }
  }

  /** Asks first, naming the keys and `listName`; deletes only on yes. */
  async function confirmAndRemove(entries: readonly KvEntry[], listName: string): Promise<number> {
    if (entries.length === 0) return 0;
    if (blockedReason.value) {
      toast.info("Nothing was deleted", { description: blockedReason.value });
      return 0;
    }
    if (!(await options.confirm(deleteQuestion(entries, listName)))) return 0;
    return remove(entries);
  }

  return { blockedReason, saving, progress, save, confirmAndRemove };
}
