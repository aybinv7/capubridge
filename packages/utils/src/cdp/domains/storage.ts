import type { CDPClient } from "../client.js";

export interface LSOrigin {
  origin: string;
  entries: Array<{ key: string; value: string }>;
}

export interface CacheName {
  name: string;
  entries: Array<{ url: string; method: string }>;
}

export interface CacheEntry {
  url: string;
  method: string;
  cacheName: string;
  status: number;
  headers: Record<string, string>;
}

export interface OPFSEntry {
  name: string;
  kind: "file" | "directory";
  size?: number;
  lastModified?: number;
  path: string;
}

export class LocalStorageDomain {
  constructor(private client: CDPClient) {}

  async enable(): Promise<void> {
    await this.client.send("DOMStorage.enable");
  }

  async getOrigins(): Promise<string[]> {
    const origins = new Set<string>();

    try {
      const frameTreeResult = await this.client.send<any>("Page.getFrameTree");
      this.collectOriginsFromFrameTree(frameTreeResult.frameTree, origins);
    } catch {
      // Page.getFrameTree may fail if no page is loaded yet
    }

    return Array.from(origins);
  }

  private collectOriginsFromFrameTree(frameTree: any, origins: Set<string>): void {
    const frame = frameTree.frame;
    if (frame?.securityOrigin) {
      origins.add(frame.securityOrigin);
    }
    if (frameTree.childFrames) {
      for (const child of frameTree.childFrames) {
        this.collectOriginsFromFrameTree(child, origins);
      }
    }
  }

  async getEntries(origin: string): Promise<Array<{ key: string; value: string }>> {
    const result = await this.client.send<any>("DOMStorage.getDOMStorageItems", {
      storageId: { securityOrigin: origin, isLocalStorage: true },
    });
    return (result.entries as [string, string][]).map(([key, value]) => ({ key, value }));
  }

  async deleteItem(origin: string, key: string): Promise<void> {
    await this.client.send("DOMStorage.removeDOMStorageItem", {
      storageId: { securityOrigin: origin, isLocalStorage: true },
      key,
    });
  }

  async setItem(origin: string, key: string, value: string): Promise<void> {
    await this.client.send("DOMStorage.setDOMStorageItem", {
      storageId: { securityOrigin: origin, isLocalStorage: true },
      key,
      value,
    });
  }

  async getStorageSize(origin: string): Promise<number> {
    const entries = await this.getEntries(origin);
    let totalSize = 0;
    for (const { key, value } of entries) {
      totalSize += key.length + value.length;
    }
    return totalSize;
  }
}

export class CacheAPIDomain {
  constructor(private client: CDPClient) {}

  async getCacheNames(): Promise<string[]> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const names = await caches.keys();
            return JSON.stringify(names);
          } catch (e) {
            return JSON.stringify({ error: e.message });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value as string);
    if (parsed.error) throw new Error(parsed.error);
    return parsed as string[];
  }

  async getEntries(cacheName: string): Promise<CacheEntry[]> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const cache = await caches.open('${cacheName.replace(/'/g, "\\'")}');
            const requests = await cache.keys();
            const entries = requests.map(req => ({
              url: req.url,
              method: req.method,
              cacheName: '${cacheName.replace(/'/g, "\\'")}'
            }));
            return JSON.stringify(entries);
          } catch (e) {
            return JSON.stringify({ error: e.message });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value as string);
    if (parsed.error) throw new Error(parsed.error);
    return parsed as CacheEntry[];
  }

  async deleteCache(cacheName: string): Promise<void> {
    await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `caches.delete('${cacheName.replace(/'/g, "\\'")}')`,
      awaitPromise: true,
      returnByValue: true,
    });
  }

  async deleteEntry(cacheName: string, url: string): Promise<void> {
    await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          const cache = await caches.open('${cacheName.replace(/'/g, "\\'")}');
          await cache.delete('${url.replace(/'/g, "\\'")}');
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
  }

  async getStorageSize(): Promise<number> {
    const cacheNames = await this.getCacheNames();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
        expression: `
          (async () => {
            try {
              const cache = await caches.open('${cacheName.replace(/'/g, "\\'")}');
              const requests = await cache.keys();
              let total = 0;
              for (const req of requests) {
                const resp = await cache.match(req);
                if (resp) {
                  const blob = await resp.blob();
                  total += blob.size;
                }
              }
              return total;
            } catch (e) {
              return 0;
            }
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      const value = (result.result as Record<string, unknown>).value as string;
      const size = parseInt(value, 10);
      if (!isNaN(size)) totalSize += size;
    }

    return totalSize;
  }
}

export class OPFSDomain {
  constructor(private client: CDPClient) {}

  async listDirectory(path: string = ""): Promise<OPFSEntry[]> {
    const pathExpr = path
      ? `await root.getDirectory('${path.replace(/'/g, "\\'")}').catch(() => root.getFile('${path.replace(/'/g, "\\'")}').catch(() => null))`
      : "root";

    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            ${path ? `const dir = ${pathExpr};` : "const dir = root;"}
            if (!dir) return JSON.stringify([]);
            
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
                path: '${path}' ? '${path}/' + name : name
              });
            }
            return JSON.stringify(entries);
          } catch (e) {
            return JSON.stringify({ error: e.message });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value as string);
    if (parsed.error) throw new Error(parsed.error);
    return parsed as OPFSEntry[];
  }

  async deleteEntry(path: string): Promise<void> {
    const parts = path.split("/");
    const name = parts.pop() ?? path;
    const parentPath = parts.join("/");

    await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const root = await navigator.storage.getDirectory();
            ${parentPath ? `const dir = await root.getDirectory('${parentPath.replace(/'/g, "\\'")}');` : "const dir = root;"}
            await dir.removeEntry('${name.replace(/'/g, "\\'")}', { recursive: true });
          } catch (e) {
            return JSON.stringify({ error: e.message });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
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
}
