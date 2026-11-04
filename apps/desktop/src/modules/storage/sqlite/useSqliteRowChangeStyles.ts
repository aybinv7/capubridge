import { Plus, Pencil, Trash2 } from "lucide-vue-next";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import type { SqliteChangeOperation, SqliteRecordChange } from "@/types/sqliteChanges.types";
import { buildRowKey } from "@/modules/storage/changes/sqliteRowKey";
import type { RowRecord } from "./useSqliteAdvancedFilters";

interface UseSqliteRowChangeStylesOptions {
  changesByRowKey: () => Map<string, SqliteRecordChange> | undefined;
  rowKeyResolver: () => ((record: Record<string, unknown>) => string) | undefined;
  pkColumns: () => SqliteColumnInfo[];
}

export function useSqliteRowChangeStyles(options: UseSqliteRowChangeStylesOptions) {
  function rowChangeFor(record: Record<string, unknown>): SqliteRecordChange | null {
    const map = options.changesByRowKey();
    if (!map) return null;
    const key = options.rowKeyResolver()?.(record) ?? buildRowKey(options.pkColumns(), record);
    if (!key) return null;
    return map.get(key) ?? null;
  }

  function rowChangeOperation(record: Record<string, unknown>): SqliteChangeOperation | null {
    return rowChangeFor(record)?.operation ?? null;
  }

  /** A row shown only because it was deleted — it has no counterpart in the table. */
  function isDeletedGhost(record: Record<string, unknown>): boolean {
    return rowChangeOperation(record) === "delete";
  }

  /** Single mutually-exclusive row background, matching the IndexedDB table.
   *  Returned as one string rather than a class object so two bg-* utilities
   *  can't land on the same element and race on rule order. */
  function rowChangeClass(record: Record<string, unknown>): string {
    const operation = rowChangeOperation(record);
    if (operation === "add") return "bg-success/4";
    if (operation === "update") return "bg-warning/4";
    if (operation === "delete") return "bg-error/4 opacity-75";
    return "";
  }

  /** Background for pinned cells, which sit above the row and need their own
   *  opaque fill or the columns behind them show through while scrolling. */
  function stickyRowBg(record: Record<string, unknown>, isSelected: boolean): string {
    if (isSelected) return "bg-surface-3";
    const operation = rowChangeOperation(record);
    if (operation === "add") return "bg-success/[0.04]";
    if (operation === "update") return "bg-warning/[0.04]";
    if (operation === "delete") return "bg-error/[0.04]";
    return "bg-background";
  }

  function changeIndicatorClass(record: Record<string, unknown>): string {
    const operation = rowChangeOperation(record);
    if (operation === "add") return "bg-success/15 text-success ring-success/30";
    if (operation === "update") return "bg-warning/15 text-warning ring-warning/30";
    if (operation === "delete") return "bg-error/15 text-error ring-error/30";
    return "";
  }

  function changeIcon(record: Record<string, unknown>) {
    const operation = rowChangeOperation(record);
    if (operation === "add") return Plus;
    if (operation === "update") return Pencil;
    if (operation === "delete") return Trash2;
    return null;
  }

  return {
    rowChangeFor,
    rowChangeOperation,
    isDeletedGhost,
    rowChangeClass,
    stickyRowBg,
    changeIndicatorClass,
    changeIcon,
  };
}

export type UseSqliteRowChangeStyles = ReturnType<typeof useSqliteRowChangeStyles>;
export type { RowRecord };
