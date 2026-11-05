import type { NetworkEntry } from "@/types/network.types";

const FIXED_BYTES = 512;
const headerBytes = new WeakMap<Record<string, string>, number>();

function headersSize(headers: Record<string, string>): number {
  let size = headerBytes.get(headers);
  if (size === undefined) {
    size = 0;
    for (const [name, value] of Object.entries(headers)) size += name.length + value.length + 6;
    headerBytes.set(headers, size);
  }
  return size;
}

/**
 * Roughly how much memory an entry holds, from string lengths (UTF-16, two bytes a character)
 * instead of serialising it. Header sizes are cached per headers object, which a patch reuses.
 */
export function estimateEntryBytes(entry: NetworkEntry): number {
  const text =
    entry.url.length +
    entry.statusText.length +
    entry.mimeType.length +
    entry.protocol.length +
    entry.remoteAddress.length +
    (entry.initiatorUrl?.length ?? 0) +
    (entry.errorText?.length ?? 0) +
    headersSize(entry.requestHeaders) +
    headersSize(entry.responseHeaders);
  return FIXED_BYTES + text * 2;
}
