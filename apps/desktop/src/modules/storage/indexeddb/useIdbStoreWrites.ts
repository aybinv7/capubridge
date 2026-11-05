import { computed, ref, type Ref } from "vue";
import type { IDBDomain, IDBRecord } from "@capubridge/cdp-protocol";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { buildStoreKey, serializeKey } from "@/modules/storage/changes/indexeddbChanges.service";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import { editorKindFor } from "@/shared/components/data/grid/editors/cellEdit";
import type { GridColumnType } from "@/shared/components/data/grid";
import { idbWrites } from "./idbWrites";
import { isPlainRecord, KEY_COLUMN, recordKey, VALUE_COLUMN } from "./idbGridModel";
import type { IdbOpenDatabase } from "./useIdbCatalog";

/**
 * Edits and deletes for the open store. Every write goes to the phone through DevTools and is
 * reported after the phone answered; a cell edit changes only that field on the device, so a
 * record holding dates or binary data elsewhere keeps them.
 */
export function useIdbStoreWrites(options: {
  open: Ref<IdbOpenDatabase | null>;
  store: Ref<string>;
  domain: () => IDBDomain;
  afterWrite: () => void;
}) {
  const changes = useIndexedDBChangesStore();
  const saving = ref(false);

  const canWrite = computed(() => options.open.value?.mode === "live");

  function writer() {
    const open = options.open.value;
    if (!open || open.mode !== "live") return null;
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
  ): string | null {
    if (!canWrite.value) return "Opened from a file: it is read-only here.";
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
    if (editorKindFor(value, showAs) === null)
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

  async function saveRecord(record: IDBRecord, value: unknown): Promise<boolean> {
    const writes = writer();
    if (!writes) return false;
    const ok = await run(() => writes.save({ ...record, value }));
    if (ok) options.afterWrite();
    return ok;
  }

  async function saveCell(record: IndexedDBDecoratedRecord, columnId: string, value: unknown) {
    const writes = writer();
    if (!writes) return false;
    const key = recordKey(record);
    const ok = await run(() =>
      columnId === VALUE_COLUMN
        ? writes.save({ ...record, value })
        : writes.patch(key, [columnId], value),
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

  return { canWrite, saving, cellReadOnlyReason, saveRecord, saveCell, removeRecords };
}
