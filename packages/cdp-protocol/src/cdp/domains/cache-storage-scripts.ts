import { jsLiteral } from "../evaluate.js";

/** How many entries of one cache a read describes at most. */
export const CACHE_ENTRY_READ_LIMIT = 2000;

/** How long a read spends asking for responses before it returns what it has. */
export const CACHE_DETAIL_BUDGET_MS = 5000;

/** How many body bytes the entry pane reads at most. */
export const CACHE_BODY_PREVIEW_BYTES = 1024 * 1024;

/** Response headers a list read returns; the entry read returns all of them. */
export const CACHE_LIST_HEADERS = [
  "content-type",
  "content-length",
  "date",
  "cache-control",
  "expires",
  "age",
  "last-modified",
  "etag",
  "vary",
] as const;

/**
 * Helpers every Cache storage script shares. An entry is named by its method, address and the
 * hash of its stored request headers (so Vary variants of one address stay apart); a response
 * is fingerprinted by its status, type and headers, so a delete can tell it was replaced.
 */
const HELPERS = String.raw`
function __cbHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
function __cbHeaderText(headers) {
  return Array.from(headers)
    .map((pair) => [String(pair[0]).toLowerCase(), String(pair[1])])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map((pair) => pair[0] + ':' + pair[1])
    .join('\n');
}
function __cbId(request) {
  return request.method + ' ' + request.url + ' ' + __cbHash(__cbHeaderText(request.headers));
}
function __cbVersion(response) {
  if (!response) return '';
  return __cbHash(response.status + '|' + response.statusText + '|' + response.type + '|' + __cbHeaderText(response.headers));
}
function __cbHeaders(headers, only) {
  const out = {};
  for (const pair of headers) {
    const name = String(pair[0]).toLowerCase();
    if (!only || only.indexOf(name) >= 0) out[name] = String(pair[1]);
  }
  return out;
}
function __cbFailure(e) {
  return JSON.stringify({ error: e && e.message ? e.message : String(e) });
}
function __cbGuard(origin) {
  if (typeof caches === 'undefined') {
    return JSON.stringify({ error: 'This page has no Cache storage: it needs a secure page (https or localhost)', unavailable: true });
  }
  if (origin !== null && location.origin !== origin) {
    return JSON.stringify({ error: 'The page now shows ' + location.origin + ', not ' + origin + '; nothing was changed', wrongOrigin: true });
  }
  return null;
}
async function __cbCache(name) {
  if (!(await caches.has(name))) return null;
  return caches.open(name);
}
async function __cbSize(response) {
  if (!response || response.type === 'opaque' || response.type === 'opaqueredirect') return null;
  try {
    return (await response.clone().blob()).size;
  } catch (e) {
    return null;
  }
}
`;

/** Every cache of the page's origin with its entry count; never creates a cache. */
export function catalogScript(): string {
  return `(async () => {
    ${HELPERS}
    try {
      if (typeof caches === 'undefined') {
        return JSON.stringify({ origin: location.origin, available: false, caches: [] });
      }
      const names = await caches.keys();
      const list = await Promise.all(names.map(async (name) => {
        try {
          const cache = await __cbCache(name);
          return { name, count: cache ? (await cache.keys()).length : 0 };
        } catch (e) {
          return { name, count: null };
        }
      }));
      return JSON.stringify({ origin: location.origin, available: true, caches: list });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/**
 * The entries of one cache, in the phone's order: up to `CACHE_ENTRY_READ_LIMIT`, each with a
 * summary of its response (status, type, the list headers, body size) while the read stays
 * inside `CACHE_DETAIL_BUDGET_MS`. Entries past the budget come back without one.
 */
export function entriesScript(origin: string, cacheName: string): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const name = ${jsLiteral(cacheName)};
    const only = ${jsLiteral(CACHE_LIST_HEADERS)};
    try {
      const refused = __cbGuard(origin);
      if (refused) return refused;
      const cache = await __cbCache(name);
      if (!cache) return JSON.stringify({ error: 'The cache "' + name + '" is not on the phone any more', gone: true });
      const requests = await cache.keys();
      const shown = requests.slice(0, ${CACHE_ENTRY_READ_LIMIT});
      const started = Date.now();
      const entries = new Array(shown.length);
      let described = 0;
      for (let start = 0; start < shown.length; start += 24) {
        const batch = shown.slice(start, start + 24);
        const late = Date.now() - started > ${CACHE_DETAIL_BUDGET_MS};
        const rows = await Promise.all(batch.map(async (request) => {
          const row = { id: __cbId(request), url: request.url, method: request.method, version: '', response: null };
          if (late) return row;
          const response = await cache.match(request);
          if (!response) return row;
          row.version = __cbVersion(response);
          row.response = {
            status: response.status,
            statusText: response.statusText,
            type: response.type,
            redirected: response.redirected === true,
            headers: __cbHeaders(response.headers, only),
            size: await __cbSize(response),
          };
          return row;
        }));
        for (let index = 0; index < rows.length; index++) {
          entries[start + index] = rows[index];
          if (rows[index].response) described++;
        }
      }
      return JSON.stringify({ entries, total: requests.length, described });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/**
 * One entry in full: its stored request headers, its response headers and up to
 * `maxBodyBytes` of its body (text as text, anything else as Base64).
 */
export function entryScript(
  origin: string,
  cacheName: string,
  entryId: string,
  maxBodyBytes: number,
): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const name = ${jsLiteral(cacheName)};
    const id = ${jsLiteral(entryId)};
    const cap = ${jsLiteral(maxBodyBytes)};
    const textType = /^(text\\/|application\\/(json|.*\\+json|javascript|ecmascript|xml|.*\\+xml|x-www-form-urlencoded|graphql)|image\\/svg\\+xml)/i;
    try {
      const refused = __cbGuard(origin);
      if (refused) return refused;
      const cache = await __cbCache(name);
      if (!cache) return JSON.stringify({ error: 'The cache "' + name + '" is not on the phone any more', gone: true });
      const request = (await cache.keys()).find((candidate) => __cbId(candidate) === id);
      if (!request) return JSON.stringify({ error: 'This entry is not in "' + name + '" any more', gone: true });
      const response = await cache.match(request);
      if (!response) return JSON.stringify({ error: 'This entry is not in "' + name + '" any more', gone: true });
      const opaque = response.type === 'opaque' || response.type === 'opaqueredirect';
      let body = null;
      let size = null;
      if (!opaque) {
        const blob = await response.clone().blob();
        size = blob.size;
        const part = blob.size > cap ? blob.slice(0, cap) : blob;
        const bytes = new Uint8Array(await part.arrayBuffer());
        const type = response.headers.get('content-type') || blob.type || '';
        if (textType.test(type.split(';')[0].trim())) {
          body = { body: new TextDecoder().decode(bytes), base64Encoded: false, read: bytes.length };
        } else {
          let binary = '';
          for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
          }
          body = { body: btoa(binary), base64Encoded: true, read: bytes.length };
        }
      }
      return JSON.stringify({
        id,
        url: request.url,
        method: request.method,
        version: __cbVersion(response),
        requestHeaders: __cbHeaders(request.headers, null),
        requestMode: request.mode || null,
        response: {
          status: response.status,
          statusText: response.statusText,
          type: response.type,
          redirected: response.redirected === true,
          url: response.url || null,
          headers: __cbHeaders(response.headers, null),
          size,
        },
        body,
      });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/** An entry a delete is aimed at, with the response fingerprint the person saw. */
export interface CacheEntryTarget {
  id: string;
  /** The response fingerprint as read; empty when the response was not read. */
  version: string;
}

/**
 * Deletes entries of one cache. Each entry is found by its id; one whose response changed
 * since it was read is kept unless `force` (the person said yes), one already gone is named.
 * Never creates the cache.
 */
export function deleteEntriesScript(
  origin: string,
  cacheName: string,
  targets: readonly CacheEntryTarget[],
  force: boolean,
): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const name = ${jsLiteral(cacheName)};
    const targets = ${jsLiteral(targets)};
    const force = ${jsLiteral(force)};
    try {
      const refused = __cbGuard(origin);
      if (refused) return refused;
      const cache = await __cbCache(name);
      if (!cache) return JSON.stringify({ error: 'The cache "' + name + '" is not on the phone any more; nothing was deleted', gone: true });
      const byId = new Map();
      for (const request of await cache.keys()) {
        const id = __cbId(request);
        if (!byId.has(id)) byId.set(id, request);
      }
      const deleted = [];
      const gone = [];
      const changed = [];
      for (const target of targets) {
        const request = byId.get(target.id);
        if (!request) {
          gone.push(target.id);
          continue;
        }
        if (!force && target.version) {
          const now = __cbVersion(await cache.match(request));
          if (now !== target.version) {
            changed.push(target.id);
            continue;
          }
        }
        if (await cache.delete(request)) deleted.push(target.id);
        else gone.push(target.id);
      }
      return JSON.stringify({ ok: true, deleted, gone, changed });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/**
 * Deletes a whole cache. When it no longer holds the `expectedCount` entries the person saw,
 * it is kept and the reply says how many it holds, unless `force`.
 */
export function deleteCacheScript(
  origin: string,
  cacheName: string,
  expectedCount: number | null,
  force: boolean,
): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const name = ${jsLiteral(cacheName)};
    const expected = ${jsLiteral(expectedCount)};
    const force = ${jsLiteral(force)};
    try {
      const refused = __cbGuard(origin);
      if (refused) return refused;
      const cache = await __cbCache(name);
      if (!cache) return JSON.stringify({ ok: true, gone: true });
      if (!force && expected !== null) {
        const count = (await cache.keys()).length;
        if (count !== expected) {
          return JSON.stringify({ error: 'The cache "' + name + '" now holds ' + count + ' entries, not ' + expected + '; nothing was deleted', changed: true, count });
        }
      }
      const removed = await caches.delete(name);
      return JSON.stringify({ ok: true, gone: !removed });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}
