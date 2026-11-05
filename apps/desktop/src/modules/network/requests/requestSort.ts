import type { NetworkEntry } from "@/types/network.types";
import { durationMs, initiatorWord, requestName, typeWord } from "./requestCells";

export type RequestSortKey =
  | "name"
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
  name: (entry) => requestName(entry.url),
  method: (entry) => entry.method,
  status: (entry) => entry.httpStatus,
  type: (entry) => typeWord(entry),
  initiator: (entry) => initiatorWord(entry),
  size: (entry) => entry.transferSize,
  time: (entry) => durationMs(entry),
  start: (entry) => entry.startTimestamp,
};

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
  const read = VALUE[sort.key];
  const direction = sort.desc ? -1 : 1;
  return entries
    .map((entry, index) => ({ entry, index, value: read(entry) }))
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
