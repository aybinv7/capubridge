import type { CDPClient } from "../client.js";
import {
  SAH_POOL_HEADER_DATA_OFFSET,
  SAH_POOL_HEADER_FLAGS_OFFSET,
  SAH_POOL_HEADER_FLAGS_SIZE,
  SAH_POOL_HEADER_PATH_MAX,
} from "./opfs.js";

export type OpfsSqliteTech = "sqlite-wasm-opfsdb" | "sqlite-wasm-sah-pool" | "wa-sqlite-opfs";

export interface DiscoveredOpfsDatabase {
  name: string;
  path: string;
  directory: string;
  size: number;
  tech: OpfsSqliteTech;
  stripSahPoolHeader: boolean;
  lastModified?: number;
}

const MAX_SCAN_ENTRIES = 5000;
const MAX_SCAN_DEPTH = 8;

/**
 * Walks the whole OPFS tree on the device in a single `Runtime.evaluate` and
 * returns every file that really is a SQLite database — verified by magic
 * header rather than by filename, so extension-less SAH-Pool slots are found
 * too. One round trip keeps the scan usable over an ADB-forwarded connection.
 */
export class OpfsSqliteDiscovery {
  constructor(private client: CDPClient) {}

  async discover(): Promise<DiscoveredOpfsDatabase[]> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const MAGIC = 'SQLite format 3\\u0000';
            const DATA = ${SAH_POOL_HEADER_DATA_OFFSET};
            const PATH_MAX = ${SAH_POOL_HEADER_PATH_MAX};
            const FLAGS_OFF = ${SAH_POOL_HEADER_FLAGS_OFFSET};
            const FLAGS_SIZE = ${SAH_POOL_HEADER_FLAGS_SIZE};
            const MAX_ENTRIES = ${MAX_SCAN_ENTRIES};
            const MAX_DEPTH = ${MAX_SCAN_DEPTH};

            const hasMagic = (bytes, at) => {
              if (!bytes || bytes.length < at + MAGIC.length) return false;
              for (let i = 0; i < MAGIC.length; i++) {
                if (bytes[at + i] !== MAGIC.charCodeAt(i)) return false;
              }
              return true;
            };

            const head = async (file, length) =>
              new Uint8Array(await file.slice(0, Math.min(length, file.size)).arrayBuffer());

            const out = [];
            let seen = 0;

            const walk = async (dir, path, depth) => {
              if (depth > MAX_DEPTH || seen >= MAX_ENTRIES) return;
              const files = [];
              const dirs = [];
              const names = new Set();
              for await (const [name, handle] of dir.entries()) {
                if (seen >= MAX_ENTRIES) break;
                seen++;
                names.add(name);
                if (handle.kind === 'directory') dirs.push([name, handle]);
                else files.push([name, handle]);
              }

              for (const [name, handle] of files) {
                const full = path ? path + '/' + name : name;
                let file;
                try { file = await handle.getFile(); } catch { continue; }
                if (file.size < MAGIC.length) continue;

                const direct = await head(file, MAGIC.length);
                if (hasMagic(direct, 0)) {
                  const companion = names.has(name + '-wal') || names.has(name + '-journal');
                  out.push({
                    name: name,
                    path: full,
                    directory: path,
                    size: file.size,
                    tech: companion ? 'wa-sqlite-opfs' : 'sqlite-wasm-opfsdb',
                    stripSahPoolHeader: false,
                    lastModified: file.lastModified,
                  });
                  continue;
                }

                if (file.size <= DATA || file.size % DATA !== 0) continue;
                const header = await head(file, DATA + MAGIC.length);
                if (!hasMagic(header, DATA)) continue;
                let end = 0;
                while (end < PATH_MAX && header[end] !== 0) end++;
                if (end === 0) continue;
                let logical;
                try {
                  logical = new TextDecoder('utf-8', { fatal: true }).decode(header.subarray(0, end));
                } catch { continue; }
                out.push({
                  name: logical.replace(/^\\//, '') || name,
                  path: full,
                  directory: path,
                  size: file.size - DATA,
                  tech: 'sqlite-wasm-sah-pool',
                  stripSahPoolHeader: true,
                  flags: new DataView(header.buffer, FLAGS_OFF, FLAGS_SIZE).getUint32(0),
                  lastModified: file.lastModified,
                });
              }

              for (const [name, handle] of dirs) {
                await walk(handle, path ? path + '/' + name : name, depth + 1);
              }
            };

            await walk(await navigator.storage.getDirectory(), '', 0);
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
    if (parsed && !Array.isArray(parsed) && "__opfsError" in parsed) {
      throw new Error((parsed as { __opfsError: string }).__opfsError);
    }
    return parsed as DiscoveredOpfsDatabase[];
  }
}
