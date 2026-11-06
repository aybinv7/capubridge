import type { CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import type { KeyValueRow } from "@/shared/http/keyValueRow";
import { formatDateWords } from "@/shared/format/dates";
import { formatBytes } from "@/shared/format/numbers";
import { freshnessOf, freshnessWords, formatDuration } from "./cacheFreshness";
import { responseTypeWords, type CacheRow } from "./cacheModel";

function sizeText(row: CacheRow, detail: CacheStorageEntryDetail | undefined): string {
  if (row.opaque) return "Hidden from the page (opaque)";
  const size = detail?.response.size ?? row.size;
  return size === null ? "Not measured" : formatBytes(size);
}

/**
 * The General facts of a cached entry: what was asked, what came back, when the server sent it
 * and what its headers say about its lifetime. The full read (`detail`) adds what the list read
 * leaves out.
 */
export function generalFacts(
  row: CacheRow,
  detail: CacheStorageEntryDetail | undefined,
  now: number,
): KeyValueRow[] {
  const headers = detail?.response.headers ?? row.headers;
  const freshness = freshnessOf(headers, now);
  const rows: KeyValueRow[] = [
    { key: "Address", value: row.url },
    { key: "Method", value: row.method },
  ];
  if (row.opaque) {
    rows.push({ key: "Status", value: "Hidden from the page (opaque)", tone: "subtle" });
  } else if (row.status !== null) {
    const text = detail?.response.statusText ?? "";
    rows.push({
      key: "Status",
      value: `${row.status}${text ? ` ${text}` : ""}`,
      tone: row.statusTone,
    });
  }
  rows.push({ key: "Response type", value: responseTypeWords(row.responseType) });
  const finalUrl = detail?.response.url;
  if (finalUrl && finalUrl !== row.url) rows.push({ key: "Answered from", value: finalUrl });
  if (detail?.response.redirected)
    rows.push({ key: "Redirected", value: "Yes, before it was stored" });
  rows.push({ key: "Size", value: sizeText(row, detail) });
  if (freshness.servedAt !== null) {
    const age = freshness.ageMs === null ? "" : ` · ${formatDuration(freshness.ageMs)} old`;
    rows.push({
      key: "Served",
      value: `${formatDateWords(freshness.servedAt, now)}${age}`,
    });
  }
  if (!row.opaque) {
    rows.push({
      key: "HTTP lifetime",
      value: freshnessWords(freshness),
      tone: freshness.state === "expired" ? "warning" : "default",
    });
  }
  rows.push({
    key: "Kept",
    value: "Until the app deletes it: Cache storage does not expire entries",
    tone: "muted",
  });
  if (detail?.requestMode) rows.push({ key: "Request mode", value: detail.requestMode });
  return rows;
}
