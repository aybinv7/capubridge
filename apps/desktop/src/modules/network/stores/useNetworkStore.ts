import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { NetworkEntry, NetworkTypeFilter } from "@/types/network.types";
import {
  NETWORK_MAX_BODY_BYTES,
  NETWORK_MAX_BODY_CACHE_BYTES,
  NETWORK_MAX_CACHED_BODIES,
  NETWORK_MAX_ENTRIES,
  NETWORK_MAX_ENTRY_BYTES,
  NETWORK_MAX_HISTORY_BYTES,
  estimateSerializedBytes,
  truncateUtf8,
  utf8ByteLength,
} from "../networkRetention";

interface CachedBody {
  text: string;
  bytes: number;
}

export const useNetworkStore = defineStore("network", () => {
  // Raw mutable data — not Vue-reactive directly; version counter drives updates
  const _entries = new Map<string, NetworkEntry>();
  const _order: string[] = [];
  const _entryBytes = new Map<string, number>();
  const _bodyCache = new Map<string, CachedBody>();
  const _bodyOrder: string[] = [];
  let _historyBytes = 0;
  let _bodyBytes = 0;

  const _version = ref(0);
  let _rafPending = false;

  function _scheduleFlush() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      _version.value++;
    });
  }

  // UI state
  const isRecording = ref(true);
  const selectedId = ref<string | null>(null);
  const filterText = ref("");
  const typeFilter = ref<NetworkTypeFilter>("All");
  const methodFilter = ref("All");
  const searchScope = ref<"url" | "all">("url");
  const preserveLog = ref(true);
  const focusSearchTrigger = ref(0);

  // Derived
  const allEntries = computed<NetworkEntry[]>(() => {
    void _version.value;
    return _order.map((id) => _entries.get(id)!).filter(Boolean);
  });

  const filteredEntries = computed<NetworkEntry[]>(() => {
    const q = filterText.value.trim().toLowerCase();
    const type = typeFilter.value;
    const method = methodFilter.value;
    const scope = searchScope.value;

    return allEntries.value.filter((e) => {
      // method filter
      if (method !== "All" && e.method !== method) return false;

      // type filter
      if (type !== "All") {
        if (type === "WS") return e.isWebSocket;
        if (type === "XHR/Fetch") {
          const isXhrFetch =
            e.resourceType === "Fetch" ||
            e.resourceType === "XHR" ||
            e.initiatorType === "fetch" ||
            e.initiatorType === "xmlhttprequest";
          if (!isXhrFetch) return false;
        }
        if (type === "Doc" && e.resourceType !== "Document") return false;
        if (type === "Img" && e.resourceType !== "Image") return false;
        if (type === "Media" && e.resourceType !== "Media") return false;
        if (type === "Font" && e.resourceType !== "Font") return false;
        if (type === "Script" && e.resourceType !== "Script") return false;
        if (type === "Preflight" && e.resourceType !== "Preflight") return false;
        if (type === "Other") {
          const passThrough: string[] = [
            "Other",
            "Stylesheet",
            "TextTrack",
            "Manifest",
            "Ping",
            "EventSource",
            "CSPViolationReport",
            "SignedExchange",
          ];
          if (!passThrough.includes(e.resourceType)) return false;
        }
      }

      if (q) {
        const inUrl = e.url.toLowerCase().includes(q);
        const inMethod = e.method.toLowerCase().includes(q);
        const inStatus = String(e.httpStatus ?? "").includes(q);
        const inMime = e.mimeType.toLowerCase().includes(q);

        if (inUrl || inMethod || inStatus || inMime) return true;

        if (scope === "all") {
          const responseBody = _bodyCache.get(e.requestId)?.text ?? "";
          const payloadBody = _bodyCache.get(`${e.requestId}:payload`)?.text ?? "";
          const inBody =
            responseBody.toLowerCase().includes(q) || payloadBody.toLowerCase().includes(q);
          const inReqHeaders = JSON.stringify(e.requestHeaders).toLowerCase().includes(q);
          const inResHeaders = JSON.stringify(e.responseHeaders).toLowerCase().includes(q);
          if (!inBody && !inReqHeaders && !inResHeaders) return false;
        } else {
          return false;
        }
      }

      return true;
    });
  });

  const selectedEntry = computed<NetworkEntry | null>(() =>
    selectedId.value ? (_entries.get(selectedId.value) ?? null) : null,
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

  function deleteCachedBody(key: string) {
    const cached = _bodyCache.get(key);
    if (!cached) return;
    _bodyBytes -= cached.bytes;
    _bodyCache.delete(key);
    const orderIndex = _bodyOrder.indexOf(key);
    if (orderIndex >= 0) _bodyOrder.splice(orderIndex, 1);
  }

  function deleteEntry(requestId: string) {
    _entries.delete(requestId);
    const bytes = _entryBytes.get(requestId) ?? 0;
    _historyBytes -= bytes;
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
    if (estimateSerializedBytes(entry) <= NETWORK_MAX_ENTRY_BYTES) return entry;
    const withoutHeaders = { ...entry, requestHeaders: {}, responseHeaders: {} };
    if (estimateSerializedBytes(withoutHeaders) <= NETWORK_MAX_ENTRY_BYTES) return withoutHeaders;
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

  const transferredBytes = computed(() => {
    void _version.value;
    let total = 0;
    for (const id of _order) {
      total += _entries.get(id)?.transferSize ?? 0;
    }
    return total;
  });

  // Actions
  function addEntry(entry: NetworkEntry) {
    if (!isRecording.value) return;
    const retained = boundedEntry(entry);
    if (_entries.has(retained.requestId)) {
      const orderIndex = _order.indexOf(retained.requestId);
      if (orderIndex >= 0) _order.splice(orderIndex, 1);
      deleteEntry(retained.requestId);
    }
    _entries.set(retained.requestId, retained);
    const bytes = estimateSerializedBytes(retained);
    _entryBytes.set(retained.requestId, bytes);
    _historyBytes += bytes;
    _order.push(entry.requestId);
    enforceEntryRetention();
    _scheduleFlush();
  }

  function patchEntry(requestId: string, patch: Partial<NetworkEntry>) {
    const existing = _entries.get(requestId);
    if (!existing) return;
    const retained = boundedEntry({ ...existing, ...patch });
    _historyBytes -= _entryBytes.get(requestId) ?? 0;
    const bytes = estimateSerializedBytes(retained);
    _entryBytes.set(requestId, bytes);
    _historyBytes += bytes;
    _entries.set(requestId, retained);
    enforceEntryRetention();
    _scheduleFlush();
  }

  function getEntry(requestId: string): NetworkEntry | undefined {
    return _entries.get(requestId);
  }

  function cacheBody(requestId: string, text: string) {
    deleteCachedBody(requestId);
    const retained = truncateUtf8(text, NETWORK_MAX_BODY_BYTES);
    const bytes = utf8ByteLength(retained);
    _bodyCache.set(requestId, { text: retained, bytes });
    _bodyOrder.push(requestId);
    _bodyBytes += bytes;

    while (
      _bodyOrder.length > NETWORK_MAX_CACHED_BODIES ||
      _bodyBytes > NETWORK_MAX_BODY_CACHE_BYTES
    ) {
      const oldest = _bodyOrder[0];
      if (!oldest) break;
      deleteCachedBody(oldest);
    }
    _scheduleFlush();
  }

  function clear() {
    _entries.clear();
    _order.length = 0;
    _entryBytes.clear();
    _historyBytes = 0;
    _bodyCache.clear();
    _bodyOrder.length = 0;
    _bodyBytes = 0;
    selectedId.value = null;
    _version.value++;
  }

  function select(id: string | null) {
    selectedId.value = id;
  }

  function triggerFocusSearch() {
    focusSearchTrigger.value++;
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
    allEntries,
    filteredEntries,
    selectedEntry,
    requestCount,
    retainedHistoryBytes,
    retainedBodyBytes,
    retainedBodyCount,
    transferredBytes,
    addEntry,
    patchEntry,
    getEntry,
    cacheBody,
    clear,
    select,
    triggerFocusSearch,
  };
});
