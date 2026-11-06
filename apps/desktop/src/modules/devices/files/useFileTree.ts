import { computed, ref, shallowRef, triggerRef, type Ref } from "vue";
import { toast } from "@/lib/toast";
import { invokeCommand } from "@/runtime/ipc/client";
import type { FileEntry } from "@/types/adb.types";
import { compareText } from "@/shared/format/collator";
import { ancestorPaths, fileNameFromPath, isFolderEntry, joinPath } from "./filePaths";

export interface TreeRow {
  path: string;
  label: string;
  depth: number;
  loading: boolean;
  expanded: boolean;
}

/**
 * The folder tree beside the listing: children load the first time a folder is expanded, and the
 * listing of the open folder is reused instead of asking the phone twice.
 */
export function useFileTree(serial: Ref<string>) {
  const expanded = ref(new Set<string>(["/"]));
  const contents = shallowRef(new Map<string, FileEntry[]>());
  const loading = ref(new Set<string>());

  function remember(path: string, entries: FileEntry[]) {
    contents.value.set(path, entries);
    triggerRef(contents);
  }

  /**
   * Reads a folder again. Its branch stays as it was until the new listing arrives, so a refresh
   * never empties the tree; a failed read keeps the old branch.
   */
  async function reload(path: string, read: () => Promise<FileEntry[] | undefined>) {
    const next = await read();
    if (next) remember(path, next);
  }

  async function load(path: string) {
    if (!serial.value || loading.value.has(path) || contents.value.has(path)) return;
    loading.value.add(path);
    try {
      remember(path, await invokeCommand("adb_list_dir", { serial: serial.value, path }));
    } catch (error) {
      remember(path, []);
      toast.error("Could not open a folder in the tree", { description: String(error) });
    } finally {
      loading.value.delete(path);
    }
  }

  async function revealPath(path: string) {
    for (const folder of ancestorPaths(path)) {
      expanded.value.add(folder);
      await load(folder);
    }
  }

  async function toggle(path: string) {
    if (expanded.value.has(path)) {
      expanded.value.delete(path);
      return;
    }
    expanded.value.add(path);
    await load(path);
  }

  function reset() {
    expanded.value = new Set(["/"]);
    contents.value = new Map();
  }

  const rows = computed<TreeRow[]>(() => {
    const out: TreeRow[] = [];
    const walk = (paths: string[], depth: number) => {
      for (const path of paths) {
        const isOpen = expanded.value.has(path);
        out.push({
          path,
          label: fileNameFromPath(path),
          depth,
          loading: loading.value.has(path),
          expanded: isOpen,
        });
        const children = isOpen ? contents.value.get(path) : undefined;
        if (!children) continue;
        walk(
          children
            .filter(isFolderEntry)
            .map((entry) => entry.name)
            .sort(compareText)
            .map((name) => joinPath(path, name)),
          depth + 1,
        );
      }
    };
    walk(["/"], 0);
    return out;
  });

  return { rows, remember, reload, revealPath, toggle, reset };
}
