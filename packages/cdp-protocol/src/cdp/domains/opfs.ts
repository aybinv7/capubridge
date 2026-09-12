import type { CDPClient } from "../client.js";

export interface OPFSEntry {
  name: string;
  kind: "file" | "directory";
  size?: number;
  lastModified?: number;
  path: string;
}

export const SQLITE_MAGIC = "SQLite format 3\0";

export const SAH_POOL_HEADER_PATH_MAX = 512;
export const SAH_POOL_HEADER_FLAGS_OFFSET = 512;
export const SAH_POOL_HEADER_FLAGS_SIZE = 4;
export const SAH_POOL_HEADER_DIGEST_OFFSET = 516;
export const SAH_POOL_HEADER_DIGEST_SIZE = 8;
export const SAH_POOL_HEADER_DATA_OFFSET = 4096;

/**
 * Bytes pulled per `Runtime.evaluate` when reading an OPFS file. Base64 inflates
 * a chunk by 4/3, so 8 MiB stays under the 16 MiB frame ceiling a stock WebSocket
 * peer enforces, and caps what the device holds in memory at once.
 */
export const OPFS_READ_CHUNK_BYTES = 8 * 1024 * 1024;

export interface SahPoolHeader {
  path: string;
  flags: number;
}

export interface ReadFileRange {
  offset?: number;
  length?: number;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
}

export interface SahPoolDatabase {
  opaqueName: string;
  opaquePath: string;
  logicalPath: string;
  flags: number;
  fileSize: number;
  dataSize: number;
  lastModified?: number;
}

export type StorageTechId =
  | "sqlite-wasm-opfsdb"
  | "sqlite-wasm-sah-pool"
  | "wa-sqlite-opfs"
  | "capacitor-sqlite-web"
  | "localforage-opfs"
  | "rxdb-opfs"
  | "absurd-sql"
  | "unknown";

export interface StorageTechHint {
  id: StorageTechId;
  label: string;
  description: string;
  packageName?: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  affectedEntries: string[];
  inspectable: boolean;
}

export function isSqliteMagic(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_MAGIC.length) return false;
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

export function decodeSahPoolHeader(bytes: Uint8Array): SahPoolHeader | null {
  if (bytes.length < SAH_POOL_HEADER_FLAGS_OFFSET + SAH_POOL_HEADER_FLAGS_SIZE) return null;
  let end = 0;
  while (end < SAH_POOL_HEADER_PATH_MAX && bytes[end] !== 0) end++;
  if (end === 0) return null;
  let path: string;
  try {
    path = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
  } catch {
    return null;
  }
  const flags = new DataView(
    bytes.buffer,
    bytes.byteOffset + SAH_POOL_HEADER_FLAGS_OFFSET,
    SAH_POOL_HEADER_FLAGS_SIZE,
  ).getUint32(0);
  return { path, flags };
}

export function detectStorageTechs(entries: OPFSEntry[]): StorageTechHint[] {
  const hints: StorageTechHint[] = [];

  const sqliteFiles = entries.filter(
    (e) => e.kind === "file" && /\.(sqlite3?|db3?)$/i.test(e.name),
  );
  if (sqliteFiles.length > 0) {
    hints.push({
      id: "sqlite-wasm-opfsdb",
      label: "SQLite WASM — direct OPFS (OpfsDb)",
      description:
        "Database file stored directly in OPFS. Bytes start with the SQLite magic header at offset 0.",
      packageName: "@sqlite.org/sqlite-wasm",
      confidence: "high",
      evidence: [`${sqliteFiles.length} file(s) with .sqlite / .db extension`],
      affectedEntries: sqliteFiles.map((e) => e.name),
      inspectable: true,
    });
  }

  const sahContainerDirs = entries.filter(
    (e) =>
      e.kind === "directory" &&
      (e.name === ".opaque" ||
        e.name === ".opfs-sahpool" ||
        /sahpool/i.test(e.name) ||
        /opfs[-_]sah/i.test(e.name)),
  );
  if (sahContainerDirs.length > 0) {
    hints.push({
      id: "sqlite-wasm-sah-pool",
      label: "SQLite WASM — SAH-Pool (OpfsSAHPoolUtil)",
      description:
        'Pool directory detected. Default layout is "/.opfs-sahpool/.opaque/<random>"; each opaque file is 4096 B header + SQLite payload at byte 4096. Navigate into ".opaque" to see the databases.',
      packageName: "@sqlite.org/sqlite-wasm",
      confidence: "high",
      evidence: [
        `directory ${sahContainerDirs.map((d) => `"${d.name}"`).join(", ")} matches SAH-Pool layout`,
      ],
      affectedEntries: sahContainerDirs.map((e) => e.name),
      inspectable: false,
    });
  }

  const poolFiles = entries.filter(
    (e) =>
      e.kind === "file" &&
      (e.size ?? 0) >= SAH_POOL_HEADER_DATA_OFFSET &&
      (e.size ?? 0) % SAH_POOL_HEADER_DATA_OFFSET === 0,
  );
  const poolFilesDotless = poolFiles.filter((e) => !e.name.includes("."));
  const uniformSize =
    poolFiles.length > 0 ? poolFiles.every((e) => e.size === poolFiles[0].size) : false;
  if (poolFilesDotless.length >= 1) {
    const high = poolFilesDotless.length >= 3 || (uniformSize && poolFilesDotless.length >= 2);
    hints.push({
      id: "sqlite-wasm-sah-pool",
      label: "SQLite WASM — SAH-Pool (OpfsSAHPoolUtil)",
      description:
        "Files with no extension, uniform sector-aligned size. Each contains a 4096-byte header (logical path + flags + digest) followed by the SQLite payload starting at byte 4096.",
      packageName: "@sqlite.org/sqlite-wasm",
      confidence: high ? "high" : "medium",
      evidence: [
        `${poolFilesDotless.length} extension-less file(s) ≥ ${SAH_POOL_HEADER_DATA_OFFSET} B, sector-aligned`,
        uniformSize ? "all files identical size (matches pool slot allocation)" : "",
      ].filter(Boolean),
      affectedEntries: poolFilesDotless.map((e) => e.name),
      inspectable: true,
    });
  }

  const journals = entries.filter((e) => e.kind === "file" && /-journal$/i.test(e.name));
  const walFiles = entries.filter((e) => e.kind === "file" && /-wal$/i.test(e.name));
  const shmFiles = entries.filter((e) => e.kind === "file" && /-shm$/i.test(e.name));
  if (journals.length > 0 || walFiles.length > 0 || shmFiles.length > 0) {
    hints.push({
      id: "wa-sqlite-opfs",
      label: "wa-sqlite (OPFS VFS family)",
      description:
        "Companion -journal / -wal / -shm files alongside the main DB. Typical of OPFSCoopSyncVFS or OPFSAdaptiveVFS.",
      packageName: "wa-sqlite",
      confidence: "medium",
      evidence: [
        journals.length > 0 ? `${journals.length} -journal file(s)` : "",
        walFiles.length > 0 ? `${walFiles.length} -wal file(s)` : "",
        shmFiles.length > 0 ? `${shmFiles.length} -shm file(s)` : "",
      ].filter(Boolean),
      affectedEntries: [...journals, ...walFiles, ...shmFiles].map((e) => e.name),
      inspectable: true,
    });
  }

  const lfDirs = entries.filter((e) => e.kind === "directory" && /localforage/i.test(e.name));
  if (lfDirs.length > 0) {
    hints.push({
      id: "localforage-opfs",
      label: "localForage — OPFS adapter",
      description: "localForage with OPFS driver; one folder per logical store.",
      packageName: "localforage",
      confidence: "low",
      evidence: [`${lfDirs.length} folder(s) with localforage in the name`],
      affectedEntries: lfDirs.map((e) => e.name),
      inspectable: false,
    });
  }

  const rxdbDirs = entries.filter((e) => e.kind === "directory" && /^rxdb-/i.test(e.name));
  if (rxdbDirs.length > 0) {
    hints.push({
      id: "rxdb-opfs",
      label: "RxDB — OPFS storage",
      description:
        "RxDB collections stored in OPFS-backed storage (Premium or Dexie/SQLite adapter).",
      packageName: "rxdb",
      confidence: "low",
      evidence: [`${rxdbDirs.length} folder(s) with rxdb- prefix`],
      affectedEntries: rxdbDirs.map((e) => e.name),
      inspectable: false,
    });
  }

  if (hints.length === 0 && entries.length > 0) {
    const fileCount = entries.filter((e) => e.kind === "file").length;
    const dirCount = entries.filter((e) => e.kind === "directory").length;
    hints.push({
      id: "unknown",
      label: "Unrecognised OPFS layout",
      description: "No SQLite WASM, wa-sqlite, localForage or RxDB signatures detected here.",
      confidence: "low",
      evidence: [
        `${fileCount} file(s), ${dirCount} directory(ies)`,
        "Navigate into subdirectories — the pool may live in a child folder.",
      ],
      affectedEntries: [],
      inspectable: false,
    });
  }

  return hints;
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}
export class OPFSDomain {
  constructor(private client: CDPClient) {}

  async listDirectory(path: string = ""): Promise<OPFSEntry[]> {
    const escaped = escapeJsString(path);
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${escaped}'.split('/').filter(Boolean);
            let dir = root;
            for (const p of parts) {
              dir = await dir.getDirectoryHandle(p);
            }
            const entries = [];
            for await (const [name, handle] of dir.entries()) {
              const isFile = handle.kind === 'file';
              let size = undefined;
              let lastModified = undefined;
              if (isFile) {
                const file = await handle.getFile();
                size = file.size;
                lastModified = file.lastModified;
              }
              entries.push({
                name,
                kind: handle.kind,
                size,
                lastModified,
                path: '${escaped}' ? '${escaped}/' + name : name,
              });
            }
            return JSON.stringify(entries);
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
    return parsed as OPFSEntry[];
  }

  async deleteEntry(path: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error("Empty path");
    const parentEscaped = escapeJsString(parts.join("/"));
    const nameEscaped = escapeJsString(name);

    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${parentEscaped}'.split('/').filter(Boolean);
            let dir = root;
            for (const p of parts) {
              dir = await dir.getDirectoryHandle(p);
            }
            await dir.removeEntry('${nameEscaped}', { recursive: true });
            return JSON.stringify({ ok: true });
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
  }

  async getStorageSize(path: string = ""): Promise<number> {
    const entries = await this.listDirectory(path);
    let totalSize = 0;

    for (const entry of entries) {
      if (entry.kind === "file" && entry.size) {
        totalSize += entry.size;
      } else if (entry.kind === "directory") {
        const subPath = path ? `${path}/${entry.name}` : entry.name;
        totalSize += await this.getStorageSize(subPath);
      }
    }

    return totalSize;
  }

  async fileSize(path: string): Promise<number> {
    const escaped = escapeJsString(path);
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${escaped}'.split('/').filter(Boolean);
            const name = parts.pop();
            if (!name) throw new Error('Empty path');
            let dir = root;
            for (const p of parts) dir = await dir.getDirectoryHandle(p);
            const file = await (await dir.getFileHandle(name)).getFile();
            return JSON.stringify({ size: file.size });
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const parsed = JSON.parse((result.result as Record<string, unknown>).value as string);
    if (parsed && typeof parsed === "object" && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
    return (parsed as { size: number }).size;
  }

  /**
   * Read an OPFS file, splitting anything larger than one chunk across several
   * `Runtime.evaluate` round trips. A whole-file read in a single response
   * overflows the WebSocket frame limit and drops the CDP connection.
   */
  async readFileBytes(path: string, range?: ReadFileRange): Promise<Uint8Array> {
    const offset = range?.offset ?? 0;
    const requested = range?.length ?? -1;

    if (requested >= 0 && requested <= OPFS_READ_CHUNK_BYTES) {
      return this.readFileChunk(path, offset, requested);
    }

    const available = Math.max(0, (await this.fileSize(path)) - offset);
    const total = requested < 0 ? available : Math.min(requested, available);
    if (total === 0) return new Uint8Array(0);

    const out = new Uint8Array(total);
    let loaded = 0;
    while (loaded < total) {
      const chunk = await this.readFileChunk(
        path,
        offset + loaded,
        Math.min(OPFS_READ_CHUNK_BYTES, total - loaded),
      );
      if (chunk.length === 0) break;
      out.set(chunk, loaded);
      loaded += chunk.length;
      range?.onProgress?.(loaded, total);
    }
    return loaded === total ? out : out.subarray(0, loaded);
  }

  private async readFileChunk(path: string, offset: number, length: number): Promise<Uint8Array> {
    const escaped = escapeJsString(path);
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${escaped}'.split('/').filter(Boolean);
            const name = parts.pop();
            if (!name) throw new Error('Empty path');
            let dir = root;
            for (const p of parts) dir = await dir.getDirectoryHandle(p);
            const fh = await dir.getFileHandle(name);
            const file = await fh.getFile();
            const off = ${offset};
            const end = Math.min(file.size, off + ${length});
            const blob = (off === 0 && end === file.size) ? file : file.slice(off, end);
            const buf = new Uint8Array(await blob.arrayBuffer());
            let s = '';
            const CHUNK = 32768;
            for (let i = 0; i < buf.length; i += CHUNK) {
              s += String.fromCharCode.apply(null, buf.subarray(i, Math.min(i + CHUNK, buf.length)));
            }
            return btoa(s);
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    if (typeof value === "string" && value.startsWith('{"__opfsError"')) {
      throw new Error(JSON.parse(value).__opfsError);
    }
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  async probeSqliteFile(path: string): Promise<boolean> {
    const head = await this.readFileBytes(path, { offset: 0, length: SQLITE_MAGIC.length });
    return isSqliteMagic(head);
  }

  async readSahPoolHeader(path: string): Promise<SahPoolHeader | null> {
    const head = await this.readFileBytes(path, {
      offset: 0,
      length: SAH_POOL_HEADER_FLAGS_OFFSET + SAH_POOL_HEADER_FLAGS_SIZE,
    });
    return decodeSahPoolHeader(head);
  }

  async listSahPoolDatabases(dirPath: string): Promise<SahPoolDatabase[]> {
    const escaped = escapeJsString(dirPath);
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${escaped}'.split('/').filter(Boolean);
            let dir = root;
            for (const p of parts) dir = await dir.getDirectoryHandle(p);
            const DATA = ${SAH_POOL_HEADER_DATA_OFFSET};
            const PATH_MAX = ${SAH_POOL_HEADER_PATH_MAX};
            const FLAGS_OFF = ${SAH_POOL_HEADER_FLAGS_OFFSET};
            const FLAGS_SIZE = ${SAH_POOL_HEADER_FLAGS_SIZE};
            const out = [];
            for await (const [name, handle] of dir.entries()) {
              if (handle.kind !== 'file') continue;
              const file = await handle.getFile();
              if (file.size < DATA) continue;
              const buf = new Uint8Array(await file.slice(0, FLAGS_OFF + FLAGS_SIZE).arrayBuffer());
              let end = 0;
              while (end < PATH_MAX && buf[end] !== 0) end++;
              if (end === 0) continue;
              let p;
              try { p = new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, end)); }
              catch { continue; }
              const flags = new DataView(buf.buffer, FLAGS_OFF, FLAGS_SIZE).getUint32(0);
              out.push({
                opaqueName: name,
                opaquePath: '${escaped}' ? '${escaped}/' + name : name,
                logicalPath: p,
                flags,
                fileSize: file.size,
                dataSize: file.size - DATA,
                lastModified: file.lastModified,
              });
            }
            return JSON.stringify(out);
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
    return parsed as SahPoolDatabase[];
  }

  async readSqliteBytes(
    path: string,
    opts?: { stripSahPoolHeader?: boolean; onProgress?: ReadFileRange["onProgress"] },
  ): Promise<Uint8Array> {
    const offset = opts?.stripSahPoolHeader ? SAH_POOL_HEADER_DATA_OFFSET : 0;
    const bytes = await this.readFileBytes(path, { offset, onProgress: opts?.onProgress });
    if (!isSqliteMagic(bytes)) {
      throw new Error(
        `Bytes at offset ${offset} of "${path}" are not a SQLite database (magic header mismatch).`,
      );
    }
    return bytes;
  }

  async hashSqliteBytes(
    path: string,
    opts?: { stripSahPoolHeader?: boolean },
  ): Promise<string | null> {
    const escaped = escapeJsString(path);
    const offset = opts?.stripSahPoolHeader ? SAH_POOL_HEADER_DATA_OFFSET : 0;
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${escaped}'.split('/').filter(Boolean);
            const name = parts.pop();
            if (!name) throw new Error('Empty path');
            let dir = root;
            for (const p of parts) dir = await dir.getDirectoryHandle(p);
            const fh = await dir.getFileHandle(name);
            const file = await fh.getFile();
            const off = ${offset};
            if (file.size <= off) return JSON.stringify({ hash: null, size: file.size });
            const blob = off === 0 ? file : file.slice(off);
            const buf = await blob.arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', buf);
            const view = new Uint8Array(digest);
            let hex = '';
            for (let i = 0; i < view.length; i++) {
              hex += view[i].toString(16).padStart(2, '0');
            }
            return JSON.stringify({ hash: hex, size: buf.byteLength });
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
    return (parsed as { hash: string | null }).hash;
  }

  async releaseSahPoolSlot(path: string): Promise<{ released: boolean; via: "sah" | "writable" }> {
    const escaped = escapeJsString(path);
    const headerSize = SAH_POOL_HEADER_DATA_OFFSET;
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const parts = '${escaped}'.split('/').filter(Boolean);
            const name = parts.pop();
            if (!name) throw new Error('Empty path');
            let dir = root;
            for (const p of parts) dir = await dir.getDirectoryHandle(p);
            const fh = await dir.getFileHandle(name);

            const zeroes = new Uint8Array(${headerSize});

            try {
              const sah = await fh.createSyncAccessHandle();
              try {
                sah.write(zeroes, { at: 0 });
                sah.flush();
              } finally {
                sah.close();
              }
              return JSON.stringify({ via: 'sah' });
            } catch {
              const writable = await fh.createWritable({ keepExistingData: true });
              await writable.write({ type: 'write', position: 0, data: zeroes });
              await writable.close();
              return JSON.stringify({ via: 'writable' });
            }
          } catch (e) {
            return JSON.stringify({ __opfsError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
    const via = (parsed as { via: "sah" | "writable" }).via;
    return { released: true, via };
  }
}
