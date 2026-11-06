import type { Ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "@/lib/toast";
import { IDBDomain, IdbBlockedError, type IDBDatabaseInfo } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import {
  chooseExportPath,
  exportDatabaseToFile,
  pickIdbExport,
  writeExportCopy,
  type PickedIdbExport,
} from "./idbExportFile";
import {
  discardImport,
  finishImport,
  IdbPartialImportError,
  importDatabaseReplace,
  type IdbPendingImport,
} from "./idbImport";
import { transferToast } from "./idbTransferToasts";
import { openIdbExport } from "./openIdbExport";
import type { IdbExportedDatabase } from "./idbTransfer.types";
import { useIdbSnapshotStore, type IdbSnapshotEntry } from "./useIdbSnapshotStore";
import type { IdbMode } from "./useIdbLocation";

interface Dependencies {
  targetId: Ref<string>;
  /** The page origin live databases belong to (where a file is written). */
  origin: Ref<string>;
  liveDatabases: Ref<readonly IDBDatabaseInfo[]>;
  ask: (request: ConfirmRequest, run: () => Promise<void> | void) => void;
  openLocation: (mode: IdbMode, id: string, store?: string) => void;
  replaceRoot: (mode?: IdbMode) => void;
  current: () => { mode: IdbMode; database: string; store: string };
  refetchDatabases: () => unknown;
  refetchStoreInfo: () => unknown;
  refetchRecords: () => unknown;
}

interface ImportSource {
  path: string;
  data: IdbExportedDatabase;
  lossy: readonly string[];
  bytes: number;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/**
 * Database and store actions of the IndexedDB tab: export, replace from a file, write an opened
 * file to the phone, open a file, clear, delete. Each destructive one asks first; each reports
 * what the phone answered, including when the app keeps the database open (blocked).
 */
export function useIdbDatabaseActions(deps: Dependencies) {
  const router = useRouter();
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

  function refetchAll() {
    void deps.refetchDatabases();
    void deps.refetchStoreInfo();
    void deps.refetchRecords();
  }

  async function exportLive(db: IDBDatabaseInfo) {
    const cdp = client();
    if (!cdp) return;
    const path = await chooseExportPath(`${db.name}.idb`);
    if (!path) return;
    const progress = transferToast(`Exporting "${db.name}"`);
    try {
      const result = await exportDatabaseToFile(cdp, db.origin, db.name, path, {
        onProgress: progress.progress,
        signal: progress.signal,
      });
      progress.done(
        `Exported "${db.name}"`,
        result.lossy.length
          ? `${path} · ${count(result.lossy.length, "value", "values")} could not be saved exactly`
          : path,
      );
    } catch (error) {
      progress.failed(error, `Could not export "${db.name}"`);
    }
  }

  async function exportFile(entry: IdbSnapshotEntry) {
    const name = entry.data.database.name;
    const path = await chooseExportPath(`${name}.idb`);
    if (!path) return;
    try {
      await writeExportCopy(entry.data, path);
      toast.success(`Saved a copy of "${name}"`, { description: path });
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

  /** Opens an export read-only under "Opened files" (works with no phone). */
  function openExport() {
    return openIdbExport(router);
  }

  function offerToFinish(pending: IdbPendingImport, error: IdbPartialImportError) {
    toast.error(`"${pending.target}" is incomplete on the phone`, {
      description: error.message,
      duration: Infinity,
      action: { label: "Finish writing", onClick: () => void finish(pending) },
      cancel: {
        label: "Leave it",
        onClick: () => void abandon(pending),
      },
    });
  }

  async function finish(pending: IdbPendingImport) {
    const cdp = client();
    if (!cdp) return;
    const progress = transferToast(`Finishing "${pending.target}"`);
    progress.lockCancel("Writing the rest of the file from the copy on the phone");
    try {
      const result = await finishImport(cdp, pending, { onProgress: progress.progress });
      progress.done(
        `Finished "${pending.target}"`,
        `${count(result.inserted, "record", "records")} written`,
      );
    } catch (error) {
      progress.dismiss();
      if (error instanceof IdbPartialImportError) offerToFinish(error.state, error);
      else toast.error(`Could not finish "${pending.target}"`, { description: message(error) });
    } finally {
      refetchAll();
    }
  }

  async function abandon(pending: IdbPendingImport) {
    const cdp = client();
    if (!cdp) return;
    try {
      await discardImport(cdp, pending);
      toast.info(`"${pending.target}" stays incomplete`, {
        description: "The copy staged on the phone was removed.",
      });
    } catch (error) {
      toast.error("Could not remove the staged copy", { description: message(error) });
    }
  }

  async function writeToPhone(target: string, source: ImportSource, acceptLoss: boolean) {
    const cdp = client();
    if (!cdp) return;
    const origin = deps.origin.value;
    const progress = transferToast(`Writing "${target}" to the phone`);
    try {
      const result = await importDatabaseReplace(cdp, source.data, target, origin, {
        onProgress: progress.progress,
        signal: progress.signal,
        acceptLoss,
        totalBytes: source.bytes || null,
        onCommit: () =>
          progress.lockCancel(
            "The file fits. Replacing the database now; this can no longer be cancelled.",
          ),
      });
      progress.done(`Wrote "${target}"`, `${count(result.inserted, "record", "records")} written`);
    } catch (error) {
      if (error instanceof IdbBlockedError) {
        progress.dismiss();
        reportBlocked(error, `"${target}" was not replaced`);
      } else if (error instanceof IdbPartialImportError) {
        progress.dismiss();
        offerToFinish(error.state, error);
      } else progress.failed(error, `Nothing was written to "${target}"`);
    } finally {
      refetchAll();
    }
  }

  function confirmWrite(target: string, source: ImportSource, replacing: boolean) {
    const stores = source.data.database.stores;
    const records = stores.reduce((sum, store) => sum + store.records.length, 0);
    const from = fileName(source.path);
    const named =
      source.data.database.name === target
        ? ""
        : ` The file was exported from "${source.data.database.name}".`;
    const what = `${count(stores.length, "store", "stores")} and ${count(records, "record", "records")} from ${from}`;
    const lossy = source.lossy.length > 0;
    const plan = replacing
      ? `The file is first written to a scratch database on the phone; if any record does not fit, nothing is changed. Then everything in "${target}" is deleted and ${what} are written. This cannot be undone.${named}`
      : `A new database "${target}" is created on the phone with ${what}.${named}`;
    deps.ask(
      {
        title: replacing ? `Replace "${target}" on the phone?` : `Write "${target}" to the phone?`,
        text: lossy
          ? `${plan} ${count(source.lossy.length, "value", "values")} in this file cannot be restored exactly and ${source.lossy.length === 1 ? "is" : "are"} written as listed below. Type the database name to accept that.`
          : plan,
        details: lossy ? source.lossy : undefined,
        requireConfirmText: lossy ? target : undefined,
        confirmLabel: replacing ? "Replace" : "Write to the phone",
        danger: replacing || lossy,
      },
      () => writeToPhone(target, source, lossy),
    );
  }

  /** Replaces the database the person chose (not the one named in the file) with an export. */
  async function replaceFromFile(db: IDBDatabaseInfo) {
    const picked = await pick();
    if (picked) confirmWrite(db.name, picked, true);
  }

  /** Writes an opened file to the phone: a new database, or a replace when the name exists. */
  function writeFile(entry: IdbSnapshotEntry) {
    const name = entry.data.database.name;
    const exists = deps.liveDatabases.value.some((db) => db.name === name);
    confirmWrite(
      name,
      { path: entry.sourcePath, data: entry.data, lossy: entry.lossy, bytes: entry.bytes },
      exists,
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
        if (here.mode === "file" && here.database === entry.id) {
          deps.replaceRoot(deps.targetId.value ? "live" : "file");
        }
      },
    );
  }

  return {
    exportLive,
    exportFile,
    openExport,
    replaceFromFile,
    writeFile,
    deleteDatabase,
    clearStore,
    deleteStore,
    closeFile,
  };
}
