import { Copy, Eye, EyeOff, Pin, PinOff, RefreshCw, Trash2 } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import type { DataAction, DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import type { useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";

export interface OpfsTreeContext {
  scope: string;
  settings: ReturnType<typeof useDataSidebarSettings>;
  /** Why deletes cannot run now, or `null`. */
  blockedReason: string | null;
  /** Opens a folder, then runs a folder action on it. */
  openFolder: (path: string, then?: "refresh" | "delete") => void;
  refreshAll: () => void;
}

/** The menu of a sidebar row: the root reads again and copies its origin; a folder has its own. */
export function opfsTreeActions(row: DataTreeRow, context: OpfsTreeContext): DataAction[] {
  if (row.kind === "source") {
    return [
      { id: "refresh", label: "Read again", icon: RefreshCw },
      { id: "copy-origin", label: "Copy the origin", icon: Copy, separatorBefore: true },
    ];
  }
  if (row.kind !== "collection") return [];
  return [
    { id: "refresh", label: "Read again", icon: RefreshCw },
    { id: "copy-path", label: "Copy the path", icon: Copy },
    {
      id: "pin",
      label: row.collection.pinned ? "Unpin" : "Pin to the top",
      icon: row.collection.pinned ? PinOff : Pin,
      separatorBefore: true,
    },
    {
      id: "hide",
      label: row.collection.hidden ? "Show in the list" : "Hide from the list",
      icon: row.collection.hidden ? Eye : EyeOff,
    },
    {
      id: "delete",
      label: "Delete the folder…",
      icon: Trash2,
      danger: true,
      separatorBefore: true,
      disabled: context.blockedReason !== null,
      ...(context.blockedReason ? { reason: context.blockedReason } : {}),
    },
  ];
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied the ${what}`);
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

export function runOpfsTreeAction(actionId: string, row: DataTreeRow, context: OpfsTreeContext) {
  const { settings, scope } = context;
  if (row.kind === "source") {
    if (actionId === "refresh") context.refreshAll();
    else if (actionId === "copy-origin") void copyText(row.source.id, "origin");
    return;
  }
  if (row.kind !== "collection") return;
  const path = row.collection.id;
  if (actionId === "pin") settings.toggleItemPinned(scope, row.source.id, path);
  else if (actionId === "hide") settings.toggleItemHidden(scope, row.source.id, path);
  else if (actionId === "copy-path") void copyText(`/${path}`, "path");
  else if (actionId === "refresh") context.openFolder(path, "refresh");
  else if (actionId === "delete") context.openFolder(path, "delete");
}
