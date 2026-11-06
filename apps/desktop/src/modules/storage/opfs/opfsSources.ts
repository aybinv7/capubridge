import {
  OPFS_FOLDER_WALK_DEPTH,
  OPFS_FOLDER_WALK_LIMIT,
  type OPFSFolderNode,
  type OPFSFolderTree,
} from "@capubridge/cdp-protocol";
import { compareText } from "@/shared/format/collator";
import type {
  DataCollectionNode,
  DataSection,
  DataSelection,
} from "@/modules/storage/frame/dataFrame.types";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";

/** The host of an origin, for quiet labels. */
export function hostOf(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

/** A folder path as people write it: no leading, trailing or doubled slashes. */
export function normalizePath(path: string): string {
  return path.split("/").filter(Boolean).join("/");
}

/** The folder that holds `path`; the root holds itself. */
export function parentOf(path: string): string {
  const parts = normalizePath(path).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

/** The last segment of a path, or "OPFS" for the root. */
export function folderLabel(path: string): string {
  const parts = normalizePath(path).split("/");
  return parts[parts.length - 1] || "OPFS";
}

export interface OpfsCrumb {
  label: string;
  path: string;
}

/** The way from the root to `path`: "OPFS", then one crumb per folder. */
export function crumbsOf(path: string): OpfsCrumb[] {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return [
    { label: "OPFS", path: "" },
    ...parts.map((label, index) => ({ label, path: parts.slice(0, index + 1).join("/") })),
  ];
}

/** Every folder strictly above `path`, from the top, plus `path` itself. */
function lineOf(path: string): Set<string> {
  const crumbs = crumbsOf(path);
  return new Set(crumbs.map((crumb) => crumb.path));
}

function childrenByParent(folders: readonly OPFSFolderNode[]): Map<string, OPFSFolderNode[]> {
  const map = new Map<string, OPFSFolderNode[]>();
  for (const folder of folders) {
    if (!folder.path) continue;
    const parent = parentOf(folder.path);
    const list = map.get(parent);
    if (list) list.push(folder);
    else map.set(parent, [folder]);
  }
  for (const list of map.values()) list.sort((left, right) => compareText(left.name, right.name));
  return map;
}

/**
 * The folders the sidebar shows, depth first: the top-level folders and, along the way to the
 * open folder, the folders inside each step, so the tree opens where the person is. A search
 * shows every folder (the sidebar then keeps the matches).
 */
export function visibleFolders(
  folders: readonly OPFSFolderNode[],
  open: string,
  all: boolean,
): OPFSFolderNode[] {
  const children = childrenByParent(folders);
  const line = lineOf(open);
  const out: OPFSFolderNode[] = [];
  const walk = (parent: string) => {
    for (const folder of children.get(parent) ?? []) {
      out.push(folder);
      if (all || line.has(folder.path)) walk(folder.path);
    }
  };
  walk("");
  return out;
}

/**
 * The folder the route points at. `missing` when the walk saw every folder and this one is not
 * among them; while the folders are not known, or the walk stopped early, the listing decides.
 */
export function resolveFolder(
  asked: string,
  tree: OPFSFolderTree | undefined,
): { path: string; missing: string | null } {
  const path = normalizePath(asked);
  if (!path || !tree || !tree.available || tree.truncated) return { path, missing: null };
  if (tree.folders.some((folder) => folder.path === path)) return { path, missing: null };
  return { path, missing: `“${path}” is not in this page's OPFS any more.` };
}

export function selectionOf(origin: string, path: string): DataSelection | null {
  return origin ? { sourceId: origin, collectionId: path || null } : null;
}

export interface OpfsTreeInput {
  tree: OPFSFolderTree | undefined;
  settings: (sourceId: string) => SourceSettings;
  open: string;
  /** Entries in the open folder, from its own read (fresher than the walk). */
  openCount: number | null;
  /** A search is typed in the sidebar. */
  searching: boolean;
}

/** One source, the page's OPFS root, with its folders as an indented tree. */
export function buildOpfsSections(input: OpfsTreeInput): DataSection[] {
  const tree = input.tree;
  if (!tree) return [];
  if (!tree.available) {
    return [
      {
        id: "opfs",
        label: "OPFS",
        sources: [],
        empty: tree.reason ?? "This page has no OPFS: it needs a secure page (https or localhost).",
      },
    ];
  }
  const settings = input.settings(tree.origin);
  const root = tree.folders.find((folder) => folder.path === "");
  const collections: DataCollectionNode[] = visibleFolders(
    tree.folders,
    input.open,
    input.searching,
  ).map((folder) => {
    const count =
      folder.path === input.open && input.openCount !== null
        ? input.openCount
        : folder.files + folder.folders;
    return {
      id: folder.path,
      label: folder.name,
      count,
      depth: folder.depth - 1,
      pinned: settings.pinnedItems.includes(folder.path),
      hidden: settings.hiddenItems.includes(folder.path),
    };
  });
  const notes = [
    root && root.files + root.folders === 0 ? "Empty: the app has stored nothing here yet" : "",
    tree.truncated
      ? `Folders past the first ${OPFS_FOLDER_WALK_LIMIT}, or ${OPFS_FOLDER_WALK_DEPTH} levels down, are not listed`
      : "",
  ].filter(Boolean);
  return [
    {
      id: "opfs",
      label: "OPFS",
      sources: [
        {
          id: tree.origin,
          label: "This page",
          detail: hostOf(tree.origin),
          provenance: "live",
          expanded: settings.expanded,
          pinned: settings.pinned,
          hidden: settings.hidden,
          ordered: true,
          collections,
          ...(notes.length > 0 ? { note: notes.join(" · ") } : {}),
        },
      ],
    },
  ];
}
