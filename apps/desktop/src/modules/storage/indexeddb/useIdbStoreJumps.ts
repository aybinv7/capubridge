import { Table2 } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import type { IdbMode } from "./useIdbLocation";

interface IdbJumpDeps {
  database: () => { mode: IdbMode; id: string; name: string; storeNames: readonly string[] } | null;
  openStore: (mode: IdbMode, id: string, store: string) => void;
}

/**
 * Lists the open IndexedDB database's object stores for the palette's `#` mode (and for a plain
 * search), each opening that store. Offered only while the IndexedDB tab has a database open.
 */
export function useIdbStoreJumps(deps: IdbJumpDeps) {
  useCommandProvider("jump.indexeddb", (): Command[] => {
    const open = deps.database();
    if (!open) return [];
    return open.storeNames.map((store) => ({
      id: `table.idb.${open.mode}.${open.id}.${store}`,
      title: store,
      group: "Data",
      section: "tables",
      dormant: true,
      icon: Table2,
      detail: `${open.name} · object store`,
      keywords: ["indexeddb", "store", "table", open.name],
      run: () => deps.openStore(open.mode, open.id, store),
    }));
  });
}
