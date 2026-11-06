import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { KeyValueDomain } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { KvEntry, KvSource } from "./kvModel";
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
  afterWrite: () => void;
}) {
  const saving = ref(false);

  const blockedReason = computed(() => {
    if (options.away.value) return options.away.value;
    if (options.pending.value) return "The keys are still being read.";
    return null;
  });

  function writer() {
    const blocked = blockedReason.value;
    if (blocked) {
      toast.info("Nothing was saved", { description: blocked });
      return null;
    }
    try {
      return kvWrites(options.domain(), options.source, options.confirm);
    } catch (error) {
      toast.error("Nothing was saved", {
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
    const writes = writer();
    if (!writes) return "kept";
    const outcome = await run(() => writes.save(request));
    if (outcome === "saved") options.afterWrite();
    return outcome;
  }

  async function remove(entries: readonly KvEntry[]): Promise<number> {
    const writes = writer();
    if (!writes || entries.length === 0) return 0;
    const removed = await run(() => writes.remove(entries));
    if (removed > 0) options.afterWrite();
    return removed;
  }

  /** Asks first, naming the keys and `listName`; deletes only on yes. */
  async function confirmAndRemove(entries: readonly KvEntry[], listName: string): Promise<number> {
    if (entries.length === 0) return 0;
    if (!(await options.confirm(deleteQuestion(entries, listName)))) return 0;
    return remove(entries);
  }

  return { blockedReason, saving, save, confirmAndRemove };
}
