import { jsLiteral } from "../evaluate.js";

/** How many entries of one cache a read describes at most. */
export const CACHE_ENTRY_READ_LIMIT = 2000;

/** How long a read spends asking for responses before it returns what it has. */
export const CACHE_DETAIL_BUDGET_MS = 5000;

/** How many body bytes the entry pane reads at most. */
export const CACHE_BODY_PREVIEW_BYTES = 1024 * 1024;

/** How many bytes from the start of a body go into its fingerprint (with the full size). */
export const CACHE_VERSION_BODY_BYTES = 32 * 1024;

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
 * is fingerprinted by its status, type, headers, body size and the first
 * `CACHE_VERSION_BODY_BYTES` of its body, so a delete can tell it was replaced.
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
function __cbHashBytes(bytes) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index++) {
    hash ^= bytes[index];
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
function __cbOpaque(response) {
  return response.type === 'opaque' || response.type === 'opaqueredirect';
}
async function __cbDescribe(response) {
  if (!response) return { version: '', size: null };
  const head = response.status + '|' + response.statusText + '|' + response.type + '|' + __cbHeaderText(response.headers);
  let size = null;
  let body = 'opaque';
  if (!__cbOpaque(response)) {
    try {
      const blob = await response.clone().blob();
      size = blob.size;
      const start = new Uint8Array(await blob.slice(0, ${CACHE_VERSION_BODY_BYTES}).arrayBuffer());
      body = size + ':' + __cbHashBytes(start);
    } catch (e) {
      body = 'unreadable';
    }
  }
  return { version: __cbHash(head + '|' + body), size };
}
function __cbHeaders(headers, only) {
  const out = {};
  for (const pair of headers) {
    const name = String(pair[0]).toLowerCase();
    if (!only || only.indexOf(name) >= 0) out[name] = String(pair[1]);
  }
  return out;
}
function __cbMessage(e) {
  return e && e.message ? e.message : String(e);
}
function __cbFailure(e) {
  return JSON.stringify({ error: __cbMessage(e) });
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
function __cbFingerprint(requests) {
  return __cbHash(requests.map(__cbId).sort().join('\n'));
}
async function __cbFind(cache, id) {
  const first = id.indexOf(' ');
  const last = id.lastIndexOf(' ');
  if (first > 0 && last > first) {
    try {
      const probe = new Request(id.slice(first + 1, last), { method: id.slice(0, first) });
      const narrowed = await cache.keys(probe, { ignoreVary: true });
      for (const request of narrowed) if (__cbId(request) === id) return request;
    } catch (e) {
      void e;
    }
  }
  for (const request of await cache.keys()) if (__cbId(request) === id) return request;
  return null;
}
`;

/** Every cache of the page's origin with its entry count and the fingerprint of its entries. */
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
          const requests = cache ? await cache.keys() : [];
          return { name, count: requests.length, fingerprint: __cbFingerprint(requests) };
        } catch (e) {
          return { name, count: null, fingerprint: null };
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
 * summary of its response (status, type, the list headers, body size, fingerprint) while the
 * read stays inside `CACHE_DETAIL_BUDGET_MS`. Entries past the budget come back without one.
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
          const described = await __cbDescribe(response);
          row.version = described.version;
          row.response = {
            status: response.status,
            statusText: response.statusText,
            type: response.type,
            redirected: response.redirected === true,
            headers: __cbHeaders(response.headers, only),
            size: described.size,
          };
          return row;
        }));
        for (let index = 0; index < rows.length; index++) {
          entries[start + index] = rows[index];
          if (rows[index].response) described++;
        }
      }
      return JSON.stringify({ entries, total: requests.length, described, fingerprint: __cbFingerprint(requests) });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/**
 * One entry in full: its stored request headers, its response headers and up to
 * `maxBodyBytes` of its body (text as text, anything else as Base64). With `maxBodyBytes` 0 the
 * body is not read.
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
      const request = await __cbFind(cache, id);
      if (!request) return JSON.stringify({ error: 'This entry is not in "' + name + '" any more', gone: true });
      const response = await cache.match(request);
      if (!response) return JSON.stringify({ error: 'This entry is not in "' + name + '" any more', gone: true });
      const described = await __cbDescribe(response);
      let body = null;
      if (!__cbOpaque(response) && cap > 0) {
        const blob = await response.clone().blob();
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
        version: described.version,
        requestHeaders: __cbHeaders(request.headers, null),
        requestMode: request.mode || null,
        response: {
          status: response.status,
          statusText: response.statusText,
          type: response.type,
          redirected: response.redirected === true,
          url: response.url || null,
          headers: __cbHeaders(response.headers, null),
          size: described.size,
        },
        body,
      });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/** The response fingerprint of each entry in `ids` that is still in the cache. */
export function versionsScript(origin: string, cacheName: string, ids: readonly string[]): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const name = ${jsLiteral(cacheName)};
    const ids = ${jsLiteral(ids)};
    try {
      const refused = __cbGuard(origin);
      if (refused) return refused;
      const cache = await __cbCache(name);
      if (!cache) return JSON.stringify({ error: 'The cache "' + name + '" is not on the phone any more', gone: true });
      const wanted = new Set(ids);
      const versions = {};
      for (const request of await cache.keys()) {
        const id = __cbId(request);
        if (!wanted.has(id) || versions[id] !== undefined) continue;
        versions[id] = (await __cbDescribe(await cache.match(request))).version;
      }
      return JSON.stringify({ versions });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/** An entry a delete is aimed at, with the response fingerprint the person saw. */
export interface CacheEntryTarget {
  id: string;
  /** The response fingerprint as seen; empty means unknown, and the entry is kept unless forced. */
  version: string;
}

/**
 * Deletes entries of one cache. Each entry is found by its id; one whose response is not the one
 * the person saw (or was never read) is kept unless `force` (the person said yes), one already
 * gone is named. An entry whose delete would also remove another entry the person did not
 * choose (a Vary sibling the browser matches the same way) is kept in `shared`; one that fails
 * is named in `failed` and the rest go on. `extra` counts entries the browser removed beyond
 * those it matched. Never creates the cache.
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
      const all = await cache.keys();
      const byId = new Map();
      for (const request of all) {
        const id = __cbId(request);
        if (!byId.has(id)) byId.set(id, request);
      }
      const chosen = new Set(targets.map((target) => target.id));
      const handled = new Set();
      const out = { deleted: [], gone: [], changed: [], shared: [], failed: [], extra: 0 };
      let matched = 0;
      for (const target of targets) {
        if (handled.has(target.id)) continue;
        try {
          const request = byId.get(target.id);
          if (!request) {
            out.gone.push(target.id);
            continue;
          }
          if (!force) {
            const now = target.version ? (await __cbDescribe(await cache.match(request))).version : '';
            if (!target.version || now !== target.version) {
              out.changed.push(target.id);
              continue;
            }
          }
          const matches = (await cache.keys(request)).map(__cbId);
          if (matches.some((id) => id !== target.id && !chosen.has(id))) {
            out.shared.push(target.id);
            continue;
          }
          if (await cache.delete(request)) {
            matched += Math.max(matches.length, 1);
            for (const id of matches.indexOf(target.id) < 0 ? matches.concat([target.id]) : matches) {
              if (handled.has(id)) continue;
              handled.add(id);
              out.deleted.push(id);
            }
          } else {
            out.gone.push(target.id);
          }
        } catch (e) {
          out.failed.push({ id: target.id, error: __cbMessage(e) });
        }
      }
      if (out.deleted.length > 0) {
        try {
          const removed = all.length - (await cache.keys()).length;
          out.extra = Math.max(0, removed - matched);
        } catch (e) {
          void e;
        }
      }
      return JSON.stringify(out);
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}

/** What a whole-cache delete expects the cache to hold, as the person saw it. */
export interface CacheExpectation {
  count: number;
  /** The fingerprint of its entries (see `catalogScript`); `null` checks the count only. */
  fingerprint: string | null;
}

/**
 * Deletes a whole cache. When it no longer holds the entries the person saw (another count, or
 * other entries), it is kept and the reply says how many it holds, unless `force`.
 */
export function deleteCacheScript(
  origin: string,
  cacheName: string,
  expected: CacheExpectation | null,
  force: boolean,
): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const name = ${jsLiteral(cacheName)};
    const expected = ${jsLiteral(expected)};
    const force = ${jsLiteral(force)};
    try {
      const refused = __cbGuard(origin);
      if (refused) return refused;
      const cache = await __cbCache(name);
      if (!cache) return JSON.stringify({ ok: true, gone: true });
      if (!force && expected !== null) {
        const requests = await cache.keys();
        const count = requests.length;
        if (count !== expected.count) {
          return JSON.stringify({ error: 'The cache "' + name + '" now holds ' + count + ' entries, not ' + expected.count + '; nothing was deleted', changed: true, count });
        }
        if (expected.fingerprint !== null && __cbFingerprint(requests) !== expected.fingerprint) {
          return JSON.stringify({ error: 'The cache "' + name + '" now holds other entries than the ones read; nothing was deleted', changed: true, count });
        }
      }
      const removed = await caches.delete(name);
      return JSON.stringify({ ok: true, gone: !removed });
    } catch (e) {
      return __cbFailure(e);
    }
  })()`;
}
