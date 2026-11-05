import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { IDBDomain, IDBRecord } from "@capubridge/cdp-protocol";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { buildStoreKey, serializeKey } from "@/modules/storage/changes/indexeddbChanges.service";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import { editorKindFor } from "@/shared/components/data/grid/editors/cellEdit";
import type { GridColumnType } from "@/shared/components/data/grid";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { idbWrites } from "./idbWrites";
import { isPlainRecord, KEY_COLUMN, recordKey, VALUE_COLUMN } from "./idbGridModel";
import type { IdbOpenDatabase } from "./useIdbCatalog";

const FILE_READ_ONLY = "Opened from a file: it is read-only here.";

/**
 * Edits and deletes for the open store. Every write goes to the phone through DevTools and is
 * reported after the phone answered; a cell edit changes only that field on the device, so a
 * record holding dates or binary data elsewhere keeps them. Writes wait while the rows on
 * screen are not the page being read, and while the app is away from the screen.
 */
export function useIdbStoreWrites(options: {
  open: Ref<IdbOpenDatabase | null>;
  store: Ref<string>;
  domain: () => IDBDomain;
  /** True while the rows on screen are not the page being read (writes wait for it). */
  pending: Ref<boolean>;
  /** Why the phone cannot answer now (the app is in the background), or `null`. */
  away?: Ref<string | null>;
  confirm?: (request: ConfirmRequest) => Promise<boolean>;
  afterWrite: () => void;
}) {
  const changes = useIndexedDBChangesStore();
  const saving = ref(false);

  const canWrite = computed(() => options.open.value?.mode === "live");
  const blockedReason = computed(() => {
    if (!canWrite.value) return FILE_READ_ONLY;
    if (options.away?.value) return options.away.value;
    if (options.pending.value) return "The page is still being read.";
    return null;
  });

  function writer() {
    const open = options.open.value;
    if (!open || open.mode !== "live") return null;
    const blocked = blockedReason.value;
    if (blocked) {
      toast.info("Nothing was saved", { description: blocked });
      return null;
    }
    const at = { origin: open.origin, database: open.name, store: options.store.value };
    const storeKey = buildStoreKey(at.origin, at.database, at.store);
    return idbWrites(options.domain(), at, {
      onWritten: (keys) => changes.noteOwnWrite(storeKey, keys.map(serializeKey)),
    });
  }

  /** Why a cell cannot be edited in place, or `null` when it can. */
  function cellReadOnlyReason(
    record: IndexedDBDecoratedRecord,
    columnId: string,
    showAs: GridColumnType | undefined,
    like?: unknown,
  ): string | null {
    if (blockedReason.value) return blockedReason.value;
    if (record.__changeDeleted) return "Deleted on the device.";
    if (record.editable === false && record.readOnlyReason?.startsWith("Changed on the device")) {
      return record.readOnlyReason;
    }
    if (columnId === KEY_COLUMN)
      return "The key identifies the record; change it in the record pane.";
    const value =
      columnId === VALUE_COLUMN
        ? record.value
        : isPlainRecord(record.value)
          ? record.value[columnId]
          : undefined;
    if (columnId === VALUE_COLUMN && record.editable === false)
      return record.readOnlyReason ?? "Read-only";
    if (editorKindFor(value, showAs, like) === null)
      return "Edit objects, lists and special values in the record pane.";
    return null;
  }

  async function run<T>(task: () => Promise<T>): Promise<T> {
    saving.value = true;
    try {
      return await task();
    } finally {
      saving.value = false;
    }
  }

  function confirmReplace(message: string): Promise<boolean> {
    if (!options.confirm) return Promise.resolve(false);
    return options.confirm({
      title: "Replace the other record?",
      text: `${message} Saving replaces that record with this one, and this record's old key is removed. This cannot be undone.`,
      confirmLabel: "Replace it",
      danger: true,
    });
  }

  async function saveRecord(record: IDBRecord, value: unknown): Promise<boolean> {
    const writes = writer();
    if (!writes) return false;
    const ok = await run(() => writes.save({ ...record, value }, { confirmReplace }));
    if (ok) options.afterWrite();
    return ok;
  }

  async function saveCell(record: IndexedDBDecoratedRecord, columnId: string, value: unknown) {
    const writes = writer();
    if (!writes) return false;
    const key = recordKey(record);
    const ok = await run(() =>
      columnId === VALUE_COLUMN
        ? writes.save({ ...record, value }, { quiet: true, confirmReplace })
        : writes.patch(key, [columnId], value, { quiet: true }),
    );
    if (ok) options.afterWrite();
    return ok;
  }

  async function removeRecords(records: readonly IDBRecord[]): Promise<number> {
    const writes = writer();
    if (!writes || records.length === 0) return 0;
    const deleted = await run(() => writes.remove(records.map(recordKey)));
    if (deleted > 0) options.afterWrite();
    return deleted;
  }

  return {
    canWrite,
    blockedReason,
    saving,
    cellReadOnlyReason,
    saveRecord,
    saveCell,
    removeRecords,
  };
}
