import type { NetworkEntry } from "@/types/network.types";
import { durationMs, initiatorWord, typeWord } from "./requestCells";
import { requestNameParts } from "./requestNames";

export type RequestSortKey =
  | "name"
  | "path"
  | "host"
  | "method"
  | "status"
  | "type"
  | "initiator"
  | "size"
  | "time"
  | "start";

export interface RequestSort {
  key: RequestSortKey;
  desc: boolean;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

type SortValue = number | string | null;

const VALUE: Record<RequestSortKey, (entry: NetworkEntry) => SortValue> = {
  name: (entry) => requestNameParts(entry.url).main,
  path: (entry) => requestNameParts(entry.url).path || null,
  host: (entry) => requestNameParts(entry.url).host || null,
  method: (entry) => entry.method,
  status: (entry) => entry.httpStatus,
  type: (entry) => typeWord(entry),
  initiator: (entry) => initiatorWord(entry),
  size: (entry) => entry.transferSize || entry.resourceSize,
  time: (entry) => durationMs(entry),
  start: (entry) => entry.startTimestamp,
};

const CACHED_KEYS = new Set<RequestSortKey>(["name", "path", "host", "type", "initiator"]);
const keyCache = new WeakMap<NetworkEntry, Partial<Record<RequestSortKey, SortValue>>>();

/** A sort value; the string ones are kept per entry object, which is replaced on every update. */
function sortValue(entry: NetworkEntry, key: RequestSortKey): SortValue {
  if (!CACHED_KEYS.has(key)) return VALUE[key](entry);
  let keys = keyCache.get(entry);
  if (!keys) {
    keys = {};
    keyCache.set(entry, keys);
  }
  if (!(key in keys)) keys[key] = VALUE[key](entry);
  return keys[key] ?? null;
}

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Rows in the chosen order, or as captured when no column is chosen. Rows without a value (no
 * status yet, still running) stay last in both directions, and equal rows keep arrival order.
 */
export function sortRequests(
  entries: readonly NetworkEntry[],
  sort: RequestSort | null,
): readonly NetworkEntry[] {
  if (!sort) return entries;
  const key = sort.key;
  const direction = sort.desc ? -1 : 1;
  return entries
    .map((entry, index) => ({ entry, index, value: sortValue(entry, key) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      return compareValues(a.value, b.value) * direction || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** The next sort after a header click: ascending, then descending, then capture order. */
export function nextSort(current: RequestSort | null, key: RequestSortKey): RequestSort | null {
  if (current?.key !== key) return { key, desc: false };
  return current.desc ? null : { key, desc: true };
}
