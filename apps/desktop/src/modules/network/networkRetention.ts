export const NETWORK_MAX_ENTRIES = 5_000;
export const NETWORK_MAX_ENTRY_BYTES = 512 * 1024;
export const NETWORK_MAX_HISTORY_BYTES = 24 * 1024 * 1024;
export const NETWORK_MAX_CACHED_BODIES = 1_000;
export const NETWORK_MAX_BODY_BYTES = 2 * 1024 * 1024;
export const NETWORK_MAX_BODY_CACHE_BYTES = 32 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function estimateSerializedBytes(value: unknown): number {
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return utf8ByteLength(String(value));
  }
}

export function truncateUtf8(value: string, maximumBytes: number): string {
  if (maximumBytes <= 0) return "";
  const encoded = encoder.encode(value);
  if (encoded.byteLength <= maximumBytes) return value;
  let end = maximumBytes;
  while (end > 0) {
    try {
      return strictDecoder.decode(encoded.subarray(0, end));
    } catch {
      end -= 1;
    }
  }
  return decoder.decode();
}
