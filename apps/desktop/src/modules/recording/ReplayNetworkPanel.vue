<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from "vue";
import { useVirtualList } from "@vueuse/core";
import {
  AlertTriangle,
  Code2,
  File,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Search,
  Shield,
  Type,
  Wifi,
  X,
  Zap,
} from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import JsonViewer from "@/modules/storage/localstorage/JsonViewer.vue";
import type { NetworkCapuEvent, NetworkCapuTiming } from "@/types/replay.types";

const TYPE_FILTERS = ["All", "XHR/Fetch", "WS", "Doc", "Img", "Script", "Other"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];
type DetailTab = "headers" | "payload" | "response" | "timing";
const TABS: DetailTab[] = ["headers", "payload", "response", "timing"];

const props = defineProps<{
  events: NetworkCapuEvent[];
  positionMs: number;
}>();

interface ReplayEntry {
  requestId: string;
  url: string;
  method: string;
  status: number | null;
  resourceType: string;
  duration: number | null;
  transferSize: number;
  state: string;
  mimeType: string | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  responseBodyBase64: boolean;
  timing: NetworkCapuTiming | null;
  initiator: string | null;
  t: number;
}

const selectedId = ref<string | null>(null);
const search = ref("");
const typeFilter = ref<TypeFilter>("All");
const detailTab = ref<DetailTab>("headers");
const expandedSections = ref(new Set<string>(["general", "response", "request"]));

const deduped = computed<ReplayEntry[]>(() => {
  const seen = new Map<string, NetworkCapuEvent>();
  for (const ev of props.events) {
    if (ev.t > props.positionMs) continue;
    seen.set(ev.data.requestId, ev);
  }
  return [...seen.values()].map((ev) => ({
    requestId: ev.data.requestId,
    url: ev.data.url,
    method: ev.data.method,
    status: ev.data.status,
    resourceType: ev.data.resourceType,
    duration: ev.data.duration,
    transferSize: ev.data.transferSize,
    state: ev.data.state,
    mimeType: ev.data.mimeType ?? null,
    requestHeaders: ev.data.requestHeaders ?? {},
    responseHeaders: ev.data.responseHeaders ?? {},
    requestBody: ev.data.requestBody ?? null,
    responseBody: ev.data.responseBody ?? null,
    responseBodyBase64: ev.data.responseBodyBase64 ?? false,
    timing: ev.data.timing ?? null,
    initiator: ev.data.initiator ?? null,
    t: ev.t,
  }));
});

function matchesType(entry: ReplayEntry, f: TypeFilter): boolean {
  if (f === "All") return true;
  if (f === "XHR/Fetch") return entry.resourceType === "XHR" || entry.resourceType === "Fetch";
  if (f === "WS") return entry.resourceType === "WebSocket" || entry.method === "WS";
  if (f === "Doc") return entry.resourceType === "Document";
  if (f === "Img") return entry.resourceType === "Image";
  if (f === "Script") return entry.resourceType === "Script";
  if (f === "Other") {
    const known = ["XHR", "Fetch", "WebSocket", "Document", "Image", "Script"];
    return !known.includes(entry.resourceType);
  }
  return true;
}

const filteredEntries = computed<ReplayEntry[]>(() => {
  const q = search.value.trim().toLowerCase();
  return deduped.value.filter((e) => {
    if (!matchesType(e, typeFilter.value)) return false;
    if (q && !e.url.toLowerCase().includes(q)) return false;
    return true;
  });
});

const { list, containerProps, wrapperProps } = useVirtualList(filteredEntries, {
  itemHeight: 32,
  overscan: 12,
});

const selectedEntry = computed<ReplayEntry | null>(
  () => filteredEntries.value.find((e) => e.requestId === selectedId.value) ?? null,
);

function selectEntry(entry: ReplayEntry) {
  selectedId.value = selectedId.value === entry.requestId ? null : entry.requestId;
}

function navigateRequest(dir: 1 | -1) {
  const entries = filteredEntries.value;
  if (!entries.length) return;
  const idx = selectedId.value ? entries.findIndex((e) => e.requestId === selectedId.value) : -1;
  const next =
    idx === -1
      ? dir === 1
        ? 0
        : entries.length - 1
      : Math.max(0, Math.min(entries.length - 1, idx + dir));
  selectedId.value = entries[next]!.requestId;
}

function onKeydown(e: KeyboardEvent) {
  if (!e.ctrlKey) return;
  if (e.key === "ArrowUp") {
    e.preventDefault();
    navigateRequest(-1);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    navigateRequest(1);
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));

function toggleSection(key: string) {
  const next = new Set(expandedSections.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedSections.value = next;
}

function headerEntries(h: Record<string, string>): [string, string][] {
  return Object.entries(h).sort(([a], [b]) => a.localeCompare(b));
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
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

function typeIconComponent(entry: ReplayEntry): Component {
  if (entry.resourceType === "WebSocket" || entry.method === "WS") return Wifi;
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
  };
  return map[entry.resourceType] ?? File;
}

function typeIconClass(entry: ReplayEntry): string {
  if (entry.resourceType === "WebSocket" || entry.method === "WS") return "text-sky-400/60";
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

function statusClass(entry: ReplayEntry): string {
  const s = entry.status;
  if (!s) return entry.state === "failed" ? "text-error/70" : "text-muted-foreground/40";
  if (s < 300) return "text-success";
  if (s < 400) return "text-warning";
  if (s < 500) return "text-warning";
  return "text-error";
}

function rowBorderClass(entry: ReplayEntry): string {
  if (entry.state === "failed") return "border-l-error/60";
  const s = entry.status;
  if (!s || entry.state === "pending") return "border-l-transparent";
  if (s < 300) return "border-l-success/40";
  if (s < 400) return "border-l-warning/60";
  return "border-l-error/70";
}

function rowBgClass(entry: ReplayEntry): string {
  if (selectedId.value === entry.requestId) return "bg-surface-3";
  if (entry.state === "failed") return "bg-error/[0.018] hover:bg-error/[0.04]";
  const s = entry.status;
  if (s && s >= 400) return "bg-error/[0.015] hover:bg-error/[0.035]";
  return "hover:bg-surface-2/70";
}

function shortType(entry: ReplayEntry): string {
  if (entry.method === "WS" || entry.resourceType === "WebSocket") return "ws";
  const map: Record<string, string> = {
    Document: "doc",
    Stylesheet: "css",
    Image: "img",
    Media: "media",
    Font: "font",
    Script: "js",
    Fetch: "fetch",
    XHR: "xhr",
    Preflight: "preflight",
    Other: "other",
  };
  return map[entry.resourceType] ?? entry.resourceType.toLowerCase();
}

function formatSize(entry: ReplayEntry): string {
  if (entry.state === "pending") return "…";
  if (entry.state === "failed") return "—";
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

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function durationClass(entry: ReplayEntry): string {
  if (!entry.duration) return "text-muted-foreground/50";
  if (entry.duration > 3000) return "text-error/80";
  if (entry.duration > 1000) return "text-warning/80";
  return "text-muted-foreground/70";
}

function formatOffset(t: number): string {
  const s = Math.floor(t / 1000);
  const ms = t % 1000;
  return `+${s}.${String(ms).padStart(3, "0")}s`;
}

const parsedResponseJson = computed<unknown | null>(() => {
  const e = selectedEntry.value;
  if (!e?.responseBody || e.responseBodyBase64) return null;
  try {
    return JSON.parse(e.responseBody) as unknown;
  } catch {
    return null;
  }
});

const isImageResponse = computed(() => {
  const e = selectedEntry.value;
  return !!e?.responseBodyBase64 && !!e.mimeType?.startsWith("image/");
});

const imageDataUrl = computed<string | null>(() => {
  const e = selectedEntry.value;
  if (!isImageResponse.value || !e) return null;
  return `data:${e.mimeType};base64,${e.responseBody}`;
});

const parsedPayloadJson = computed<unknown | null>(() => {
  const body = selectedEntry.value?.requestBody;
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
});

const timingBreakdown = computed(() => {
  const e = selectedEntry.value;
  if (!e?.timing) return null;
  const t = e.timing;
  const total = e.duration;

  const dns = t.dnsEnd >= 0 && t.dnsStart >= 0 ? t.dnsEnd - t.dnsStart : 0;
  const connect = t.connectEnd >= 0 && t.connectStart >= 0 ? t.connectEnd - t.connectStart : 0;
  const ssl = t.sslEnd >= 0 && t.sslStart >= 0 ? t.sslEnd - t.sslStart : 0;
  const send = t.sendEnd >= 0 && t.sendStart >= 0 ? t.sendEnd - t.sendStart : 0;
  const ttfb = t.receiveHeadersEnd >= 0 && t.sendEnd >= 0 ? t.receiveHeadersEnd - t.sendEnd : 0;
  const download = total !== null && t.receiveHeadersEnd >= 0 ? total - t.receiveHeadersEnd : null;

  const phases = [
    { label: "DNS lookup", value: dns, color: "bg-teal-500/80" },
    {
      label: "Initial connection",
      value: connect - ssl,
      color: "bg-orange-400/80",
    },
    { label: "SSL", value: ssl, color: "bg-violet-400/80" },
    { label: "Request sent", value: send, color: "bg-success/80" },
    { label: "Waiting (TTFB)", value: ttfb, color: "bg-info/80" },
    { label: "Content download", value: download ?? 0, color: "bg-sky-400/80" },
  ].filter((p) => p.value > 0);

  const phaseTotal = phases.reduce((s, p) => s + p.value, 0);
  return { phases, total: total ?? phaseTotal };
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Filter bar -->
    <div class="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/30 bg-surface-2 px-2">
      <div
        class="flex max-w-[220px] flex-1 items-center gap-1.5 rounded border border-border/25 bg-surface-3 px-2 transition-colors focus-within:border-border/60"
      >
        <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <Input
          v-model="search"
          class="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0 placeholder:text-muted-foreground/35"
          placeholder="Filter…"
        />
        <button
          v-if="search"
          class="shrink-0 text-muted-foreground/40 hover:text-foreground/60"
          @click="search = ''"
        >
          <X class="h-3 w-3" />
        </button>
      </div>

      <div class="flex items-center gap-0.5">
        <button
          v-for="f in TYPE_FILTERS"
          :key="f"
          class="h-6 rounded px-2 text-[11px] transition-colors"
          :class="
            typeFilter === f
              ? 'bg-surface-3 font-medium text-foreground'
              : 'text-muted-foreground/55 hover:bg-surface-3/60 hover:text-foreground/70'
          "
          @click="typeFilter = f"
        >
          {{ f }}
        </button>
      </div>

      <div class="flex-1" />
      <span class="text-[11px] text-muted-foreground/40 pr-1">
        {{ filteredEntries.length }} / {{ events.length }}
      </span>
    </div>

    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <!-- Request list -->
      <ResizablePanel :default-size="selectedEntry ? 62 : 100" :min-size="36">
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
            <div class="w-[72px] shrink-0 text-right pr-1">At</div>
          </div>

          <div
            v-if="filteredEntries.length === 0"
            class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40"
          >
            {{ events.length ? "No requests match filter" : "No network requests yet" }}
          </div>

          <div v-else v-bind="containerProps" class="flex-1 overflow-auto outline-none">
            <div v-bind="wrapperProps">
              <div
                v-for="{ data: entry } in list"
                :key="entry.requestId"
                class="flex items-center h-8 border-b border-l-2 border-border/[0.07] cursor-pointer transition-colors pr-3 pl-2 text-xs"
                :class="[rowBorderClass(entry), rowBgClass(entry)]"
                @click="selectEntry(entry)"
              >
                <div class="w-5 shrink-0 mr-1 flex items-center">
                  <component
                    :is="typeIconComponent(entry)"
                    class="h-3 w-3"
                    :class="typeIconClass(entry)"
                  />
                </div>

                <div class="w-[60px] shrink-0">
                  <span
                    class="inline-block rounded px-1.5 py-[2px] font-mono text-[10px] font-semibold leading-none"
                    :class="methodBadgeClass(entry.method)"
                  >
                    {{ entry.method }}
                  </span>
                </div>

                <div class="w-[44px] shrink-0 font-mono font-medium" :class="statusClass(entry)">
                  {{ entry.status ?? (entry.state === "failed" ? "ERR" : "—") }}
                </div>

                <div class="min-w-0 flex-1 truncate pl-1 font-mono text-foreground/90 select-text">
                  {{ shortUrl(entry.url) }}
                </div>

                <div class="w-[48px] shrink-0 text-right text-muted-foreground/60 text-[11px]">
                  {{ shortType(entry) }}
                </div>

                <div
                  class="w-[64px] shrink-0 text-right font-mono text-[11px] text-muted-foreground/65"
                >
                  {{ formatSize(entry) }}
                </div>

                <div
                  class="w-[68px] shrink-0 text-right font-mono text-[11px]"
                  :class="durationClass(entry)"
                >
                  {{ formatMs(entry.duration) }}
                </div>

                <div
                  class="w-[72px] shrink-0 text-right font-mono text-[10px] text-muted-foreground/35 pr-1"
                >
                  {{ formatOffset(entry.t) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>

      <!-- Detail panel -->
      <template v-if="selectedEntry">
        <ResizableHandle with-handle />
        <ResizablePanel :default-size="38" :min-size="28" :max-size="64">
          <div class="flex h-full flex-col border-l border-border/25 bg-background overflow-hidden">
            <!-- Detail header -->
            <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border/25 px-3">
              <span
                class="shrink-0 rounded px-1.5 py-[2px] font-mono text-[10px] font-semibold leading-none"
                :class="methodBadgeClass(selectedEntry.method)"
              >
                {{ selectedEntry.method }}
              </span>
              <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground/75">
                {{ shortUrl(selectedEntry.url) }}
              </span>
              <button
                class="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground/60"
                @click="selectedId = null"
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

            <!-- Response tab (full height) -->
            <template v-if="detailTab === 'response'">
              <div
                v-if="selectedEntry.state === 'failed'"
                class="flex flex-1 items-center justify-center gap-2 text-xs text-error/70"
              >
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                Request failed
              </div>
              <div
                v-else-if="!selectedEntry.responseBody"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40"
              >
                No response body recorded
              </div>
              <div
                v-else-if="isImageResponse"
                class="flex flex-1 items-center justify-center p-4 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22><rect fill=%22%23222%22 width=%2210%22 height=%2210%22/><rect fill=%22%23333%22 x=%225%22 width=%225%22 height=%225%22/><rect fill=%22%23333%22 y=%225%22 width=%225%22 height=%225%22/></svg>')] bg-[length:10px_10px]"
              >
                <img
                  :src="imageDataUrl!"
                  class="max-h-full max-w-full object-contain"
                  :alt="selectedEntry.mimeType ?? ''"
                />
              </div>
              <template v-else-if="parsedResponseJson !== null">
                <div class="min-h-0 flex-1 overflow-hidden">
                  <JsonViewer :value="parsedResponseJson" hide-line-numbers />
                </div>
              </template>
              <template v-else>
                <ScrollArea class="min-h-0 flex-1">
                  <pre
                    class="p-3 font-mono text-[11px] text-foreground/80 whitespace-pre-wrap break-all leading-relaxed select-text"
                    >{{ selectedEntry.responseBody }}</pre
                  >
                </ScrollArea>
              </template>
            </template>

            <!-- Payload tab (full height) -->
            <template v-else-if="detailTab === 'payload'">
              <div
                v-if="!selectedEntry.requestBody"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground/40"
              >
                No request body
              </div>
              <template v-else-if="parsedPayloadJson !== null">
                <div class="min-h-0 flex-1 overflow-hidden">
                  <JsonViewer :value="parsedPayloadJson" hide-line-numbers />
                </div>
              </template>
              <template v-else>
                <ScrollArea class="min-h-0 flex-1">
                  <pre
                    class="p-3 font-mono text-[11px] text-foreground/80 whitespace-pre-wrap break-all leading-relaxed select-text"
                    >{{ selectedEntry.requestBody }}</pre
                  >
                </ScrollArea>
              </template>
            </template>

            <!-- Headers + Timing in ScrollArea -->
            <ScrollArea v-else class="flex-1">
              <!-- HEADERS TAB -->
              <template v-if="detailTab === 'headers'">
                <!-- General -->
                <div class="border-b border-border/15">
                  <button
                    class="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/70 hover:bg-surface-1/50"
                    @click="toggleSection('general')"
                  >
                    <span
                      class="text-[9px] transition-transform"
                      :class="expandedSections.has('general') ? 'rotate-90' : ''"
                      >▶</span
                    >
                    General
                  </button>
                  <div v-if="expandedSections.has('general')" class="pb-1.5 px-3">
                    <div class="space-y-0.5">
                      <div class="flex gap-2 text-[11px]">
                        <span class="text-muted-foreground/50 shrink-0 w-28">Request URL</span>
                        <span class="font-mono text-foreground/80 break-all select-text">{{
                          selectedEntry.url
                        }}</span>
                      </div>
                      <div class="flex gap-2 text-[11px]">
                        <span class="text-muted-foreground/50 shrink-0 w-28">Method</span>
                        <span class="font-mono text-foreground/80">{{ selectedEntry.method }}</span>
                      </div>
                      <div class="flex gap-2 text-[11px]">
                        <span class="text-muted-foreground/50 shrink-0 w-28">Status</span>
                        <span class="font-mono" :class="statusClass(selectedEntry)">
                          {{
                            selectedEntry.status ??
                            (selectedEntry.state === "failed" ? "Failed" : "—")
                          }}
                        </span>
                      </div>
                      <div class="flex gap-2 text-[11px]">
                        <span class="text-muted-foreground/50 shrink-0 w-28">Remote host</span>
                        <span class="font-mono text-foreground/80">{{
                          urlHost(selectedEntry.url)
                        }}</span>
                      </div>
                      <div v-if="selectedEntry.initiator" class="flex gap-2 text-[11px]">
                        <span class="text-muted-foreground/50 shrink-0 w-28">Initiator</span>
                        <span class="font-mono text-foreground/80 break-all select-text">{{
                          selectedEntry.initiator
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Response headers -->
                <div class="border-b border-border/15">
                  <button
                    class="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/70 hover:bg-surface-1/50"
                    @click="toggleSection('response')"
                  >
                    <span
                      class="text-[9px] transition-transform"
                      :class="expandedSections.has('response') ? 'rotate-90' : ''"
                      >▶</span
                    >
                    Response Headers
                  </button>
                  <div v-if="expandedSections.has('response')" class="pb-1.5 px-3 space-y-0.5">
                    <div
                      v-for="[k, v] in headerEntries(selectedEntry.responseHeaders)"
                      :key="k"
                      class="flex gap-2 text-[11px]"
                    >
                      <span class="text-muted-foreground/50 shrink-0 w-28 truncate" :title="k">{{
                        k
                      }}</span>
                      <span class="font-mono text-foreground/80 break-all select-text">{{
                        v
                      }}</span>
                    </div>
                    <div
                      v-if="!Object.keys(selectedEntry.responseHeaders).length"
                      class="text-muted-foreground/35 italic"
                    >
                      none recorded
                    </div>
                  </div>
                </div>

                <!-- Request headers -->
                <div>
                  <button
                    class="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/70 hover:bg-surface-1/50"
                    @click="toggleSection('request')"
                  >
                    <span
                      class="text-[9px] transition-transform"
                      :class="expandedSections.has('request') ? 'rotate-90' : ''"
                      >▶</span
                    >
                    Request Headers
                  </button>
                  <div v-if="expandedSections.has('request')" class="pb-1.5 px-3 space-y-0.5">
                    <div
                      v-for="[k, v] in headerEntries(selectedEntry.requestHeaders)"
                      :key="k"
                      class="flex gap-2 text-[11px]"
                    >
                      <span class="text-muted-foreground/50 shrink-0 w-28 truncate" :title="k">{{
                        k
                      }}</span>
                      <span class="font-mono text-foreground/80 break-all select-text">{{
                        v
                      }}</span>
                    </div>
                    <div
                      v-if="!Object.keys(selectedEntry.requestHeaders).length"
                      class="text-muted-foreground/35 italic"
                    >
                      none recorded
                    </div>
                  </div>
                </div>
              </template>

              <!-- TIMING TAB -->
              <template v-else-if="detailTab === 'timing'">
                <div
                  v-if="!timingBreakdown"
                  class="flex flex-1 items-center justify-center p-8 text-xs text-muted-foreground/40"
                >
                  No timing data recorded
                </div>
                <div v-else class="p-3 space-y-3">
                  <div v-for="phase in timingBreakdown.phases" :key="phase.label" class="space-y-1">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="text-muted-foreground/70">{{ phase.label }}</span>
                      <span class="font-mono text-muted-foreground/90">{{
                        formatMs(phase.value)
                      }}</span>
                    </div>
                    <div class="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="phase.color"
                        :style="{
                          width: `${(phase.value / timingBreakdown.total) * 100}%`,
                        }"
                      />
                    </div>
                  </div>
                  <div class="border-t border-border/15 pt-2 flex justify-between text-[11px]">
                    <span class="text-muted-foreground/50">Total</span>
                    <span class="font-mono font-medium">{{ formatMs(timingBreakdown.total) }}</span>
                  </div>
                </div>
              </template>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
  </div>
</template>
