import { onUnmounted, ref, type Ref } from "vue";
import type { Row, Table } from "@tanstack/vue-table";
import type { IDBRecord } from "@capubridge/cdp-protocol";
import { isDeletedChange, recordKeyStr } from "./useIDBRowAppearance";

// One click opens the row viewer, a second click within the window edits the
// cell in place.
//
// The short window is load-bearing, not a stylistic choice: the viewer is a
// centered modal, so the moment it opens its overlay covers the table and the
// second click lands on the overlay instead of the cell. Waiting lets us tell
// the two gestures apart before anything covers the row. Anything under ~180ms
// starts losing genuine double clicks.
const CLICK_TO_EDIT_MS = 200;

export function useIDBCellInteractions(options: {
  table: Table<IDBRecord>;
  readOnly: () => boolean | undefined;
  locallyModifiedData: Ref<Map<string, unknown>>;
  emit: (event: "recordEdit", record: IDBRecord) => void;
  openRowViewer: (row: Row<IDBRecord>) => void;
  copyToClipboard: (text: string) => void | Promise<void>;
}) {
  const { table, readOnly, locallyModifiedData, emit, openRowViewer, copyToClipboard } = options;

  const editingCell = ref<{ rowId: string; columnId: string } | null>(null);
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  function isCellEditable(row: Row<IDBRecord>, columnId: string): boolean {
    if (readOnly()) return false;
    // The key identifies the record — editing it would target a different row.
    if (columnId === "key") return false;
    return !isDeletedChange(row.original);
  }

  function cellValue(row: Row<IDBRecord>, columnId: string): unknown {
    if (columnId === "value") {
      return row.original.value;
    }
    return (row.original.value as Record<string, unknown>)?.[columnId];
  }

  function getCellEditValue(row: Row<IDBRecord>, columnId: string): string {
    const value = cellValue(row, columnId);
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function isDateCell(row: Row<IDBRecord>, columnId: string): boolean {
    const value = cellValue(row, columnId);
    if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(value);
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    if (!/(date|time|at|on|deadline|expiry|expires|timestamp)$/i.test(columnId)) return false;
    return value >= 631_152_000 && value <= 4_102_444_800_000;
  }

  function isNumberCell(row: Row<IDBRecord>, columnId: string): boolean {
    return typeof cellValue(row, columnId) === "number";
  }

  function startCellEdit(row: Row<IDBRecord>, columnId: string) {
    if (!isCellEditable(row, columnId)) return;
    editingCell.value = { rowId: row.id, columnId };
  }

  function handleCellClick(row: Row<IDBRecord>, columnId: string) {
    if (columnId === "__actions") return;

    if (clickTimer !== null) {
      clearTimeout(clickTimer);
      clickTimer = null;
      startCellEdit(row, columnId);
      return;
    }

    clickTimer = setTimeout(() => {
      clickTimer = null;
      openRowViewer(row);
    }, CLICK_TO_EDIT_MS);
  }

  function commitInlineEdit(value: unknown) {
    if (!editingCell.value) return;
    const { rowId, columnId } = editingCell.value;
    const found = table.getRowModel().rows.find((r) => r.id === rowId);
    if (!found) {
      editingCell.value = null;
      return;
    }

    const record: IDBRecord = { ...found.original };
    if (columnId === "value") {
      record.value = value;
    } else {
      record.value = { ...(record.value as Record<string, unknown>), [columnId]: value };
    }

    const beforeValue = found.original.value;
    emit("recordEdit", record);
    const next = new Map(locallyModifiedData.value);
    next.set(recordKeyStr(record.key), beforeValue);
    locallyModifiedData.value = next;
    editingCell.value = null;
  }

  function cancelInlineEdit() {
    editingCell.value = null;
  }

  onUnmounted(() => {
    if (clickTimer !== null) clearTimeout(clickTimer);
  });

  // ─── Row context menu ──────────────────────────────────────────────────────
  // The menu is opened by reka-ui on the row, but the actions are cell-scoped, so
  // remember which cell the right-click landed on.
  const contextColumnId = ref<string | null>(null);

  function onCellContextMenu(columnId: string) {
    // A pending single click would otherwise open the viewer behind the menu.
    if (clickTimer !== null) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    contextColumnId.value = columnId === "__actions" ? null : columnId;
  }

  function contextCellLabel(): string {
    return contextColumnId.value ? `Edit "${contextColumnId.value}"` : "Edit cell";
  }

  function canEditContextCell(row: Row<IDBRecord>): boolean {
    return !!contextColumnId.value && isCellEditable(row, contextColumnId.value);
  }

  function editContextCell(row: Row<IDBRecord>) {
    if (contextColumnId.value) startCellEdit(row, contextColumnId.value);
  }

  function copyContextCell(row: Row<IDBRecord>) {
    if (!contextColumnId.value) return;
    void copyToClipboard(getCellEditValue(row, contextColumnId.value));
  }

  function copyRowAsJson(row: Row<IDBRecord>) {
    void copyToClipboard(JSON.stringify(row.original.value, null, 2));
  }

  return {
    editingCell,
    isCellEditable,
    cellValue,
    getCellEditValue,
    isDateCell,
    isNumberCell,
    handleCellClick,
    startCellEdit,
    commitInlineEdit,
    cancelInlineEdit,
    contextColumnId,
    onCellContextMenu,
    contextCellLabel,
    canEditContextCell,
    editContextCell,
    copyContextCell,
    copyRowAsJson,
  };
}
