import { Copy, Eye, EyeOff, Pin, PinOff, Plus, RefreshCw } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import type { DataAction, DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import type { useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";

export interface KvTreeContext {
  scope: string;
  settings: ReturnType<typeof useDataSidebarSettings>;
  /** Whether writes can run now (the app is on screen). */
  canWrite: boolean;
  /** Opens a list, then runs a list action on it. */
  openList: (origin: string, collectionId: string, then?: "refresh" | "new-key") => void;
}

/** The menu of a sidebar row: pin and hide for both, the origin's address, a list's own actions. */
export function kvTreeActions(row: DataTreeRow, context: KvTreeContext): DataAction[] {
  if (row.kind === "source") {
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
      { id: "copy-origin", label: "Copy the origin", icon: Copy, separatorBefore: true },
    ];
  }
  if (row.kind !== "collection") return [];
  return [
    { id: "refresh", label: "Read again", icon: RefreshCw },
    {
      id: "new-key",
      label: "New key…",
      icon: Plus,
      disabled: !context.canWrite,
      reason: "The app is away from the screen",
    },
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

export function runKvTreeAction(actionId: string, row: DataTreeRow, context: KvTreeContext) {
  const { settings, scope } = context;
  if (row.kind === "source") {
    if (actionId === "pin") settings.togglePinned(scope, row.source.id);
    else if (actionId === "hide") settings.toggleHidden(scope, row.source.id);
    else if (actionId === "copy-origin") void copyOrigin(row.source.id);
    return;
  }
  if (row.kind !== "collection") return;
  const id = row.collection.id;
  if (actionId === "pin") settings.toggleItemPinned(scope, row.source.id, id);
  else if (actionId === "hide") settings.toggleItemHidden(scope, row.source.id, id);
  else if (actionId === "refresh") context.openList(row.source.id, id, "refresh");
  else if (actionId === "new-key") context.openList(row.source.id, id, "new-key");
}
