import type { NetworkEntry } from "@/types/network.types";

function contentLength(headers: Record<string, string>): number {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== "content-length") continue;
    const bytes = Number.parseInt(value, 10);
    return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  }
  return 0;
}

/**
 * Sizes once a request finishes. CDP's final `encodedDataLength` is 0 for files the app serves
 * itself (Android's `shouldInterceptRequest`), so the bytes counted from `dataReceived` stand,
 * and the body size falls back to Content-Length when no chunk was reported.
 */
export function finishedSizes(
  entry: NetworkEntry | undefined,
  encodedDataLength: number,
): Pick<NetworkEntry, "transferSize" | "resourceSize"> {
  const transferSize = encodedDataLength > 0 ? encodedDataLength : (entry?.transferSize ?? 0);
  const received = entry?.resourceSize ?? 0;
  return {
    transferSize,
    resourceSize: received > 0 ? received : contentLength(entry?.responseHeaders ?? {}),
  };
}
