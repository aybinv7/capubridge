<script setup lang="ts">
import { computed, ref } from "vue";
import type { NetworkCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: NetworkCapuEvent[];
  positionMs: number;
}>();

const expandedId = ref<string | null>(null);

function toggleExpand(requestId: string) {
  expandedId.value = expandedId.value === requestId ? null : requestId;
}

function statusColor(status: number | null): string {
  if (status === null) return "text-muted-foreground/40";
  if (status < 300) return "text-success";
  if (status < 400) return "text-warning";
  return "text-error";
}

function methodColor(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "text-info";
  if (m === "POST") return "text-violet-400";
  if (m === "PUT" || m === "PATCH") return "text-warning";
  if (m === "DELETE") return "text-error";
  return "text-muted-foreground";
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatOffset(t: number): string {
  const s = Math.floor(t / 1000);
  const ms = t % 1000;
  return `+${s}.${String(ms).padStart(3, "0")}s`;
}

function urlPath(url: string): string {
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
    return "";
  }
}

const visibleEvents = computed(() =>
  [...props.events].filter((ev) => ev.t <= props.positionMs).sort((a, b) => a.t - b.t),
);
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex-none px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
      <span class="text-2xs font-medium text-muted-foreground uppercase tracking-wide">
        Network
      </span>
      <span class="text-2xs text-muted-foreground/40">
        {{ visibleEvents.length }} / {{ events.length }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="visibleEvents.length === 0" class="flex items-center justify-center h-16">
        <p class="text-2xs text-muted-foreground/40">No network requests yet</p>
      </div>

      <template v-for="ev in visibleEvents" :key="ev.data.requestId">
        <div
          class="grid items-center px-2 py-1 text-2xs border-b border-border/10 hover:bg-surface-1/50 cursor-pointer select-none"
          style="grid-template-columns: 60px 36px 28px 46px 1fr"
          @click="toggleExpand(ev.data.requestId)"
        >
          <span class="font-mono text-muted-foreground/40 truncate">
            {{ formatOffset(ev.t) }}
          </span>

          <span class="font-mono font-semibold truncate" :class="methodColor(ev.data.method)">
            {{ ev.data.method.slice(0, 6) }}
          </span>

          <span class="font-mono" :class="statusColor(ev.data.status)">
            {{ ev.data.status ?? "—" }}
          </span>

          <span class="font-mono text-muted-foreground/50 text-right truncate">
            {{ formatMs(ev.data.duration) }}
          </span>

          <span class="truncate text-foreground/75 pl-1 min-w-0" :title="ev.data.url">
            {{ urlPath(ev.data.url) }}
          </span>
        </div>

        <div
          v-if="expandedId === ev.data.requestId"
          class="px-3 py-2 bg-surface-1 border-b border-border/20 text-2xs space-y-1"
        >
          <div class="font-mono text-muted-foreground/50 break-all">{{ ev.data.url }}</div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
            <div class="flex gap-2">
              <span class="text-muted-foreground/40 shrink-0">Host</span>
              <span class="truncate text-foreground/70">{{ urlHost(ev.data.url) }}</span>
            </div>
            <div class="flex gap-2">
              <span class="text-muted-foreground/40 shrink-0">Type</span>
              <span class="text-foreground/70">{{ ev.data.resourceType }}</span>
            </div>
            <div class="flex gap-2">
              <span class="text-muted-foreground/40 shrink-0">State</span>
              <span class="text-foreground/70">{{ ev.data.state }}</span>
            </div>
            <div class="flex gap-2">
              <span class="text-muted-foreground/40 shrink-0">Size</span>
              <span class="text-foreground/70">{{ formatBytes(ev.data.transferSize) }}</span>
            </div>
            <div class="flex gap-2">
              <span class="text-muted-foreground/40 shrink-0">Duration</span>
              <span class="text-foreground/70">{{ formatMs(ev.data.duration) }}</span>
            </div>
            <div class="flex gap-2">
              <span class="text-muted-foreground/40 shrink-0">Time</span>
              <span class="font-mono text-foreground/70">{{ formatOffset(ev.t) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
