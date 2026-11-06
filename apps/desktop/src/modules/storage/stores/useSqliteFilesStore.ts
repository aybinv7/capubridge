import { shallowRef } from "vue";
import { defineStore } from "pinia";
import { invokeCommand } from "@/runtime/ipc/client";
import { LOCAL_SQL_SERIAL } from "@/stores/sqlSession.store";
import type { SqliteDbFile } from "@/types/sqlite.types";

/**
 * A SQLite file opened from this computer. The app reads and changes a working copy (`path`);
 * saving writes it back over `original`, the file that was picked.
 */
export interface SqliteOpenedFile {
  id: string;
  name: string;
  /** The working copy every read and write goes to. */
  path: string;
  /** The file that was picked, which saving writes back to. */
  original: string;
  size: number;
  openedAt: number;
  /** A write-ahead log sat beside the original when it was opened. */
  walBeside: boolean;
  /** The person agreed once that saving writes over `original`. */
  saveConfirmed: boolean;
  /** The working copy holds changes that are not written to `original`. */
  unsaved: boolean;
}

const FILE_ARGS = { serial: LOCAL_SQL_SERIAL, package: "file" } as const;

let counter = 0;

function nextId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/** The file as a database row of the SQLite tab ("Opened files"). */
export function openedFileEntry(file: SqliteOpenedFile): SqliteDbFile {
  return {
    name: file.name,
    path: file.path,
    size: file.size,
    packageName: "file",
    sourceKind: "imported",
    sourceLabel: "file",
    sourceFilePath: file.original,
    ...(file.unsaved ? { unsavedToSource: true } : {}),
  };
}

/** The arguments the opened-file commands take for `file`. */
export function openedFileArgs(file: Pick<SqliteOpenedFile, "path">) {
  return { ...FILE_ARGS, dbPath: file.path };
}

/**
 * Every SQLite file opened in this run, each with its own id for the file route. Several can be
 * open at once, beside the phone's databases. Rust keeps the list of working copies it lets the
 * app change; nothing else is ever written.
 */
export const useSqliteFilesStore = defineStore("sqlite-opened-files", () => {
  const files = shallowRef<readonly SqliteOpenedFile[]>([]);

  function update(id: string, change: Partial<SqliteOpenedFile>) {
    files.value = files.value.map((file) => (file.id === id ? { ...file, ...change } : file));
  }

  /** Copies the picked file to a working copy (Rust checks its header) and lists it. */
  async function open(original: string): Promise<SqliteOpenedFile> {
    const opened = await invokeCommand("sqlite_open_local_file", { path: original });
    const file: SqliteOpenedFile = {
      id: nextId(),
      name: opened.name,
      path: opened.path,
      original: opened.original,
      size: opened.size,
      openedAt: Date.now(),
      walBeside: opened.walBeside,
      saveConfirmed: false,
      unsaved: false,
    };
    files.value = [...files.value, file];
    return file;
  }

  function get(id: string): SqliteOpenedFile | null {
    return files.value.find((file) => file.id === id) ?? null;
  }

  function byPath(path: string): SqliteOpenedFile | null {
    return files.value.find((file) => file.path === path) ?? null;
  }

  /** Forgets the file and removes its working copy; the original is not touched. */
  async function close(id: string): Promise<void> {
    const file = get(id);
    files.value = files.value.filter((entry) => entry.id !== id);
    if (file) await invokeCommand("sqlite_close_opened_file", openedFileArgs(file));
  }

  /** The file's size after it was rewritten here (an imported dump). */
  function resize(id: string, size: number) {
    update(id, { size });
  }

  function confirmSave(id: string) {
    update(id, { saveConfirmed: true });
  }

  function setUnsaved(id: string, unsaved: boolean) {
    update(id, { unsaved });
  }

  return { files, open, get, byPath, close, resize, confirmSave, setUnsaved };
});
