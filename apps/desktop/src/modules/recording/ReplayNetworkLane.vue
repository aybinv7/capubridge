<script setup lang="ts">
import { computed } from "vue";
import type { NetworkCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: NetworkCapuEvent[];
  positionMs: number;
}>();

// Status → color token
function statusColor(status: number | null): string {
  if (status === null) return "text-muted-foreground/40";
  if (status < 300) return "text-green-400";
  if (status < 400) return "text-yellow-400";
  return "text-red-400";
}

function methodColor(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "text-sky-400";
  if (m === "POST") return "text-violet-400";
  if (m === "PUT" || m === "PATCH") return "text-amber-400";
  if (m === "DELETE") return "text-red-400";
  return "text-muted-foreground";
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatOffset(t: number): string {
  const s = Math.floor(t / 1000);
  const ms = t % 1000;
  return `+${s}.${String(ms).padStart(3, "0")}s`;
}

const sortedEvents = computed(() => [...props.events].sort((a, b) => a.t - b.t));
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex-none px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
      <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        Network
      </span>
      <span class="text-[11px] text-muted-foreground/50">{{ events.length }} requests</span>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="sortedEvents.length === 0" class="flex items-center justify-center h-16">
        <p class="text-[11px] text-muted-foreground/40">No network events recorded</p>
      </div>

      <div
        v-for="ev in sortedEvents"
        :key="ev.data.requestId"
        class="flex items-center gap-2 px-3 py-1 text-[11px] border-b border-border/10 transition-opacity"
        :class="ev.t > positionMs ? 'opacity-25' : 'opacity-100'"
      >
        <!-- Time offset -->
        <span class="w-16 shrink-0 font-mono text-muted-foreground/50">
          {{ formatOffset(ev.t) }}
        </span>

        <!-- Method -->
        <span class="w-12 shrink-0 font-mono font-medium" :class="methodColor(ev.data.method)">
          {{ ev.data.method }}
        </span>

        <!-- Status -->
        <span class="w-8 shrink-0 font-mono" :class="statusColor(ev.data.status)">
          {{ ev.data.status ?? "—" }}
        </span>

        <!-- Duration -->
        <span class="w-14 shrink-0 text-right font-mono text-muted-foreground/50">
          {{ formatMs(ev.data.duration) }}
        </span>

        <!-- URL -->
        <span class="flex-1 truncate text-foreground/80" :title="ev.data.url">
          {{ ev.data.url }}
        </span>
      </div>
    </div>
  </div>
</template>
