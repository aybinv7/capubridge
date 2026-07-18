import { ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { invokeCommand } from "@/runtime/ipc/client";

export const LOCAL_SQL_SERIAL = "__local__";
export const LOCAL_SQL_PACKAGE = "opfs";

export type SqliteSourceKind = "native-android" | "opfs" | "jeep-sqlite" | "imported";

export interface LocalSqlSessionSource {
  kind: SqliteSourceKind;
  label: string;
  targetId?: string;
  packageName?: string;
  opfsPath?: string;
  stripSahPoolHeader?: boolean;
  idbName?: string;
  storeName?: string;
  key?: string;
}

export interface LocalSqlSession {
  serial: typeof LOCAL_SQL_SERIAL;
  package: string;
  dbPath: string;
  label: string;
  fileName: string;
  sizeBytes: number;
  createdAt: number;
  sourceKind: SqliteSourceKind;
  sourceLabel: string;
  sourceTargetId?: string;
  sourceOpfsPath?: string;
  stripSahPoolHeader?: boolean;
  sourceIdbName?: string;
  sourceStoreName?: string;
  sourceKey?: string;
}

export const useSqlSessionStore = defineStore("sql-session", () => {
  const localSession = ref<LocalSqlSession | null>(null);
  const lastSourceBytes = shallowRef<Uint8Array | null>(null);
  const lastSourceHash = ref<string | null>(null);

  async function startLocalSession(
    label: string,
    bytes: Uint8Array,
    source?: LocalSqlSessionSource,
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
    const path = await invokeCommand("sqlite_save_local_bytes", {
      name: label,
      base64Data,
    });
    const fileName = label.includes("/") ? label.slice(label.lastIndexOf("/") + 1) : label;
    const sourceKind = source?.kind ?? "opfs";
    const session: LocalSqlSession = {
      serial: LOCAL_SQL_SERIAL,
      package: source?.packageName ?? LOCAL_SQL_PACKAGE,
      dbPath: path,
      label,
      fileName: fileName || "database.db",
      sizeBytes: bytes.byteLength,
      createdAt: Date.now(),
      sourceKind,
      sourceLabel: source?.label ?? sourceKind,
      sourceTargetId: source?.targetId,
      sourceOpfsPath: source?.opfsPath,
      stripSahPoolHeader: source?.stripSahPoolHeader,
      sourceIdbName: source?.idbName,
      sourceStoreName: source?.storeName,
      sourceKey: source?.key,
    };
    localSession.value = session;
    lastSourceBytes.value = bytes;
    return session;
  }

  function clearLocalSession() {
    localSession.value = null;
    lastSourceBytes.value = null;
    lastSourceHash.value = null;
  }

  function swapSnapshot(nextBytes: Uint8Array): Uint8Array | null {
    const previous = lastSourceBytes.value;
    lastSourceBytes.value = nextBytes;
    return previous;
  }

  function setLastSourceHash(hash: string | null) {
    lastSourceHash.value = hash;
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
    await invokeCommand("sqlite_overwrite_local_bytes", { path: session.dbPath, base64Data });
    localSession.value = {
      ...session,
      sizeBytes: bytes.byteLength,
    };
  }

  return {
    localSession,
    lastSourceBytes,
    lastSourceHash,
    startLocalSession,
    clearLocalSession,
    refreshLocalSession,
    swapSnapshot,
    setLastSourceHash,
  };
});
