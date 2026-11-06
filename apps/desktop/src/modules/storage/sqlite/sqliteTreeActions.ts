import {
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileCode,
  FileUp,
  FolderOpen,
  Pin,
  PinOff,
  RefreshCw,
  Table2,
  Trash2,
  X,
} from "lucide-vue-next";
import type { SqliteDbFile } from "@/types/sqlite.types";
import type { DataAction, DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import { canWriteDatabase } from "./browse/sqliteWriteAccess";

export type SqliteSourceActionId =
  | "refresh"
  | "pin"
  | "hide"
  | "export-file"
  | "export-dump"
  | "import-dump"
  | "clear-marks"
  | "show-in-opfs"
  | "close-file";

export type SqliteTableActionId = "pin" | "hide" | "clear-marks" | "clear-rows" | "drop-table";

export interface SqliteTreeActionContext {
  /** The database behind a sidebar source id. */
  databaseOf: (sourceId: string) => SqliteDbFile | null;
  /** Why a database cannot be read right now (so not exported), or `null`. */
  unreadableReason: (db: SqliteDbFile) => string | null;
  /** The database that is open, to offer "Read again" on it. */
  openSourceId: string | null;
}

function hasChanges(changes: { total: number } | undefined): boolean {
  return (changes?.total ?? 0) > 0;
}

function exportActions(db: SqliteDbFile, context: SqliteTreeActionContext): DataAction[] {
  const reason = context.unreadableReason(db);
  const blocked = reason ? { disabled: true, reason } : {};
  return [
    {
      id: "export-file",
      label: "Save a copy of the file…",
      icon: Download,
      separatorBefore: true,
      ...blocked,
    },
    { id: "export-dump", label: "Save as SQL…", icon: FileCode, ...blocked },
  ];
}

/**
 * The menu of a sidebar row. Only a file opened on this computer offers anything that changes
 * data, and each row decides from its own database, never from the one that is open (M1):
 * a phone or page database is a pulled copy, so it is never cleared, replaced or deleted here.
 */
export function sqliteTreeActions(
  row: DataTreeRow,
  context: SqliteTreeActionContext,
): DataAction[] {
  if (row.kind !== "source" && row.kind !== "collection") return [];
  const db = context.databaseOf(row.source.id);
  if (!db) return [];
  const writable = canWriteDatabase(db);

  if (row.kind === "collection") {
    const collection = row.collection;
    return [
      {
        id: "pin",
        label: collection.pinned ? "Unpin" : "Pin to the top",
        icon: collection.pinned ? PinOff : Pin,
      },
      {
        id: "hide",
        label: collection.hidden ? "Show in the list" : "Hide from the list",
        icon: collection.hidden ? Eye : EyeOff,
      },
      {
        id: "clear-marks",
        label: "Forget the change marks",
        icon: Eraser,
        disabled: !hasChanges(collection.changes),
      },
      ...(writable
        ? [
            {
              id: "clear-rows",
              label: "Delete every row…",
              icon: Table2,
              danger: true,
              separatorBefore: true,
            },
            { id: "drop-table", label: "Drop the table…", icon: Trash2, danger: true },
          ]
        : []),
    ];
  }

  const source = row.source;
  const actions: DataAction[] = [];
  if (context.openSourceId === source.id) {
    actions.push({ id: "refresh", label: "Read again", icon: RefreshCw });
  }
  actions.push(
    {
      id: "pin",
      label: source.pinned ? "Unpin" : "Pin to the top",
      icon: source.pinned ? PinOff : Pin,
      separatorBefore: actions.length > 0,
    },
    {
      id: "hide",
      label: source.hidden ? "Show in the list" : "Hide from the list",
      icon: source.hidden ? Eye : EyeOff,
    },
    ...exportActions(db, context),
  );
  if (writable) {
    actions.push({ id: "import-dump", label: "Replace with an SQL file…", icon: FileUp });
  }
  actions.push({
    id: "clear-marks",
    label: "Forget the change marks",
    icon: Eraser,
    disabled: !hasChanges(source.changes),
    separatorBefore: true,
  });
  if (db.sourceKind === "opfs" && db.sourceOpfsDirectory !== undefined) {
    actions.push({ id: "show-in-opfs", label: "Show in OPFS", icon: FolderOpen });
  }
  if (db.sourceKind === "imported") {
    actions.push({ id: "close-file", label: "Close the file", icon: X, separatorBefore: true });
  }
  return actions;
}
