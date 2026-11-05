import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { NetworkEntry, NetworkTypeFilter } from "@/types/network.types";
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
import { estimateEntryBytes } from "./networkEntrySize";
import { networkFlushScheduler } from "./networkFlush";
import { headerText, matchesAddress, matchesType } from "./requestMatch";

interface CachedBody {
  text: string;
  lower: string;
  bytes: number;
}

interface BodyHit {
  query: string;
  revision: number;
  hit: boolean;
}

export type NetworkCaptureStatus = "idle" | "connecting" | "live" | "error";

const FILTER_FOCUS_TTL_MS = 5_000;
const INTERRUPTED_TEXT = "Capture restarted before this request finished";

/**
 * Captured requests. Entries live in plain maps and are replaced, never mutated, on every
 * update; a version counter, bumped at most a few times a second, tells views to re-read them.
 */
export const useNetworkStore = defineStore("network", () => {
  const _entries = new Map<string, NetworkEntry>();
  const _order: string[] = [];
  const _entryBytes = new Map<string, number>();
  const _bodyCache = new Map<string, CachedBody>();
  const _bodyOrder: string[] = [];
  const _bodyHits = new WeakMap<NetworkEntry, BodyHit>();
  let _historyBytes = 0;
  let _bodyBytes = 0;
  let _bodyRevision = 0;
  let _transferTotal = 0;
  let _resourceTotal = 0;

  const _version = ref(0);
  const schedule = networkFlushScheduler();
  const bump = () => {
    _version.value++;
  };

  const isRecording = ref(true);
  const selectedId = ref<string | null>(null);
  const filterText = ref("");
  const typeFilter = ref<NetworkTypeFilter>("All");
  const methodFilter = ref("All");
  const searchScope = ref<"url" | "all">("url");
  const preserveLog = ref(true);
  const focusSearchTrigger = ref(0);
  const captureStatus = ref<NetworkCaptureStatus>("idle");
  const captureTargetId = ref<string | null>(null);
  const captureError = ref<string | null>(null);

  const allEntries = computed<NetworkEntry[]>(() => {
    void _version.value;
    const list: NetworkEntry[] = [];
    for (const id of _order) {
      const entry = _entries.get(id);
      if (entry) list.push(entry);
    }
    return list;
  });

  function bodyHit(entry: NetworkEntry, query: string): boolean {
    const memo = _bodyHits.get(entry);
    if (memo && memo.query === query && memo.revision === _bodyRevision) return memo.hit;
    const hit =
      (_bodyCache.get(entry.requestId)?.lower.includes(query) ?? false) ||
      (_bodyCache.get(`${entry.requestId}:payload`)?.lower.includes(query) ?? false) ||
      headerText(entry).includes(query);
    _bodyHits.set(entry, { query, revision: _bodyRevision, hit });
    return hit;
  }

  const filteredEntries = computed<NetworkEntry[]>(() => {
    const query = filterText.value.trim().toLowerCase();
    const type = typeFilter.value;
    const method = methodFilter.value;
    const wide = searchScope.value === "all";
    return allEntries.value.filter((entry) => {
      if (method !== "All" && entry.method !== method) return false;
      if (!matchesType(entry, type)) return false;
      if (!query || matchesAddress(entry, query)) return true;
      return wide && bodyHit(entry, query);
    });
  });

  const selectedEntry = computed<NetworkEntry | null>(() => {
    void _version.value;
    return selectedId.value ? (_entries.get(selectedId.value) ?? null) : null;
  });

  const hasActiveFilters = computed(
    () =>
      filterText.value.trim() !== "" || typeFilter.value !== "All" || methodFilter.value !== "All",
  );

  const requestCount = computed(() => {
    void _version.value;
    return _order.length;
  });
  const retainedHistoryBytes = computed(() => {
    void _version.value;
    return _historyBytes;
  });
  const retainedBodyBytes = computed(() => {
    void _version.value;
    return _bodyBytes;
  });
  const retainedBodyCount = computed(() => {
    void _version.value;
    return _bodyOrder.length;
  });
  const transferredBytes = computed(() => {
    void _version.value;
    return _transferTotal;
  });
  const resourceBytes = computed(() => {
    void _version.value;
    return _resourceTotal;
  });

  function account(entry: NetworkEntry, sign: 1 | -1) {
    _transferTotal += sign * entry.transferSize;
    _resourceTotal += sign * entry.resourceSize;
  }

  function deleteCachedBody(key: string) {
    const cached = _bodyCache.get(key);
    if (!cached) return;
    _bodyBytes -= cached.bytes;
    _bodyCache.delete(key);
    _bodyRevision += 1;
    const orderIndex = _bodyOrder.indexOf(key);
    if (orderIndex >= 0) _bodyOrder.splice(orderIndex, 1);
  }

  function deleteEntry(requestId: string) {
    const existing = _entries.get(requestId);
    if (existing) account(existing, -1);
    _entries.delete(requestId);
    _historyBytes -= _entryBytes.get(requestId) ?? 0;
    _entryBytes.delete(requestId);
    deleteCachedBody(requestId);
    deleteCachedBody(`${requestId}:payload`);
    if (selectedId.value === requestId) selectedId.value = null;
  }

  function enforceEntryRetention() {
    while (_order.length > NETWORK_MAX_ENTRIES || _historyBytes > NETWORK_MAX_HISTORY_BYTES) {
      const oldest = _order.shift();
      if (!oldest) break;
      deleteEntry(oldest);
    }
  }

  function boundedEntry(entry: NetworkEntry): NetworkEntry {
    if (estimateEntryBytes(entry) <= NETWORK_MAX_ENTRY_BYTES) return entry;
    const withoutHeaders = { ...entry, requestHeaders: {}, responseHeaders: {} };
    if (estimateEntryBytes(withoutHeaders) <= NETWORK_MAX_ENTRY_BYTES) return withoutHeaders;
    return {
      ...withoutHeaders,
      url: truncateUtf8(withoutHeaders.url, 128 * 1024),
      statusText: truncateUtf8(withoutHeaders.statusText, 8 * 1024),
      mimeType: truncateUtf8(withoutHeaders.mimeType, 8 * 1024),
      protocol: truncateUtf8(withoutHeaders.protocol, 8 * 1024),
      remoteAddress: truncateUtf8(withoutHeaders.remoteAddress, 8 * 1024),
      initiatorUrl: withoutHeaders.initiatorUrl
        ? truncateUtf8(withoutHeaders.initiatorUrl, 128 * 1024)
        : undefined,
      errorText: withoutHeaders.errorText
        ? truncateUtf8(withoutHeaders.errorText, 8 * 1024)
        : undefined,
    };
  }

  function put(entry: NetworkEntry, measure: boolean) {
    const previous = _entries.get(entry.requestId);
    if (previous) account(previous, -1);
    _entries.set(entry.requestId, entry);
    account(entry, 1);
    if (measure) {
      _historyBytes -= _entryBytes.get(entry.requestId) ?? 0;
      const bytes = estimateEntryBytes(entry);
      _entryBytes.set(entry.requestId, bytes);
      _historyBytes += bytes;
    }
  }

  function addEntry(entry: NetworkEntry) {
    if (!isRecording.value) return;
    const retained = boundedEntry(entry);
    if (_entries.has(retained.requestId)) {
      const orderIndex = _order.indexOf(retained.requestId);
      if (orderIndex >= 0) _order.splice(orderIndex, 1);
      deleteEntry(retained.requestId);
    }
    put(retained, true);
    _order.push(retained.requestId);
    enforceEntryRetention();
    schedule(bump);
  }

  function patchEntry(requestId: string, patch: Partial<NetworkEntry>) {
    const existing = _entries.get(requestId);
    if (!existing) return;
    put(boundedEntry({ ...existing, ...patch }), true);
    enforceEntryRetention();
    schedule(bump);
  }

  /** A cheap update of counters only (frames, bytes): no strings change, so nothing is re-measured. */
  function bumpCounters(requestId: string, update: (entry: NetworkEntry) => Partial<NetworkEntry>) {
    const existing = _entries.get(requestId);
    if (!existing) return;
    put({ ...existing, ...update(existing) }, false);
    schedule(bump);
  }

  function countFrame(requestId: string) {
    bumpCounters(requestId, (entry) => ({ wsFrameCount: entry.wsFrameCount + 1 }));
  }

  function addReceived(requestId: string, dataLength: number, encodedLength: number) {
    bumpCounters(requestId, (entry) => ({
      resourceSize: entry.resourceSize + dataLength,
      transferSize: entry.transferSize + encodedLength,
    }));
  }

  /** Requests still open when capture restarted will never hear how they ended; say so. */
  function markInterrupted() {
    let changed = false;
    for (const entry of _entries.values()) {
      if (entry.state !== "pending" || entry.isWebSocket) continue;
      put({ ...entry, state: "failed", interrupted: true, errorText: INTERRUPTED_TEXT }, false);
      changed = true;
    }
    if (changed) schedule(bump);
  }

  function getEntry(requestId: string): NetworkEntry | undefined {
    return _entries.get(requestId);
  }

  /** The current version of a request, re-read whenever the list changes; null once evicted. */
  function entryById(requestId: string | null): NetworkEntry | null {
    void _version.value;
    return requestId ? (_entries.get(requestId) ?? null) : null;
  }

  function cacheBody(requestId: string, text: string) {
    deleteCachedBody(requestId);
    const retained = truncateUtf8(text, NETWORK_MAX_BODY_BYTES);
    const bytes = utf8ByteLength(retained);
    _bodyCache.set(requestId, { text: retained, lower: retained.toLowerCase(), bytes });
    _bodyOrder.push(requestId);
    _bodyBytes += bytes;
    _bodyRevision += 1;

    while (
      _bodyOrder.length > NETWORK_MAX_CACHED_BODIES ||
      _bodyBytes > NETWORK_MAX_BODY_CACHE_BYTES
    ) {
      const oldest = _bodyOrder[0];
      if (!oldest) break;
      deleteCachedBody(oldest);
    }
    schedule(bump);
  }

  /** A whole text body read earlier, or null when it was not read or was cut to fit. */
  function cachedBody(key: string): string | null {
    const cached = _bodyCache.get(key);
    if (!cached || cached.bytes >= NETWORK_MAX_BODY_BYTES) return null;
    return cached.text;
  }

  function clear() {
    _entries.clear();
    _order.length = 0;
    _entryBytes.clear();
    _historyBytes = 0;
    _bodyCache.clear();
    _bodyOrder.length = 0;
    _bodyBytes = 0;
    _bodyRevision += 1;
    _transferTotal = 0;
    _resourceTotal = 0;
    selectedId.value = null;
    _version.value++;
  }

  function clearFilters() {
    filterText.value = "";
    typeFilter.value = "All";
    methodFilter.value = "All";
  }

  function select(id: string | null) {
    selectedId.value = id;
  }

  let filterFocusAt = 0;

  /** Asks Requests to focus its filter, now or as soon as it opens (within a few seconds). */
  function triggerFocusSearch() {
    filterFocusAt = Date.now();
    focusSearchTrigger.value++;
  }

  /** Whether a recent filter-focus request is waiting; consumes it. */
  function takeFilterFocus(): boolean {
    const waiting = filterFocusAt > 0 && Date.now() - filterFocusAt < FILTER_FOCUS_TTL_MS;
    filterFocusAt = 0;
    return waiting;
  }

  function setCaptureState(
    status: NetworkCaptureStatus,
    targetId: string | null,
    error: string | null = null,
  ) {
    captureStatus.value = status;
    captureTargetId.value = targetId;
    captureError.value = error;
  }

  return {
    isRecording,
    selectedId,
    filterText,
    typeFilter,
    methodFilter,
    searchScope,
    preserveLog,
    focusSearchTrigger,
    captureStatus,
    captureTargetId,
    captureError,
    allEntries,
    filteredEntries,
    selectedEntry,
    hasActiveFilters,
    requestCount,
    retainedHistoryBytes,
    retainedBodyBytes,
    retainedBodyCount,
    transferredBytes,
    resourceBytes,
    addEntry,
    patchEntry,
    countFrame,
    addReceived,
    markInterrupted,
    getEntry,
    entryById,
    cacheBody,
    cachedBody,
    clear,
    clearFilters,
    select,
    triggerFocusSearch,
    takeFilterFocus,
    setCaptureState,
  };
});
