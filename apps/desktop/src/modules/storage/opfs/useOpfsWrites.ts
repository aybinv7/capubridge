import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { OPFSFilesDomain } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { OpfsRow } from "./opfsModel";
import { deleteQuestion, opfsWrites } from "./opfsWrites";

/**
 * Deletes for the folder on screen. The origin and the folder are fixed for the life of the
 * screen that shows them, so a delete can only reach rows read from that folder. Deletes wait
 * while the rows are still being read and while the app is away, and say why.
 */
export function useOpfsWrites(options: {
  origin: string;
  /** The folder's name, for the question. */
  folder: string;
  domain: () => OPFSFilesDomain;
  /** No rows of this folder are on screen yet. */
  pending: Ref<boolean>;
  /** Why the phone cannot answer now, or `null`. */
  away: Ref<string | null>;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  forget: (rows: readonly OpfsRow[]) => void;
  after: (removed: number) => void;
}) {
  const busy = ref(false);

  const blockedReason = computed(() => {
    if (options.away.value) return options.away.value;
    if (options.pending.value) return "The folder is still being read.";
    return null;
  });

  /** Asks first, naming what goes and what it can break; deletes only on yes. */
  async function confirmAndRemove(rows: readonly OpfsRow[]): Promise<number> {
    if (rows.length === 0 || busy.value) return 0;
    if (blockedReason.value) {
      toast.info("Nothing was deleted", { description: blockedReason.value });
      return 0;
    }
    if (!(await options.confirm(deleteQuestion(rows, options.folder)))) return 0;
    if (blockedReason.value) {
      toast.info("Nothing was deleted", { description: blockedReason.value });
      return 0;
    }
    busy.value = true;
    try {
      const domain = options.domain();
      const removed = await opfsWrites(
        domain,
        options.origin,
        options.confirm,
        options.forget,
      ).removeRows(rows);
      options.after(removed);
      return removed;
    } catch (error) {
      toast.error("Nothing was deleted", {
        description: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      busy.value = false;
    }
  }

  return { blockedReason, busy, confirmAndRemove };
}
