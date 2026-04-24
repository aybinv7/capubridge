<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue";
import { useVirtualList, useEventListener } from "@vueuse/core";
import { useQuery } from "@tanstack/vue-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  File,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Shield,
  Type,
  Wifi,
  X,
  Zap,
} from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { NetworkDomain } from "utils";
import JsonViewer from "@/modules/storage/localstorage/JsonViewer.vue";
import type { NetworkEntry } from "@/types/network.types";

type DetailTab = "headers" | "payload" | "response" | "timing" | "cookies";
const TABS: DetailTab[] = ["headers", "payload", "response", "timing", "cookies"];

const store = useNetworkStore();
const { getClient } = useCDP();
const targetsStore = useTargetsStore();
const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");

const detailTab = ref<DetailTab>("headers");
const expandedHeaderSections = ref(new Set<string>(["general", "response", "request"]));
const showRawResponse = ref(false);
const showRawPayload = ref(false);

// Refs for detail panel focus detection and JsonViewer Ctrl+F routing
const detailPanelRef = ref<HTMLElement | null>(null);
const responseViewerRef = ref<InstanceType<typeof JsonViewer> | null>(null);
const payloadViewerRef = ref<InstanceType<typeof JsonViewer> | null>(null);

// --- Virtual list ---
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
  computed(() => store.filteredEntries),
  { itemHeight: 32, overscan: 12 },
);

// --- Keyboard navigation ---
function navigateRequest(delta: number) {
  const entries = store.filteredEntries;
  if (!entries.length) return;
  const currentIdx = entries.findIndex((e) => e.requestId === store.selectedId);
  const nextIdx =
    currentIdx < 0
      ? delta > 0
        ? 0
        : entries.length - 1
      : Math.max(0, Math.min(entries.length - 1, currentIdx + delta));
  const entry = entries[nextIdx];
  if (entry) {
    store.select(entry.requestId);
    scrollTo(nextIdx);
  }
}

function navigateTab(delta: number) {
  if (!store.selectedEntry) return;
  const idx = TABS.indexOf(detailTab.value);
  detailTab.value = TABS[(idx + delta + TABS.length) % TABS.length]!;
}

useEventListener(document, "keydown", (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  const inInput =
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

  // Ctrl+F: route to JsonViewer search or global filter
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const inDetailPanel = detailPanelRef.value?.contains(target);
    if (inDetailPanel) {
      // Focus JsonViewer's own filter input if visible
      const viewer =
        detailTab.value === "response" ? responseViewerRef.value : payloadViewerRef.value;
      if (viewer?.filterInputRef) {
        e.preventDefault();
        viewer.filterInputRef.focus();
      }
      return;
    }
    // Focus global filter
    e.preventDefault();
    store.triggerFocusSearch();
    return;
  }

  if ((!e.ctrlKey && !e.metaKey) || inInput) return;

  if (e.key === "ArrowUp") {
    e.preventDefault();
    navigateRequest(-1);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    navigateRequest(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    navigateTab(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    navigateTab(1);
  }
});

// --- Detail panel queries ---
const canFetchBody = computed(() => {
  const entry = store.selectedEntry;
  return (
    !!targetId.value &&
    !!entry?.requestId &&
    entry.state === "finished" &&
    !entry.isWebSocket &&
    detailTab.value === "response"
  );
});

const {
  data: responseBody,
  isFetching: bodyLoading,
  error: bodyError,
} = useQuery({
  queryKey: computed(() => ["net-response-body", targetId.value, store.selectedId]),
  queryFn: async () => {
    const client = getClient(targetId.value);
    if (!client || !store.selectedEntry) return null;
    return new NetworkDomain(client).getResponseBody(store.selectedEntry.requestId);
  },
  enabled: canFetchBody,
  staleTime: 60_000,
  retry: false,
});

// Cache response body text for "all" search scope
watch(responseBody, (body) => {
  if (body && !body.base64Encoded && store.selectedId) {
    store.cacheBody(store.selectedId, body.body);
  }
});

const canFetchPostData = computed(() => {
  const entry = store.selectedEntry;
  return (
    !!targetId.value &&
    !!entry?.requestId &&
    !!entry.hasPostData &&
    entry.state === "finished" &&
    detailTab.value === "payload"
  );
});

const {
  data: postData,
  isFetching: postDataLoading,
  error: postDataError,
} = useQuery({
  queryKey: computed(() => ["net-post-data", targetId.value, store.selectedId]),
  queryFn: async () => {
    const client = getClient(targetId.value);
    if (!client || !store.selectedEntry) return null;
    return new NetworkDomain(client).getRequestPostData(store.selectedEntry.requestId);
  },
  enabled: canFetchPostData,
  staleTime: 60_000,
  retry: false,
});

// Cache post data for "all" search scope
watch(postData, (data) => {
  if (data && store.selectedId) {
    store.cacheBody(store.selectedId + ":payload", data);
  }
});

// --- Row display helpers ---
function selectEntry(entry: NetworkEntry) {
  store.select(store.selectedId === entry.requestId ? null : entry.requestId);
}

function methodBadgeClass(method: string): string {
  const map: Record<string, string> = {
    GET: "text-success bg-success/[0.09]",
    POST: "text-info bg-info/[0.09]",
    PUT: "text-warning bg-warning/[0.09]",
    DELETE: "text-error bg-error/[0.09]",
    PATCH: "text-violet-400 bg-violet-400/[0.09]",
    HEAD: "text-muted-foreground/70 bg-surface-3",
    OPTIONS: "text-muted-foreground/70 bg-surface-3",
    WS: "text-sky-400 bg-sky-400/[0.09]",
  };
  return map[method] ?? "text-muted-foreground/70 bg-surface-3";
}

function typeIconComponent(entry: NetworkEntry): Component {
  if (entry.isWebSocket) return Wifi;
  const map: Record<string, Component> = {
    Document: Globe,
    Script: Code2,
    Stylesheet: FileText,
    Image: ImageIcon,
    Media: Film,
    Font: Type,
    Fetch: Zap,
    XHR: Zap,
    Preflight: Shield,
    WebSocket: Wifi,
  };
  return map[entry.resourceType] ?? File;
}

function typeIconClass(entry: NetworkEntry): string {
  if (entry.isWebSocket) return "text-sky-400/60";
  const map: Record<string, string> = {
    Document: "text-blue-400/60",
    Script: "text-yellow-400/60",
    Stylesheet: "text-purple-400/60",
    Image: "text-emerald-400/60",
    Media: "text-pink-400/60",
    Font: "text-orange-400/60",
    Fetch: "text-sky-400/60",
    XHR: "text-sky-400/60",
    Preflight: "text-muted-foreground/40",
  };
  return map[entry.resourceType] ?? "text-muted-foreground/30";
}

function statusClass(entry: NetworkEntry): string {
  const s = entry.httpStatus;
  if (!s) return entry.state === "failed" ? "text-error/70" : "text-muted-foreground/40";
  if (s < 300) return "text-success";
  if (s < 400) return "text-warning";
  if (s < 500) return "text-warning";
  return "text-error";
}

function rowBorderClass(entry: NetworkEntry): string {
  if (entry.isWebSocket) return "border-l-sky-500/60";
  if (entry.state === "failed" || entry.blocked) return "border-l-error/60";
  const s = entry.httpStatus;
  if (!s || entry.state === "pending") return "border-l-transparent";
  if (s < 300) return "border-l-success/40";
  if (s < 400) return "border-l-warning/60";
  return "border-l-error/70";
}

function rowBgClass(entry: NetworkEntry): string {
  if (store.selectedId === entry.requestId) return "bg-surface-3";
  const s = entry.httpStatus;
  if (entry.state === "failed" || entry.blocked) return "bg-error/[0.018] hover:bg-error/[0.04]";
  if (s && s >= 400) return "bg-error/[0.015] hover:bg-error/[0.035]";
  if (entry.state === "cached") return "bg-info/[0.012] hover:bg-surface-2/70";
  return "hover:bg-surface-2/70";
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function shortType(entry: NetworkEntry): string {
  if (entry.isWebSocket) return "ws";
  const map: Record<string, string> = {
    Document: "doc",
    Stylesheet: "css",
    Image: "img",
    Media: "media",
    Font: "font",
    Script: "js",
    Fetch: "fetch",
    XHR: "xhr",
    WebSocket: "ws",
    Manifest: "manifest",
    EventSource: "evs",
    Preflight: "preflight",
    Other: "other",
  };
  return map[entry.resourceType] ?? entry.resourceType.toLowerCase();
}

function formatSize(entry: NetworkEntry): string {
  if (entry.state === "pending") return "…";
  if (entry.state === "failed") return "—";
  if (entry.fromDiskCache) return "(cache)";
  const bytes = entry.transferSize;
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 10 || u === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`;
}

function formatDuration(entry: NetworkEntry): string {
  if (entry.state === "pending") return "…";
  if (entry.state === "failed") return entry.canceled ? "aborted" : "failed";
  if (!entry.finishedTimestamp) return "—";
  const ms = (entry.finishedTimestamp - entry.startTimestamp) * 1000;
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function durationClass(entry: NetworkEntry): string {
  if (!entry.finishedTimestamp) return "text-muted-foreground/50";
  const ms = (entry.finishedTimestamp - entry.startTimestamp) * 1000;
  if (ms > 3000) return "text-error/80";
  if (ms > 1000) return "text-warning/80";
  return "text-muted-foreground/70";
}

function initiatorShort(entry: NetworkEntry): string {
  if (entry.initiatorUrl) {
    try {
      const u = new URL(entry.initiatorUrl);
      const file = u.pathname.split("/").pop() ?? u.pathname;
      return entry.initiatorLine ? `${file}:${entry.initiatorLine}` : file;
    } catch {
      return entry.initiatorUrl;
    }
  }
  return entry.initiatorType;
}

// --- Detail panel helpers ---

function toggleSection(key: string) {
  const next = new Set(expandedHeaderSections.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedHeaderSections.value = next;
}

function headerEntries(headers: Record<string, string>): [string, string][] {
  return Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
}

// Response body
const parsedJsonBody = computed<unknown | null>(() => {
  const result = responseBody.value;
  if (!result || result.base64Encoded) return null;
  try {
    return JSON.parse(result.body) as unknown;
  } catch {
    return null;
  }
});

const rawResponseText = computed<string | null>(() => {
  const result = responseBody.value;
  if (!result) return null;
  if (result.base64Encoded) return result.body;
  return result.body;
});

const isImageResponse = computed(() => {
  const result = responseBody.value;
  const entry = store.selectedEntry;
  return !!result?.base64Encoded && !!entry?.mimeType?.startsWith("image/");
});

const imageDataUrl = computed<string | null>(() => {
  if (!isImageResponse.value) return null;
  return `data:${store.selectedEntry?.mimeType};base64,${responseBody.value?.body}`;
});

// Post data
const parsedJsonPayload = computed<unknown | null>(() => {
  const data = postData.value;
  if (!data) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
});

const prettyPostData = computed<string | null>(() => {
  const data = postData.value;
  if (!data) return null;
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    try {
      const pairs = [...new URLSearchParams(data).entries()];
      if (pairs.length) return pairs.map(([k, v]) => `${k}: ${v}`).join("\n");
    } catch {
      // ignore
    }
    return data;
  }
});

// Timing breakdown
const timingBreakdown = computed(() => {
  const entry = store.selectedEntry;
  if (!entry?.timing) return null;
  const t = entry.timing;
  const total = entry.finishedTimestamp
    ? (entry.finishedTimestamp - entry.startTimestamp) * 1000
    : null;

  const dns = t.dnsEnd >= 0 && t.dnsStart >= 0 ? t.dnsEnd - t.dnsStart : 0;
  const connect = t.connectEnd >= 0 && t.connectStart >= 0 ? t.connectEnd - t.connectStart : 0;
  const ssl = t.sslEnd >= 0 && t.sslStart >= 0 ? t.sslEnd - t.sslStart : 0;
  const send = t.sendEnd >= 0 && t.sendStart >= 0 ? t.sendEnd - t.sendStart : 0;
  const ttfb = t.receiveHeadersEnd >= 0 && t.sendEnd >= 0 ? t.receiveHeadersEnd - t.sendEnd : 0;
  const download = total !== null && t.receiveHeadersEnd >= 0 ? total - t.receiveHeadersEnd : null;

  const phases = [
    {
      label: "Queued / stalled",
      value:
        t.sendStart >= 0
          ? Math.max(0, t.sendStart - (t.dnsStart >= 0 ? t.dnsStart : t.sendStart))
          : 0,
      color: "bg-muted-foreground/30",
    },
    { label: "DNS lookup", value: dns, color: "bg-teal-500/80" },
    { label: "Initial connection", value: connect - ssl, color: "bg-orange-400/80" },
    { label: "SSL", value: ssl, color: "bg-violet-400/80" },
    { label: "Request sent", value: send, color: "bg-success/80" },
    { label: "Waiting (TTFB)", value: ttfb, color: "bg-info/80" },
    { label: "Content download", value: download ?? 0, color: "bg-sky-400/80" },
  ].filter((p) => p.value > 0);

  const phaseTotal = phases.reduce((s, p) => s + p.value, 0);
  return { phases, total: total ?? phaseTotal };
});

// Cookies
interface ParsedCookie {
  name: string;
  value: string;
  attributes: Record<string, string | boolean>;
}

function parseRequestCookies(header: string): Array<{ name: string; value: string }> {
  return header
    .split(";")
    .map((pair) => {
      const trimmed = pair.trim();
      const eq = trimmed.indexOf("=");
      return eq >= 0
        ? { name: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim() }
        : { name: trimmed, value: "" };
    })
    .filter((c) => c.name);
}

function parseSetCookies(header: string): ParsedCookie[] {
  return header
    .split("\n")
    .filter(Boolean)
    .map((raw) => {
      const parts = raw.split(";");
      const first = parts[0]!.trim();
      const eq = first.indexOf("=");
      const name = eq >= 0 ? first.slice(0, eq).trim() : first;
      const value = eq >= 0 ? first.slice(eq + 1).trim() : "";
      const attributes: Record<string, string | boolean> = {};
      for (const attr of parts.slice(1)) {
        const t = attr.trim();
        const aeq = t.indexOf("=");
        if (aeq >= 0) {
          attributes[t.slice(0, aeq).trim().toLowerCase()] = t.slice(aeq + 1).trim();
        } else if (t) {
          attributes[t.toLowerCase()] = true;
        }
      }
      return { name, value, attributes };
    });
}

function findHeader(headers: Record<string, string>, name: string): string {
  return Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1] ?? "";
}

const requestCookies = computed(() => {
  const entry = store.selectedEntry;
  if (!entry) return [];
  const h = findHeader(entry.requestHeaders, "cookie");
  return h ? parseRequestCookies(h) : [];
});

const responseCookies = computed<ParsedCookie[]>(() => {
  const entry = store.selectedEntry;
  if (!entry) return [];
  const h = findHeader(entry.responseHeaders, "set-cookie");
  return h ? parseSetCookies(h) : [];
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <!-- ── Main request list ── -->
      <ResizablePanel :default-size="store.selectedEntry ? 62 : 100" :min-size="36">
        <div class="flex h-full flex-col overflow-hidden">
          <!-- Column header -->
          <div
            class="flex h-8 shrink-0 items-center border-b border-border/30 bg-surface-2 pl-2 pr-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/45 select-none"
          >
            <div class="w-5 shrink-0 mr-1" />
            <div class="w-[60px] shrink-0">Method</div>
            <div class="w-[44px] shrink-0">Status</div>
            <div class="min-w-0 flex-1 pl-1">URL</div>
            <div class="w-[48px] shrink-0 text-right">Type</div>
            <div class="w-[64px] shrink-0 text-right">Size</div>
            <div class="w-[68px] shrink-0 text-right">Time</div>
            <div class="w-[88px] shrink-0 pl-3">Initiator</div>
          </div>

          <!-- Empty state -->
          <div
            v-if="!store.filteredEntries.length"
            class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/35"
          >
            <Clock class="h-6 w-6 opacity-40" />
            <span class="text-xs">
              {{
                store.allEntries.length
                  ? "No requests match the current filter"
                  : "Waiting for network activity…"
              }}
            </span>
          </div>

          <!-- Virtual rows -->
          <div v-else v-bind="containerProps" class="flex-1 overflow-auto outline-none">
            <div v-bind="wrapperProps">
              <div
                v-for="{ data: entry } in list"
                :key="entry.requestId"
                class="flex items-center h-8 border-b border-l-2 border-border/[0.07] cursor-pointer transition-colors pr-3 pl-2 text-xs"
                :class="[rowBorderClass(entry), rowBgClass(entry)]"
                @click="selectEntry(entry)"
              >
                <!-- Type icon -->
                <div class="w-5 shrink-0 mr-1 flex items-center select-none">
                  <component
                    :is="typeIconComponent(entry)"
                    class="h-3 w-3"
                    :class="typeIconClass(entry)"
                  />
                </div>

                <!-- Method badge -->
                <div class="w-[60px] shrink-0 select-none">
                  <span
                    class="inline-block rounded px-1.5 py-[2px] font-mono text-[10px] font-semibold leading-none"
                    :class="methodBadgeClass(entry.method)"
                  >
                    {{ entry.method }}
                  </span>
                </div>

                <!-- Status -->
                <div
                  class="w-[44px] shrink-0 font-mono font-medium select-text"
                  :class="statusClass(entry)"
                >
                  {{ entry.httpStatus ?? (entry.state === "failed" ? "ERR" : "—") }}
                </div>

                <!-- URL -->
                <div class="min-w-0 flex-1 truncate pl-1 font-mono text-foreground/90 select-text">
                  {{ shortUrl(entry.url) }}
                </div>

                <!-- Type label -->
                <div
                  class="w-[48px] shrink-0 text-right text-muted-foreground/60 text-[11px] select-none"
                >
                  {{ shortType(entry) }}
                </div>

                <!-- Size -->
                <div
                  class="w-[64px] shrink-0 text-right font-mono text-[11px] text-muted-foreground/65 select-none"
                >
                  {{ formatSize(entry) }}
                </div>

                <!-- Time -->
                <div
                  class="w-[68px] shrink-0 text-right font-mono text-[11px] select-none"
                  :class="durationClass(entry)"
                >
                  {{ formatDuration(entry) }}
                </div>

                <!-- Initiator -->
                <div
                  class="w-[88px] shrink-0 truncate pl-3 font-mono text-[11px] text-muted-foreground/45 select-none"
                >
                  {{ initiatorShort(entry) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>

      <!-- ── Detail panel ── -->
      <template v-if="store.selectedEntry">
        <ResizableHandle with-handle />
        <ResizablePanel :default-size="38" :min-size="28" :max-size="64">
          <div
            ref="detailPanelRef"
            class="flex h-full flex-col border-l border-border/25 bg-background overflow-hidden"
          >
            <!-- Detail header -->
            <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border/25 px-3">
              <span
                class="shrink-0 rounded px-1.5 py-[2px] font-mono text-[10px] font-semibold leading-none"
                :class="methodBadgeClass(store.selectedEntry.method)"
              >
                {{ store.selectedEntry.method }}
              </span>
              <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground/75">
                {{ shortUrl(store.selectedEntry.url) }}
              </span>
              <button
                class="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground/60"
                @click="store.select(null)"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>

            <!-- Tab bar -->
            <div
              class="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/25 bg-surface-1 px-2"
            >
              <button
                v-for="tab in TABS"
                :key="tab"
                class="h-6 rounded px-2.5 text-[11px] capitalize transition-colors"
                :class="
                  detailTab === tab
                    ? 'bg-surface-3 font-medium text-foreground'
                    : 'text-muted-foreground/55 hover:bg-surface-3/60 hover:text-foreground/70'
                "
                @click="detailTab = tab"
              >
                {{ tab }}
              </button>
            </div>

            <!-- ── RESPONSE TAB ── full-height, outside ScrollArea -->
            <template v-if="detailTab === 'response'">
              <div
                v-if="store.selectedEntry.state === 'pending'"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40"
              >
                Request is still pending…
              </div>
              <div
                v-else-if="store.selectedEntry.state === 'failed'"
                class="flex flex-1 items-center justify-center gap-2 text-xs text-error/70"
              >
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                {{ store.selectedEntry.errorText ?? "Request failed" }}
              </div>
              <div
                v-else-if="store.selectedEntry.isWebSocket"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40 italic"
              >
                WebSocket — no response body
              </div>
              <div
                v-else-if="bodyLoading"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40"
              >
                Fetching…
              </div>
              <div
                v-else-if="bodyError"
                class="flex flex-1 items-center justify-center gap-2 text-xs text-error/70"
              >
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                Failed to fetch response body
              </div>

              <!-- Image response -->
              <template v-else-if="isImageResponse">
                <div
                  class="flex h-8 shrink-0 items-center gap-2 border-b border-border/15 bg-surface-1 px-3"
                >
                  <span class="text-[11px] text-muted-foreground/50">
                    {{ store.selectedEntry.mimeType }}
                  </span>
                  <div class="flex-1" />
                  <span class="text-[11px] text-muted-foreground/50">Raw</span>
                  <Switch v-model:checked="showRawResponse" class="scale-75" />
                </div>
                <ScrollArea v-if="showRawResponse" class="min-h-0 flex-1">
                  <pre
                    class="p-3 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground/80 select-text"
                    >{{ rawResponseText }}</pre
                  >
                </ScrollArea>
                <div
                  v-else
                  class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
                >
                  <img
                    :src="imageDataUrl!"
                    class="max-h-full max-w-full object-contain rounded"
                    alt="Response image"
                  />
                </div>
              </template>

              <!-- JSON → JsonViewer fills full height -->
              <template v-else-if="parsedJsonBody !== null && !showRawResponse">
                <div
                  class="flex h-8 shrink-0 items-center gap-2 border-b border-border/15 bg-surface-1 px-3"
                >
                  <span class="text-[11px] text-muted-foreground/50">JSON</span>
                  <div class="flex-1" />
                  <span class="text-[11px] text-muted-foreground/50">Raw</span>
                  <Switch v-model:checked="showRawResponse" class="scale-75" />
                </div>
                <div class="min-h-0 flex-1 overflow-hidden">
                  <JsonViewer ref="responseViewerRef" :value="parsedJsonBody" hide-line-numbers />
                </div>
              </template>

              <!-- Raw text (plain text or JSON in raw mode) -->
              <template v-else-if="rawResponseText">
                <div
                  class="flex h-8 shrink-0 items-center gap-2 border-b border-border/15 bg-surface-1 px-3"
                >
                  <span class="text-[11px] text-muted-foreground/50">
                    {{ parsedJsonBody !== null ? "JSON" : store.selectedEntry.mimeType || "text" }}
                  </span>
                  <div class="flex-1" />
                  <span class="text-[11px] text-muted-foreground/50">Raw</span>
                  <Switch v-model:checked="showRawResponse" class="scale-75" />
                </div>
                <ScrollArea class="min-h-0 flex-1">
                  <pre
                    class="p-3 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground/80 select-text"
                    >{{ rawResponseText }}</pre
                  >
                </ScrollArea>
              </template>

              <div
                v-else
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40 italic"
              >
                Empty response
              </div>
            </template>

            <!-- ── PAYLOAD TAB ── full-height for JSON, scrollable otherwise -->
            <template v-else-if="detailTab === 'payload'">
              <div
                v-if="!store.selectedEntry.hasPostData"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40 italic"
              >
                No request body
              </div>
              <div
                v-else-if="postDataLoading"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40"
              >
                Loading…
              </div>
              <div
                v-else-if="postDataError"
                class="flex flex-1 items-center justify-center gap-1.5 text-xs text-error/70"
              >
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                Failed to fetch payload
              </div>

              <!-- JSON payload → JsonViewer full height -->
              <template v-else-if="parsedJsonPayload !== null && !showRawPayload">
                <div
                  class="flex h-8 shrink-0 items-center gap-2 border-b border-border/15 bg-surface-1 px-3"
                >
                  <span class="text-[11px] text-muted-foreground/50">JSON</span>
                  <div class="flex-1" />
                  <span class="text-[11px] text-muted-foreground/50">Raw</span>
                  <Switch v-model:checked="showRawPayload" class="scale-75" />
                </div>
                <div class="min-h-0 flex-1 overflow-hidden">
                  <JsonViewer ref="payloadViewerRef" :value="parsedJsonPayload" hide-line-numbers />
                </div>
              </template>

              <!-- Raw post data (plain or JSON in raw mode) -->
              <template v-else-if="prettyPostData">
                <div
                  class="flex h-8 shrink-0 items-center gap-2 border-b border-border/15 bg-surface-1 px-3"
                >
                  <span class="text-[11px] text-muted-foreground/50">
                    {{ parsedJsonPayload !== null ? "JSON" : "text" }}
                  </span>
                  <div class="flex-1" />
                  <span class="text-[11px] text-muted-foreground/50">Raw</span>
                  <Switch v-model:checked="showRawPayload" class="scale-75" />
                </div>
                <ScrollArea class="min-h-0 flex-1">
                  <pre
                    class="p-3 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground/80 select-text"
                    >{{ prettyPostData }}</pre
                  >
                </ScrollArea>
              </template>

              <div
                v-else
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40 italic"
              >
                Empty body
              </div>
            </template>

            <!-- ── All other tabs in ScrollArea ── -->
            <ScrollArea v-else class="min-h-0 flex-1">
              <div class="p-3">
                <!-- ── HEADERS TAB ── -->
                <template v-if="detailTab === 'headers'">
                  <!-- General -->
                  <div class="mb-4">
                    <button
                      class="mb-2 flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-muted-foreground/70"
                      @click="toggleSection('general')"
                    >
                      <component
                        :is="expandedHeaderSections.has('general') ? ChevronDown : ChevronRight"
                        class="h-3 w-3"
                      />
                      General
                    </button>
                    <div
                      v-if="expandedHeaderSections.has('general')"
                      class="grid gap-y-1.5 font-mono text-xs"
                      style="grid-template-columns: minmax(0, 160px) 1fr; column-gap: 8px"
                    >
                      <template
                        v-for="[k, v] in [
                          ['Request URL', store.selectedEntry.url],
                          ['Request Method', store.selectedEntry.method],
                          [
                            'Status Code',
                            store.selectedEntry.httpStatus
                              ? `${store.selectedEntry.httpStatus} ${store.selectedEntry.statusText}`
                              : store.selectedEntry.state,
                          ],
                          ['Remote Address', store.selectedEntry.remoteAddress || '—'],
                          ['Protocol', store.selectedEntry.protocol || '—'],
                          ['Resource Type', store.selectedEntry.resourceType],
                          [
                            'Initiator',
                            `${store.selectedEntry.initiatorType}${store.selectedEntry.initiatorUrl ? ` — ${store.selectedEntry.initiatorUrl}` : ''}`,
                          ],
                        ] as [string, string][]"
                        :key="k"
                      >
                        <span class="text-right text-muted-foreground/55 truncate py-0.5">
                          {{ k }}:
                        </span>
                        <span
                          class="break-all text-foreground/80 py-0.5 select-text"
                          :class="k === 'Status Code' ? statusClass(store.selectedEntry) : ''"
                        >
                          {{ v }}
                        </span>
                      </template>
                    </div>
                  </div>

                  <!-- Response headers -->
                  <div class="mb-4">
                    <button
                      class="mb-2 flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-muted-foreground/70"
                      @click="toggleSection('response')"
                    >
                      <component
                        :is="expandedHeaderSections.has('response') ? ChevronDown : ChevronRight"
                        class="h-3 w-3"
                      />
                      Response Headers
                      <span class="ml-auto font-mono text-[9px] text-muted-foreground/35">
                        {{ Object.keys(store.selectedEntry.responseHeaders).length }}
                      </span>
                    </button>
                    <template v-if="expandedHeaderSections.has('response')">
                      <p
                        v-if="!Object.keys(store.selectedEntry.responseHeaders).length"
                        class="text-xs text-muted-foreground/35 italic"
                      >
                        No response headers yet
                      </p>
                      <div
                        v-else
                        class="grid font-mono text-xs"
                        style="
                          grid-template-columns: minmax(0, 170px) 1fr;
                          column-gap: 8px;
                          row-gap: 3px;
                        "
                      >
                        <template
                          v-for="[k, v] in headerEntries(store.selectedEntry.responseHeaders)"
                          :key="k"
                        >
                          <span class="text-right text-info/60 truncate py-0.5 font-medium">
                            {{ k }}:
                          </span>
                          <span class="break-all text-foreground/75 py-0.5 select-text">
                            {{ v }}
                          </span>
                        </template>
                      </div>
                    </template>
                  </div>

                  <!-- Request headers -->
                  <div>
                    <button
                      class="mb-2 flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-muted-foreground/70"
                      @click="toggleSection('request')"
                    >
                      <component
                        :is="expandedHeaderSections.has('request') ? ChevronDown : ChevronRight"
                        class="h-3 w-3"
                      />
                      Request Headers
                      <span class="ml-auto font-mono text-[9px] text-muted-foreground/35">
                        {{ Object.keys(store.selectedEntry.requestHeaders).length }}
                      </span>
                    </button>
                    <div
                      v-if="expandedHeaderSections.has('request')"
                      class="grid font-mono text-xs"
                      style="
                        grid-template-columns: minmax(0, 170px) 1fr;
                        column-gap: 8px;
                        row-gap: 3px;
                      "
                    >
                      <template
                        v-for="[k, v] in headerEntries(store.selectedEntry.requestHeaders)"
                        :key="k"
                      >
                        <span class="text-right text-success/55 truncate py-0.5 font-medium">
                          {{ k }}:
                        </span>
                        <span class="break-all text-foreground/75 py-0.5 select-text">
                          {{ v }}
                        </span>
                      </template>
                    </div>
                  </div>
                </template>

                <!-- ── TIMING TAB ── -->
                <template v-else-if="detailTab === 'timing'">
                  <div v-if="!store.selectedEntry.timing" class="space-y-2">
                    <div
                      v-for="[label, val] in [
                        [
                          'Started at',
                          new Date(store.selectedEntry.startedAt).toLocaleTimeString(),
                        ],
                        ['Duration', formatDuration(store.selectedEntry)],
                        ['Transfer size', formatSize(store.selectedEntry)],
                        ['MIME type', store.selectedEntry.mimeType || '—'],
                        [
                          'From cache',
                          store.selectedEntry.fromDiskCache
                            ? 'Yes (disk)'
                            : store.selectedEntry.fromServiceWorker
                              ? 'Yes (service worker)'
                              : 'No',
                        ],
                      ] as [string, string][]"
                      :key="label"
                      class="flex justify-between gap-3 font-mono text-xs"
                    >
                      <span class="text-muted-foreground/55">{{ label }}</span>
                      <span class="text-foreground/75 select-text">{{ val }}</span>
                    </div>
                  </div>

                  <div v-else class="space-y-3">
                    <div class="space-y-2">
                      <div
                        v-for="phase in timingBreakdown!.phases"
                        :key="phase.label"
                        class="flex items-center gap-2"
                      >
                        <div
                          class="w-[128px] shrink-0 text-[11px] text-muted-foreground/55 truncate"
                        >
                          {{ phase.label }}
                        </div>
                        <div class="flex-1 h-2.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            class="h-full rounded-full"
                            :class="phase.color"
                            :style="{
                              width: `${Math.max(2, (phase.value / timingBreakdown!.total) * 100).toFixed(1)}%`,
                            }"
                          />
                        </div>
                        <div
                          class="w-[54px] shrink-0 text-right font-mono text-[11px] text-muted-foreground/55"
                        >
                          {{ phase.value.toFixed(1) }} ms
                        </div>
                      </div>
                    </div>

                    <div class="border-t border-border/20 pt-2 space-y-1.5">
                      <div
                        v-for="[label, val] in [
                          ['Total', `${timingBreakdown!.total.toFixed(1)} ms`],
                          ['Transfer', formatSize(store.selectedEntry)],
                          ['MIME type', store.selectedEntry.mimeType || '—'],
                          ['Protocol', store.selectedEntry.protocol || '—'],
                        ] as [string, string][]"
                        :key="label"
                        class="flex justify-between font-mono text-xs"
                      >
                        <span class="text-muted-foreground/55">{{ label }}</span>
                        <span class="text-foreground/75">{{ val }}</span>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- ── COOKIES TAB ── -->
                <template v-else-if="detailTab === 'cookies'">
                  <!-- Request cookies -->
                  <div class="mb-4">
                    <div
                      class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
                    >
                      Request Cookies
                      <span
                        class="ml-1.5 font-mono text-[9px] normal-case text-muted-foreground/35"
                      >
                        {{ requestCookies.length }}
                      </span>
                    </div>
                    <p
                      v-if="!requestCookies.length"
                      class="text-xs text-muted-foreground/35 italic"
                    >
                      No cookies sent
                    </p>
                    <div
                      v-else
                      class="grid font-mono text-xs"
                      style="
                        grid-template-columns: minmax(0, 170px) 1fr;
                        column-gap: 8px;
                        row-gap: 3px;
                      "
                    >
                      <template v-for="c in requestCookies" :key="c.name">
                        <span class="text-right text-success/55 truncate py-0.5 font-medium">
                          {{ c.name }}:
                        </span>
                        <span class="break-all text-foreground/75 py-0.5 select-text">
                          {{ c.value }}
                        </span>
                      </template>
                    </div>
                  </div>

                  <!-- Response cookies -->
                  <div>
                    <div
                      class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
                    >
                      Response Cookies (Set-Cookie)
                      <span
                        class="ml-1.5 font-mono text-[9px] normal-case text-muted-foreground/35"
                      >
                        {{ responseCookies.length }}
                      </span>
                    </div>
                    <p
                      v-if="!responseCookies.length"
                      class="text-xs text-muted-foreground/35 italic"
                    >
                      No cookies set
                    </p>
                    <div v-else class="space-y-3">
                      <div
                        v-for="c in responseCookies"
                        :key="c.name"
                        class="rounded border border-border/20 bg-surface-2/50 p-2.5"
                      >
                        <div class="mb-1.5 font-mono text-xs font-semibold text-foreground/80">
                          {{ c.name }}
                          <span class="ml-2 font-normal text-muted-foreground/60 select-text">
                            = {{ c.value || "(empty)" }}
                          </span>
                        </div>
                        <div
                          v-if="Object.keys(c.attributes).length"
                          class="grid text-[11px] font-mono"
                          style="grid-template-columns: auto 1fr; column-gap: 8px; row-gap: 2px"
                        >
                          <template v-for="[ak, av] in Object.entries(c.attributes)" :key="ak">
                            <span class="text-muted-foreground/50 text-right">{{ ak }}:</span>
                            <span class="text-foreground/65 break-all">
                              {{ av === true ? "✓" : String(av) }}
                            </span>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
  </div>
</template>
