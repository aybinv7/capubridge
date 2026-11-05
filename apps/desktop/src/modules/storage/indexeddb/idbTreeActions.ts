import {
  Download,
  Eraser,
  Eye,
  EyeOff,
  FolderInput,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-vue-next";
import type { IDBDatabaseInfo } from "@capubridge/cdp-protocol";
import type { DataAction, DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import type { useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import type { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { FILE_PREFIX, liveSourceId } from "./idbTreeModel";
import type { useIdbDatabaseActions } from "./useIdbDatabaseActions";
import type { IdbSnapshotEntry } from "./useIdbSnapshotStore";

export interface IdbTreeContext {
  scope: string;
  live: readonly IDBDatabaseInfo[];
  files: readonly IdbSnapshotEntry[];
  settings: ReturnType<typeof useDataSidebarSettings>;
  changes: ReturnType<typeof useIndexedDBChangesStore>;
  actions: ReturnType<typeof useIdbDatabaseActions>;
}

function liveDb(sourceId: string, context: IdbTreeContext) {
  return context.live.find((db) => liveSourceId(db) === sourceId);
}

function fileOf(sourceId: string, context: IdbTreeContext) {
  return sourceId.startsWith(FILE_PREFIX)
    ? context.files.find((entry) => entry.id === sourceId.slice(FILE_PREFIX.length))
    : undefined;
}

/** The menu of a sidebar row (and of the open database or store header). */
export function idbTreeActions(row: DataTreeRow, context: IdbTreeContext): DataAction[] {
  if (row.kind === "source") {
    if (fileOf(row.source.id, context)) {
      return [
        { id: "file.save", label: "Save a copy…", icon: Download },
        { id: "file.close", label: "Close the file", icon: X, separatorBefore: true },
      ];
    }
    const changed = (row.source.changes?.total ?? 0) > 0;
    return [
      {
        id: "pin",
        label: row.source.pinned ? "Unpin" : "Pin to the top",
        icon: row.source.pinned ? PinOff : Pin,
      },
      {
        id: "hide",
        label: row.source.hidden ? "Show in the list" : "Hide from the list",
        icon: row.source.hidden ? Eye : EyeOff,
      },
      { id: "db.export", label: "Export the database…", icon: Download, separatorBefore: true },
      { id: "db.replace", label: "Replace it from an export…", icon: FolderInput },
      {
        id: "db.clear-changes",
        label: "Forget the change marks",
        icon: Eraser,
        disabled: !changed,
        reason: "No changes seen",
        separatorBefore: true,
      },
      {
        id: "db.delete",
        label: "Delete the database…",
        icon: Trash2,
        danger: true,
        separatorBefore: true,
      },
    ];
  }
  if (row.kind !== "collection" || fileOf(row.source.id, context)) return [];
  const changed = (row.collection.changes?.total ?? 0) > 0;
  return [
    {
      id: "store.pin",
      label: row.collection.pinned ? "Unpin" : "Pin to the top",
      icon: row.collection.pinned ? PinOff : Pin,
    },
    {
      id: "store.hide",
      label: row.collection.hidden ? "Show in the list" : "Hide from the list",
      icon: row.collection.hidden ? Eye : EyeOff,
    },
    {
      id: "store.clear-changes",
      label: "Forget the change marks",
      icon: Eraser,
      disabled: !changed,
      reason: "No changes seen",
      separatorBefore: true,
    },
    {
      id: "store.clear",
      label: "Clear all records…",
      icon: Eraser,
      danger: true,
      separatorBefore: true,
    },
    { id: "store.delete", label: "Delete the store…", icon: Trash2, danger: true },
  ];
}

/** Runs a sidebar or header action. Destructive ones ask first (inside the actions). */
export function runIdbTreeAction(actionId: string, row: DataTreeRow, context: IdbTreeContext) {
  if (row.kind !== "source" && row.kind !== "collection") return;
  const sourceId = row.source.id;
  const { settings, scope, actions } = context;
  const file = fileOf(sourceId, context);
  if (file) {
    if (actionId === "file.save") void actions.exportFile(file);
    else if (actionId === "file.close") actions.closeFile(file);
    return;
  }
  const db = liveDb(sourceId, context);
  if (!db) return;
  const store = row.kind === "collection" ? row.collection.id : "";
  switch (actionId) {
    case "pin":
      settings.togglePinned(scope, sourceId);
      break;
    case "hide":
      settings.toggleHidden(scope, sourceId);
      break;
    case "db.export":
      void actions.exportLive(db);
      break;
    case "db.replace":
      void actions.replaceFromFile(db);
      break;
    case "db.clear-changes":
      context.changes.clearDatabaseChanges(db.origin, db.name);
      break;
    case "db.delete":
      actions.deleteDatabase(db);
      break;
    case "store.pin":
      settings.toggleItemPinned(scope, sourceId, store);
      break;
    case "store.hide":
      settings.toggleItemHidden(scope, sourceId, store);
      break;
    case "store.clear-changes":
      context.changes.clearStoreChanges(db.origin, db.name, store);
      break;
    case "store.clear":
      actions.clearStore(db, store);
      break;
    case "store.delete":
      actions.deleteStore(db, store);
      break;
  }
}
