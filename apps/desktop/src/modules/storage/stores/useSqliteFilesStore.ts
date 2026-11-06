import { shallowRef } from "vue";
import { defineStore } from "pinia";
import { invokeCommand } from "@/runtime/ipc/client";
import type { SqliteDbFile } from "@/types/sqlite.types";

/** A SQLite file opened from this computer: a copy in the temp folder, writable here. */
export interface SqliteOpenedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  openedAt: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

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
  };
}

/**
 * Every SQLite file opened in this run, each with its own id for the file route. Several can be
 * open at once, beside the phone's databases; none of them is ever written back anywhere.
 */
export const useSqliteFilesStore = defineStore("sqlite-opened-files", () => {
  const files = shallowRef<readonly SqliteOpenedFile[]>([]);

  /** Copies the bytes to a temp file (the header is checked there) and lists it. */
  async function open(name: string, bytes: Uint8Array): Promise<SqliteOpenedFile> {
    const path = await invokeCommand("sqlite_save_local_bytes", {
      name,
      base64Data: bytesToBase64(bytes),
    });
    const file: SqliteOpenedFile = {
      id: nextId(),
      name,
      path,
      size: bytes.byteLength,
      openedAt: Date.now(),
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

  function close(id: string) {
    files.value = files.value.filter((file) => file.id !== id);
  }

  /** The file's size after it was rewritten here (an imported dump). */
  function resize(id: string, size: number) {
    files.value = files.value.map((file) => (file.id === id ? { ...file, size } : file));
  }

  return { files, open, get, byPath, close, resize };
});
