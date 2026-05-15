import { ref } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";

export const LOCAL_SQL_SERIAL = "__local__";
export const LOCAL_SQL_PACKAGE = "opfs";

export interface LocalSqlSession {
  serial: typeof LOCAL_SQL_SERIAL;
  package: string;
  dbPath: string;
  label: string;
  fileName: string;
  sizeBytes: number;
  createdAt: number;
  sourceOpfsPath?: string;
  stripSahPoolHeader?: boolean;
}

export const useSqlSessionStore = defineStore("sql-session", () => {
  const localSession = ref<LocalSqlSession | null>(null);

  async function startLocalSession(
    label: string,
    bytes: Uint8Array,
    source?: { opfsPath: string; stripSahPoolHeader: boolean },
  ): Promise<LocalSqlSession> {
    const chunkSize = 32768;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunkSize, bytes.length)) as unknown as number[],
      );
    }
    const base64Data = btoa(binary);
    const path = await invoke<string>("sqlite_save_local_bytes", {
      name: label,
      base64Data,
    });
    const fileName = label.includes("/") ? label.slice(label.lastIndexOf("/") + 1) : label;
    const session: LocalSqlSession = {
      serial: LOCAL_SQL_SERIAL,
      package: LOCAL_SQL_PACKAGE,
      dbPath: path,
      label,
      fileName: fileName || "database.db",
      sizeBytes: bytes.byteLength,
      createdAt: Date.now(),
      sourceOpfsPath: source?.opfsPath,
      stripSahPoolHeader: source?.stripSahPoolHeader,
    };
    localSession.value = session;
    return session;
  }

  function clearLocalSession() {
    localSession.value = null;
  }

  async function refreshLocalSession(bytes: Uint8Array): Promise<void> {
    const session = localSession.value;
    if (!session) return;
    const chunkSize = 32768;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunkSize, bytes.length)) as unknown as number[],
      );
    }
    const base64Data = btoa(binary);
    await invoke("sqlite_overwrite_local_bytes", { path: session.dbPath, base64Data });
    localSession.value = {
      ...session,
      sizeBytes: bytes.byteLength,
    };
  }

  return { localSession, startLocalSession, clearLocalSession, refreshLocalSession };
});
