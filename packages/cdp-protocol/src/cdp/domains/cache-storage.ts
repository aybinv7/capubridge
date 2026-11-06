import { DeviceEvaluationError, evaluateChecked } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import {
  CACHE_BODY_PREVIEW_BYTES,
  catalogScript,
  deleteCacheScript,
  deleteEntriesScript,
  entriesScript,
  entryScript,
  type CacheEntryTarget,
} from "./cache-storage-scripts.js";

export type { CacheEntryTarget } from "./cache-storage-scripts.js";
export {
  CACHE_BODY_PREVIEW_BYTES,
  CACHE_DETAIL_BUDGET_MS,
  CACHE_ENTRY_READ_LIMIT,
} from "./cache-storage-scripts.js";

/** One cache of the page's origin. `count` is `null` when it could not be read. */
export interface CacheStorageCache {
  name: string;
  count: number | null;
}

export interface CacheStorageCatalog {
  /** The page's origin; Cache storage belongs to it. */
  origin: string;
  /** `false` when the page has no Cache storage (not a secure page). */
  available: boolean;
  caches: CacheStorageCache[];
}

/** A cached response as a list read describes it. */
export interface CacheStorageResponse {
  status: number;
  statusText: string;
  /** `basic`, `cors`, `default`, `opaque` or `opaqueredirect`. */
  type: string;
  redirected: boolean;
  /** Lower-case names; a list read returns only the headers in `CACHE_LIST_HEADERS`. */
  headers: Record<string, string>;
  /** Body bytes, `null` when they cannot be measured (opaque) or were not. */
  size: number | null;
}

export interface CacheStorageEntry {
  /** Stable among the cache's entries: method, address and the stored request headers. */
  id: string;
  url: string;
  method: string;
  /** Fingerprint of the response as read (empty when it was not read). */
  version: string;
  /** `null` when the read ran out of time before it reached this entry. */
  response: CacheStorageResponse | null;
}

export interface CacheStorageEntriesPage {
  entries: CacheStorageEntry[];
  /** Entries in the cache; more than `entries.length` when the read stopped at its limit. */
  total: number;
  /** Entries whose response was described. */
  described: number;
}

/** Up to `CACHE_BODY_PREVIEW_BYTES` of a body: text as text, anything else as Base64. */
export interface CacheStorageBody {
  body: string;
  base64Encoded: boolean;
  /** Bytes read from the start of the body. */
  read: number;
}

/** One entry in full, as the pane shows it. */
export interface CacheStorageEntryDetail {
  id: string;
  url: string;
  method: string;
  version: string;
  requestHeaders: Record<string, string>;
  requestMode: string | null;
  response: CacheStorageResponse & { url: string | null };
  /** `null` for an opaque response, whose body the browser hides from the page. */
  body: CacheStorageBody | null;
}

/** What a delete of entries did: ids deleted, already gone, and kept because they changed. */
export interface CacheStorageDeleteResult {
  deleted: string[];
  gone: string[];
  changed: string[];
}

/** The cache or the entry is not on the phone any more. */
export class CacheStorageGoneError extends Error {
  override name = "CacheStorageGoneError";
}

/** The page shows another origin than the one read, or has no Cache storage; nothing changed. */
export class CacheStorageWrongOriginError extends Error {
  override name = "CacheStorageWrongOriginError";
}

/** A cache holds another number of entries than the person saw; nothing was deleted. */
export class CacheStorageChangedError extends Error {
  override name = "CacheStorageChangedError";
  constructor(
    message: string,
    readonly count: number,
  ) {
    super(message);
  }
}

interface DeviceReply {
  error?: string;
  gone?: boolean;
  wrongOrigin?: boolean;
  unavailable?: boolean;
  changed?: boolean;
  count?: number;
}

function parseReply<T>(raw: unknown): T & DeviceReply {
  if (typeof raw !== "string") throw new DeviceEvaluationError("The phone sent no answer");
  const reply = JSON.parse(raw) as T & DeviceReply;
  if (reply.error != null) {
    if (reply.gone) throw new CacheStorageGoneError(reply.error);
    if (reply.wrongOrigin || reply.unavailable) throw new CacheStorageWrongOriginError(reply.error);
    if (reply.changed) throw new CacheStorageChangedError(reply.error, reply.count ?? 0);
    throw new DeviceEvaluationError(reply.error);
  }
  return reply;
}

/**
 * Cache storage (the Cache API a service worker fills) of the page, read and changed on the
 * phone through `Runtime.evaluate`. Every script checks the page still shows the origin that was
 * read and never creates a cache; deletes refuse what changed since it was read.
 */
export class CacheStorageDomain {
  constructor(private client: CDPClient) {}

  private async evaluate(expression: string): Promise<unknown> {
    const result = await evaluateChecked(this.client, {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result.value;
  }

  /** The page's caches and how many entries each holds. */
  async catalog(): Promise<CacheStorageCatalog> {
    return parseReply<CacheStorageCatalog>(await this.evaluate(catalogScript()));
  }

  /** The entries of one cache, in the phone's order (see `CACHE_ENTRY_READ_LIMIT`). */
  async entries(origin: string, cacheName: string): Promise<CacheStorageEntriesPage> {
    const reply = parseReply<CacheStorageEntriesPage>(
      await this.evaluate(entriesScript(origin, cacheName)),
    );
    return { entries: reply.entries, total: reply.total, described: reply.described };
  }

  /** One entry with all its headers and the start of its body. */
  async entry(
    origin: string,
    cacheName: string,
    entryId: string,
    maxBodyBytes = CACHE_BODY_PREVIEW_BYTES,
  ): Promise<CacheStorageEntryDetail> {
    return parseReply<CacheStorageEntryDetail>(
      await this.evaluate(entryScript(origin, cacheName, entryId, maxBodyBytes)),
    );
  }

  /**
   * Deletes entries of one cache. An entry whose response changed since it was read is kept
   * (listed in `changed`) unless `force`; throws `CacheStorageGoneError` when the cache is gone.
   */
  async deleteEntries(
    origin: string,
    cacheName: string,
    targets: readonly CacheEntryTarget[],
    force = false,
  ): Promise<CacheStorageDeleteResult> {
    const reply = parseReply<CacheStorageDeleteResult>(
      await this.evaluate(deleteEntriesScript(origin, cacheName, targets, force)),
    );
    return { deleted: reply.deleted, gone: reply.gone, changed: reply.changed };
  }

  /**
   * Deletes a whole cache. Throws `CacheStorageChangedError` when it no longer holds
   * `expectedCount` entries, unless `force`. Resolves `{ gone: true }` when it was already gone.
   */
  async deleteCache(
    origin: string,
    cacheName: string,
    expectedCount: number | null,
    force = false,
  ): Promise<{ gone: boolean }> {
    const reply = parseReply<{ gone?: boolean }>(
      await this.evaluate(deleteCacheScript(origin, cacheName, expectedCount, force)),
    );
    return { gone: reply.gone === true };
  }
}
