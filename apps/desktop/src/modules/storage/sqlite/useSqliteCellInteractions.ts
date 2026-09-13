import { ref, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import type { Row, Table } from "@tanstack/vue-table";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import { useSqliteColumnEditors } from "./useSqliteColumnEditors";
import { type SqliteEditorKind, detectEditorKind, toEditorString } from "./cellEditorTypes";
import type { RowRecord } from "./useSqliteAdvancedFilters";

/**
 * One click opens the row viewer, a second click within the window edits the
 * cell in place.
 *
 * The short window is load-bearing, not a stylistic choice: the viewer is a
 * centered modal, so the moment it opens its overlay covers the table and the
 * second click lands on the overlay instead of the cell. Waiting lets us tell
 * the two gestures apart before anything covers the row. Anything under ~180ms
 * starts losing genuine double clicks.
 *
 * The write side differs from IndexedDB. There a record is replaced wholesale;
 * here the edit becomes `UPDATE <table> SET <col> = ? WHERE <pk> = ?`, which is
 * why primary-key columns stay read-only (they're the WHERE clause) and why
 * tables without a primary key can't be edited at all.
 */
const CLICK_TO_EDIT_MS = 200;

interface UseSqliteCellInteractionsOptions {
  table: Table<RowRecord>;
  dbName: () => string;
  tableName: () => string;
  columnInfo: () => SqliteColumnInfo[] | undefined;
  pkColumnNames: () => Set<string>;
  rawTableData: () => RowRecord[];
  canEditRows: () => boolean;
  readOnly: () => boolean | undefined;
  isDeletedGhost: (record: RowRecord) => boolean;
  copyToClipboard: (text: string) => void | Promise<void>;
  openRowDetail: (record: RowRecord, rowIndex?: number) => void;
  onEdit: (original: RowRecord, updated: Record<string, unknown>) => void;
}

export function useSqliteCellInteractions(options: UseSqliteCellInteractionsOptions) {
  const editingCell = ref<{
    rowId: string;
    columnId: string;
  } | null>(null);
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  const { getOverride, setOverride, clearOverride } = useSqliteColumnEditors();

  function columnInfoFor(columnId: string): SqliteColumnInfo | undefined {
    return (options.columnInfo() ?? []).find((c) => c.name === columnId);
  }

  /**
   * Detection needs a real value to sniff, and the clicked row's cell may be
   * NULL. Fall back to the first non-null value in the column so a NULL date
   * still gets a date picker.
   */
  function sampleValueFor(columnId: string, preferred: unknown): unknown {
    if (preferred !== null && preferred !== undefined) return preferred;
    for (const record of options.rawTableData()) {
      const v = record[columnId];
      if (v !== null && v !== undefined) return v;
    }
    return preferred;
  }

  function editorKindFor(columnId: string, value: unknown): SqliteEditorKind {
    const override = getOverride(options.dbName(), options.tableName(), columnId);
    if (override) return override;
    return detectEditorKind(columnInfoFor(columnId), sampleValueFor(columnId, value));
  }

  /** What "Auto" would pick for this column, shown next to the Auto menu entry. */
  function detectedKindLabel(columnId: string): SqliteEditorKind {
    return detectEditorKind(columnInfoFor(columnId), sampleValueFor(columnId, null));
  }

  function isCellEditable(record: RowRecord, columnId: string): boolean {
    if (!options.canEditRows()) return false;
    if (columnId === "__select") return false;
    // Primary-key columns identify the row in the WHERE clause; changing one
    // would rewrite a different row than the one on screen.
    if (options.pkColumnNames().has(columnId)) return false;
    return !options.isDeletedGhost(record);
  }

  function getCellEditValue(record: RowRecord, columnId: string): string {
    return toEditorString(record[columnId]);
  }

  function openRowViewer(row: Row<RowRecord>) {
    const rows = options.table.getFilteredRowModel().rows;
    const idx = rows.findIndex((r) => r.id === row.id);
    options.openRowDetail(row.original, idx >= 0 ? idx : undefined);
  }

  function handleCellClick(row: Row<RowRecord>, columnId: string) {
    if (columnId === "__select") return;

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

  function startCellEdit(row: Row<RowRecord>, columnId: string) {
    if (columnId === "__select") return;
    if (!options.canEditRows()) {
      // Say why rather than doing nothing — a dead double click reads as a bug.
      toast.error("Cannot edit", {
        description: options.readOnly()
          ? "This view is read-only."
          : "No column info for this table, so rows can't be identified.",
      });
      return;
    }
    if (options.isDeletedGhost(row.original)) {
      toast.info("Row deleted", { description: "This row no longer exists in the table." });
      return;
    }
    if (options.pkColumnNames().has(columnId)) {
      toast.info("Primary key", {
        description: `"${columnId}" identifies the row and can't be edited.`,
      });
      return;
    }
    editingCell.value = { rowId: row.id, columnId };
  }

  function isEditing(rowId: string, columnId: string): boolean {
    return editingCell.value?.rowId === rowId && editingCell.value?.columnId === columnId;
  }

  function commitInlineEdit(next: unknown) {
    if (!editingCell.value) return;
    const { rowId, columnId } = editingCell.value;
    const found = options.table.getRowModel().rows.find((r) => r.id === rowId);
    editingCell.value = null;
    if (!found) return;

    const original = found.original;
    // Skip the UPDATE when nothing actually changed.
    if (JSON.stringify(original[columnId] ?? null) === JSON.stringify(next ?? null)) return;

    options.onEdit(original, { ...original, [columnId]: next });
  }

  function cancelInlineEdit() {
    editingCell.value = null;
  }

  onUnmounted(() => {
    if (clickTimer !== null) clearTimeout(clickTimer);
  });

  // ─── Row context menu ──────────────────────────────────────────────────────
  // The menu is opened by reka-ui on the row, but the actions are cell-scoped,
  // so remember which cell the right-click landed on.
  const contextColumnId = ref<string | null>(null);

  function onCellContextMenu(columnId: string) {
    // A pending single click would otherwise open the viewer behind the menu.
    if (clickTimer !== null) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    contextColumnId.value = columnId === "__select" ? null : columnId;
  }

  function contextCellLabel(): string {
    return contextColumnId.value ? `Edit "${contextColumnId.value}"` : "Edit cell";
  }

  function canEditContextCell(record: RowRecord): boolean {
    return !!contextColumnId.value && isCellEditable(record, contextColumnId.value);
  }

  function editContextCell(row: Row<RowRecord>) {
    if (contextColumnId.value) startCellEdit(row, contextColumnId.value);
  }

  function copyContextCell(record: RowRecord) {
    if (!contextColumnId.value) return;
    void options.copyToClipboard(getCellEditValue(record, contextColumnId.value));
  }

  function copyRowAsJson(record: RowRecord) {
    void options.copyToClipboard(JSON.stringify(record, null, 2));
  }

  return {
    editingCell,
    isEditing,
    columnInfoFor,
    editorKindFor,
    detectedKindLabel,
    isCellEditable,
    getCellEditValue,
    handleCellClick,
    startCellEdit,
    commitInlineEdit,
    cancelInlineEdit,
    openRowViewer,
    contextColumnId,
    onCellContextMenu,
    contextCellLabel,
    canEditContextCell,
    editContextCell,
    copyContextCell,
    copyRowAsJson,
    getOverride,
    setOverride,
    clearOverride,
  };
}
