import type { Ref } from "vue";
import type { Row } from "@tanstack/vue-table";
import { Plus, Pencil, Trash2 } from "lucide-vue-next";
import type { IDBRecord } from "@capubridge/cdp-protocol";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";

export function recordKeyStr(key: IDBValidKey): string {
  return JSON.stringify(key);
}

export function getChangeOperation(record: IDBRecord) {
  return (record as IndexedDBDecoratedRecord).__changeOperation ?? null;
}

export function isDeletedChange(record: IDBRecord | null) {
  if (!record) return false;
  return (record as IndexedDBDecoratedRecord).__changeDeleted === true;
}

export function getRecordChange(record: IDBRecord | null) {
  if (!record) return null;
  return (record as IndexedDBDecoratedRecord).__recordChange ?? null;
}

export function getChangeIndicatorClass(record: IDBRecord) {
  const operation = getChangeOperation(record);

  if (operation === "add") return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (operation === "update") return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
  if (operation === "delete") return "bg-red-500/15 text-red-400 ring-red-500/30";
  return "";
}

export function getChangeIcon(record: IDBRecord) {
  const operation = getChangeOperation(record);

  if (operation === "add") return Plus;
  if (operation === "update") return Pencil;
  if (operation === "delete") return Trash2;
  return null;
}

export function getStickyRowBg(row: Row<IDBRecord>): string {
  if (row.getIsSelected()) return "bg-surface-3";
  const op = getChangeOperation(row.original);
  if (op === "add") return "bg-emerald-500/[0.04]";
  if (op === "update") return "bg-amber-500/[0.04]";
  if (op === "delete") return "bg-red-500/[0.04]";
  return "bg-background";
}

export function useIDBRowAppearance(locallyModifiedData: Ref<Map<string, unknown>>) {
  function isRowLocallyModified(row: Row<IDBRecord>): boolean {
    // Don't show local-modify indicator when the change overlay already owns this row
    if (getChangeOperation(row.original)) return false;
    return locallyModifiedData.value.has(recordKeyStr(row.original.key));
  }

  /** Returns a single mutually-exclusive background class for the row.
   *  Using a function (not a CSS-class object) avoids UnoCSS rule-order races
   *  where two bg-* utilities end up on the same element and the wrong one wins. */
  function getRowBgClass(row: Row<IDBRecord>): string {
    if (row.getIsSelected()) return "bg-brand/10!";
    const op = getChangeOperation(row.original);
    if (op === "add") return "bg-emerald-500/4";
    if (op === "update") return "bg-amber-500/4";
    if (op === "delete") return "bg-red-500/4 opacity-75";
    if (isRowLocallyModified(row)) return "bg-blue-500/5";
    return "";
  }

  return { isRowLocallyModified, getRowBgClass };
}
