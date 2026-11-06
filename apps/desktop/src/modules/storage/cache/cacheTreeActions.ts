import { Copy, Eye, EyeOff, Pin, PinOff, RefreshCw, Trash2 } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import type { DataAction, DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import type { useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";

export interface CacheTreeContext {
  scope: string;
  settings: ReturnType<typeof useDataSidebarSettings>;
  /** Why deletes cannot run now, or `null`. */
  blockedReason: string | null;
  /** Opens a cache, then runs a cache action on it. */
  openCache: (name: string, then?: "refresh" | "delete") => void;
  refreshAll: () => void;
}

/** The menu of a sidebar row: the page's address and reading again; a cache's own actions. */
export function cacheTreeActions(row: DataTreeRow, context: CacheTreeContext): DataAction[] {
  if (row.kind === "source") {
    return [
      { id: "refresh", label: "Read again", icon: RefreshCw },
      { id: "copy-origin", label: "Copy the origin", icon: Copy, separatorBefore: true },
    ];
  }
  if (row.kind !== "collection") return [];
  return [
    { id: "refresh", label: "Read again", icon: RefreshCw },
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
      label: "Delete the cache…",
      icon: Trash2,
      danger: true,
      separatorBefore: true,
      disabled: context.blockedReason !== null,
      ...(context.blockedReason ? { reason: context.blockedReason } : {}),
    },
  ];
}

async function copyOrigin(origin: string) {
  try {
    await navigator.clipboard.writeText(origin);
    toast.success("Copied the origin");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

export function runCacheTreeAction(actionId: string, row: DataTreeRow, context: CacheTreeContext) {
  const { settings, scope } = context;
  if (row.kind === "source") {
    if (actionId === "refresh") context.refreshAll();
    else if (actionId === "copy-origin") void copyOrigin(row.source.id);
    return;
  }
  if (row.kind !== "collection") return;
  const id = row.collection.id;
  if (actionId === "pin") settings.toggleItemPinned(scope, row.source.id, id);
  else if (actionId === "hide") settings.toggleItemHidden(scope, row.source.id, id);
  else if (actionId === "refresh") context.openCache(id, "refresh");
  else if (actionId === "delete") context.openCache(id, "delete");
}
