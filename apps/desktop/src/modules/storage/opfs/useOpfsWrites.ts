import { computed, ref, type Ref } from "vue";
import { toast } from "@/lib/toast";
import type { OPFSFilesDomain, OPFSInspection } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { OpfsRow } from "./opfsModel";
import { HELD_OPEN, deleteQuestion, heldOpen, opfsWrites } from "./opfsWrites";

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

  /** Looks inside folders and at files the list could not measure, before the question. */
  async function look(rows: readonly OpfsRow[]): Promise<OPFSInspection[] | null> {
    const needed = rows.filter((row) => row.kind === "directory" || row.size === null);
    if (needed.length === 0) return [];
    try {
      busy.value = true;
      return await options.domain().inspect(
        options.origin,
        needed.map((row) => ({ path: row.path, kind: row.kind })),
      );
    } catch (error) {
      toast.error("Nothing was deleted", {
        description: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      busy.value = false;
    }
  }

  /**
   * Looks inside what would go, refuses while the app holds any of it open, then asks, naming
   * what goes and what it can break; deletes only on yes.
   */
  async function confirmAndRemove(rows: readonly OpfsRow[]): Promise<number> {
    if (rows.length === 0 || busy.value) return 0;
    if (blockedReason.value) {
      toast.info("Nothing was deleted", { description: blockedReason.value });
      return 0;
    }
    const inspections = await look(rows);
    if (!inspections) return 0;
    const held = heldOpen(inspections);
    if (held.length > 0) {
      toast.error("Nothing was deleted", {
        description: `${held.length === 1 ? `“${held[0]}” is` : `${held.length} files are`} held open. ${HELD_OPEN}`,
      });
      return 0;
    }
    if (!(await options.confirm(deleteQuestion(rows, options.folder, inspections)))) return 0;
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
      ).removeRows(rows, inspections);
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
