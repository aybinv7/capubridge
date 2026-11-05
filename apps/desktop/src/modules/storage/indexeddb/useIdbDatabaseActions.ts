import type { Ref } from "vue";
import { toast } from "vue-sonner";
import { IDBDomain, IdbBlockedError, type IDBDatabaseInfo } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import {
  exportDatabase,
  importDatabaseReplace,
  pickIdbExport,
  saveIdbExportToFile,
  type PickedIdbExport,
} from "./idbImportExport";
import { transferToast } from "./idbTransferToasts";
import { useIdbSnapshotStore, type IdbSnapshotEntry } from "./useIdbSnapshotStore";
import type { IdbMode } from "./useIdbLocation";

interface Dependencies {
  targetId: Ref<string>;
  ask: (request: ConfirmRequest, run: () => Promise<void> | void) => void;
  openLocation: (mode: IdbMode, id: string, store?: string) => void;
  replaceRoot: (mode?: IdbMode) => void;
  current: () => { mode: IdbMode; database: string; store: string };
  refetchDatabases: () => unknown;
  refetchStoreInfo: () => unknown;
  refetchRecords: () => unknown;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Database and store actions of the IndexedDB tab: export, replace from a file, open a file,
 * clear, delete. Each destructive one asks first; each reports what the phone answered,
 * including when the app keeps the database open (blocked).
 */
export function useIdbDatabaseActions(deps: Dependencies) {
  const { getClient } = useCDP();
  const files = useIdbSnapshotStore();

  function client() {
    const found = getClient(deps.targetId.value);
    if (!found)
      toast.error("The app is not connected", { description: "Reconnect it and try again." });
    return found;
  }

  function reportBlocked(error: IdbBlockedError, title: string) {
    toast.warning(title, { description: error.message, duration: 10000 });
  }

  async function exportLive(db: IDBDatabaseInfo) {
    const cdp = client();
    if (!cdp) return;
    const progress = transferToast(`Exporting "${db.name}"`);
    try {
      const data = await exportDatabase(cdp, db.origin, db.name, {
        onProgress: progress.progress,
        signal: progress.signal,
      });
      const saved = await saveIdbExportToFile(data, `${db.name}.idb`);
      if (!saved) {
        progress.dismiss();
        return;
      }
      const loss = data.lossy ?? [];
      progress.done(
        `Exported "${db.name}"`,
        loss.length ? `${saved} · ${loss.length} value(s) could not be saved exactly` : saved,
      );
    } catch (error) {
      progress.failed(error, `Could not export "${db.name}"`);
    }
  }

  async function exportFile(entry: IdbSnapshotEntry) {
    try {
      const saved = await saveIdbExportToFile(entry.data, `${entry.data.database.name}.idb`);
      if (saved)
        toast.success(`Saved a copy of "${entry.data.database.name}"`, { description: saved });
    } catch (error) {
      toast.error("Could not save the copy", { description: message(error) });
    }
  }

  async function pick(): Promise<PickedIdbExport | null> {
    try {
      return await pickIdbExport();
    } catch (error) {
      toast.error("Could not read that file", { description: message(error) });
      return null;
    }
  }

  /** Opens an export read-only under "Opened files". */
  async function openExport() {
    const picked = await pick();
    if (!picked) return;
    const entry = files.addSnapshot(picked.path, picked.data, picked.lossy);
    toast.success(`Opened "${picked.data.database.name}" from ${fileName(picked.path)}`, {
      description: "Read-only. It stays open until Capubridge closes.",
    });
    deps.openLocation("file", entry.id);
  }

  async function replace(db: IDBDatabaseInfo, picked: PickedIdbExport, acceptLoss: boolean) {
    const cdp = client();
    if (!cdp) return;
    const progress = transferToast(`Replacing "${db.name}"`);
    try {
      const result = await importDatabaseReplace(cdp, picked.data, db.name, {
        onProgress: progress.progress,
        signal: progress.signal,
        acceptLoss,
      });
      progress.done(
        `Replaced "${db.name}"`,
        `${result.inserted.toLocaleString("en-US")} records written`,
      );
    } catch (error) {
      if (error instanceof IdbBlockedError) {
        progress.dismiss();
        reportBlocked(error, `"${db.name}" was not replaced`);
      } else progress.failed(error, `Could not replace "${db.name}"`);
    } finally {
      void deps.refetchDatabases();
      void deps.refetchStoreInfo();
      void deps.refetchRecords();
    }
  }

  /** Replaces the database the person chose (not the one named in the file) with an export. */
  async function replaceFromFile(db: IDBDatabaseInfo) {
    const picked = await pick();
    if (!picked) return;
    const stores = picked.data.database.stores;
    const records = stores.reduce((sum, store) => sum + store.records.length, 0);
    const from = fileName(picked.path);
    const named =
      picked.data.database.name === db.name
        ? ""
        : ` The file was exported from "${picked.data.database.name}".`;
    const lossy = picked.lossy.length > 0;
    deps.ask(
      {
        title: `Replace "${db.name}" on the phone?`,
        text: lossy
          ? `${picked.lossy[0]} Replacing writes that loss back to the phone: everything in "${db.name}" is deleted, then ${stores.length} stores and ${records.toLocaleString("en-US")} records from ${from} are written.${named}`
          : `Everything in "${db.name}" is deleted, then ${stores.length} stores and ${records.toLocaleString("en-US")} records from ${from} are written. This cannot be undone.${named}`,
        confirmLabel: lossy ? "Replace anyway" : "Replace",
        danger: true,
      },
      () => replace(db, picked, lossy),
    );
  }

  function domain(): IDBDomain | null {
    const cdp = client();
    return cdp ? new IDBDomain(cdp) : null;
  }

  function deleteDatabase(db: IDBDatabaseInfo) {
    deps.ask(
      {
        title: `Delete "${db.name}"?`,
        text: `The database and all ${db.objectStoreNames.length} of its stores are deleted from the phone. This cannot be undone.`,
        confirmLabel: "Delete database",
        danger: true,
      },
      async () => {
        const idb = domain();
        if (!idb) return;
        try {
          await idb.deleteDatabase(db.origin, db.name);
          toast.success(`Deleted "${db.name}" on the phone`);
          const here = deps.current();
          if (here.mode === "live" && here.database === db.name) deps.replaceRoot("live");
        } catch (error) {
          if (error instanceof IdbBlockedError)
            reportBlocked(error, `"${db.name}" is not deleted yet`);
          else toast.error(`Could not delete "${db.name}"`, { description: message(error) });
        } finally {
          void deps.refetchDatabases();
        }
      },
    );
  }

  function clearStore(db: IDBDatabaseInfo, store: string) {
    deps.ask(
      {
        title: `Clear "${store}"?`,
        text: `Every record in "${store}" is deleted from the phone. The store itself stays. This cannot be undone.`,
        confirmLabel: "Clear all records",
        danger: true,
      },
      async () => {
        const idb = domain();
        if (!idb) return;
        try {
          await idb.clearObjectStore(db.origin, db.name, store);
          toast.success(`Cleared "${store}" on the phone`);
        } catch (error) {
          toast.error(`Could not clear "${store}"`, { description: message(error) });
        } finally {
          void deps.refetchRecords();
          void deps.refetchStoreInfo();
        }
      },
    );
  }

  function deleteStore(db: IDBDatabaseInfo, store: string) {
    deps.ask(
      {
        title: `Delete the store "${store}"?`,
        text: `"${store}" and all its records are removed from "${db.name}" on the phone, and the database version goes up by one. The app may not expect that. This cannot be undone.`,
        confirmLabel: "Delete store",
        danger: true,
      },
      async () => {
        const idb = domain();
        if (!idb) return;
        try {
          await idb.deleteObjectStore(db.origin, db.name, store);
          toast.success(`Deleted the store "${store}" on the phone`);
          const here = deps.current();
          if (here.mode === "live" && here.database === db.name && here.store === store) {
            deps.openLocation("live", db.name);
          }
        } catch (error) {
          if (error instanceof IdbBlockedError) reportBlocked(error, `"${store}" was not deleted`);
          else toast.error(`Could not delete "${store}"`, { description: message(error) });
        } finally {
          void deps.refetchDatabases();
          void deps.refetchStoreInfo();
        }
      },
    );
  }

  function closeFile(entry: IdbSnapshotEntry) {
    deps.ask(
      {
        title: `Close "${entry.data.database.name}"?`,
        text: `It is removed from Opened files. ${fileName(entry.sourcePath)} on this computer is not touched.`,
        confirmLabel: "Close file",
        danger: false,
      },
      () => {
        files.removeSnapshot(entry.id);
        const here = deps.current();
        if (here.mode === "file" && here.database === entry.id) deps.replaceRoot("live");
      },
    );
  }

  return {
    exportLive,
    exportFile,
    openExport,
    replaceFromFile,
    deleteDatabase,
    clearStore,
    deleteStore,
    closeFile,
  };
}
