import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { NetworkEntry, NetworkTypeFilter } from "@/types/network.types";

const MAX_ENTRIES = 5_000;

export const useNetworkStore = defineStore("network", () => {
  // Raw mutable data — not Vue-reactive directly; version counter drives updates
  const _entries = new Map<string, NetworkEntry>();
  const _order: string[] = [];
  const _bodyCache = new Map<string, string>();

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
  const preserveLog = ref(false);
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
          const body = _bodyCache.get(e.requestId) ?? "";
          const inBody = body.toLowerCase().includes(q);
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

  const requestCount = computed(() => _order.length);

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
    if (_order.length >= MAX_ENTRIES) {
      const oldest = _order.shift()!;
      _entries.delete(oldest);
      _bodyCache.delete(oldest);
    }
    _entries.set(entry.requestId, entry);
    _order.push(entry.requestId);
    _scheduleFlush();
  }

  function patchEntry(requestId: string, patch: Partial<NetworkEntry>) {
    const existing = _entries.get(requestId);
    if (!existing) return;
    _entries.set(requestId, { ...existing, ...patch });
    _scheduleFlush();
  }

  function getEntry(requestId: string): NetworkEntry | undefined {
    return _entries.get(requestId);
  }

  function cacheBody(requestId: string, text: string) {
    _bodyCache.set(requestId, text);
  }

  function clear() {
    _entries.clear();
    _order.length = 0;
    _bodyCache.clear();
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
