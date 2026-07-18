import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { NetworkEntry } from "@/types/network.types";
import {
  NETWORK_MAX_BODY_BYTES,
  NETWORK_MAX_BODY_CACHE_BYTES,
  NETWORK_MAX_CACHED_BODIES,
  NETWORK_MAX_ENTRIES,
  NETWORK_MAX_ENTRY_BYTES,
  NETWORK_MAX_HISTORY_BYTES,
  truncateUtf8,
  utf8ByteLength,
} from "../networkRetention";
import { useNetworkStore } from "../stores/useNetworkStore";

function createEntry(requestId: string, urlSuffix = ""): NetworkEntry {
  return {
    requestId,
    url: `https://example.test/${requestId}${urlSuffix}`,
    method: "GET",
    requestHeaders: {},
    hasPostData: false,
    httpStatus: 200,
    statusText: "OK",
    responseHeaders: {},
    mimeType: "application/json",
    protocol: "h2",
    remoteAddress: "127.0.0.1",
    startedAt: 0,
    startTimestamp: 0,
    responseTimestamp: 1,
    finishedTimestamp: 2,
    timing: null,
    transferSize: 0,
    state: "finished",
    resourceType: "Fetch",
    fromDiskCache: false,
    fromServiceWorker: false,
    fromPrefetchCache: false,
    initiatorType: "fetch",
    isWebSocket: false,
    wsFrameCount: 0,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

describe("network retention", () => {
  test("truncates at a valid UTF-8 boundary", () => {
    const value = `abc${"😀".repeat(10)}`;
    const truncated = truncateUtf8(value, 8);

    expect(utf8ByteLength(truncated)).toBeLessThanOrEqual(8);
    expect(truncated).not.toContain("�");
  });

  test("evicts oldest entries by count", () => {
    const store = useNetworkStore();
    store.select("request-0");

    for (let index = 0; index <= NETWORK_MAX_ENTRIES; index += 1) {
      store.addEntry(createEntry(`request-${index}`));
    }

    expect(store.requestCount).toBe(NETWORK_MAX_ENTRIES);
    expect(store.getEntry("request-0")).toBeUndefined();
    expect(store.selectedId).toBeNull();
    expect(store.retainedHistoryBytes).toBeLessThanOrEqual(NETWORK_MAX_HISTORY_BYTES);
  });

  test("replaces duplicate request identifiers without duplicating order", () => {
    const store = useNetworkStore();

    store.addEntry(createEntry("duplicate"));
    store.addEntry(createEntry("duplicate", "?updated=true"));

    expect(store.requestCount).toBe(1);
    expect(store.getEntry("duplicate")?.url).toContain("updated=true");
  });

  test("bounds oversized entry metadata", () => {
    const store = useNetworkStore();
    const entry = createEntry("oversized-entry", "x".repeat(NETWORK_MAX_ENTRY_BYTES * 2));
    entry.requestHeaders = { oversized: "x".repeat(NETWORK_MAX_ENTRY_BYTES) };

    store.addEntry(entry);

    expect(store.retainedHistoryBytes).toBeLessThanOrEqual(NETWORK_MAX_ENTRY_BYTES);
  });

  test("bounds cached body count and individual body bytes", () => {
    const store = useNetworkStore();
    const oversized = "😀".repeat(NETWORK_MAX_BODY_BYTES);

    store.cacheBody("oversized", oversized);
    for (let index = 0; index < NETWORK_MAX_CACHED_BODIES; index += 1) {
      store.cacheBody(`body-${index}`, "body");
    }

    expect(store.retainedBodyCount).toBe(NETWORK_MAX_CACHED_BODIES);
    expect(store.retainedBodyBytes).toBeLessThanOrEqual(NETWORK_MAX_BODY_CACHE_BYTES);
    expect(utf8ByteLength(truncateUtf8(oversized, NETWORK_MAX_BODY_BYTES))).toBeLessThanOrEqual(
      NETWORK_MAX_BODY_BYTES,
    );
  });
});
