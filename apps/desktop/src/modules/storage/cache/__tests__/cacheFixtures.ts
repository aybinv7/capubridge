import type { CacheStorageEntry, CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";

export const EMPTY_SETTINGS: SourceSettings = {
  pinned: false,
  hidden: false,
  expanded: true,
  pinnedItems: [],
  hiddenItems: [],
};

/** A list-read entry; `contentType` and `size` describe its response. */
export function entry(options: {
  id: string;
  url: string;
  contentType?: string;
  size?: number | null;
  status?: number;
  type?: string;
  version?: string;
}): CacheStorageEntry {
  return {
    id: options.id,
    url: options.url,
    method: "GET",
    version: options.version ?? `v-${options.id}`,
    response: {
      status: options.status ?? 200,
      statusText: "",
      type: options.type ?? "basic",
      redirected: false,
      headers: {
        date: "Thu, 05 Nov 2026 10:00:00 GMT",
        ...(options.contentType ? { "content-type": options.contentType } : {}),
      },
      size: options.size === undefined ? 100 : options.size,
    },
  };
}

/** A full read of one entry with `body` as text. */
export function detail(options: {
  body: string;
  contentType: string;
  size: number | null;
  read?: number;
}): CacheStorageEntryDetail {
  return {
    id: "e",
    url: "https://app.test/e",
    method: "GET",
    version: "v",
    requestHeaders: {},
    requestMode: null,
    response: {
      status: 200,
      statusText: "OK",
      type: "basic",
      redirected: false,
      url: "https://app.test/e",
      headers: { "content-type": options.contentType },
      size: options.size,
    },
    body: { body: options.body, base64Encoded: false, read: options.read ?? options.body.length },
  };
}
