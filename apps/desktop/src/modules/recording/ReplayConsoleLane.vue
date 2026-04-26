<script setup lang="ts">
import { computed } from "vue";
import type { ConsoleCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: ConsoleCapuEvent[];
  positionMs: number;
}>();

function levelColor(level: string): string {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
    case "warning":
      return "text-yellow-400";
    case "info":
      return "text-sky-400";
    default:
      return "text-muted-foreground";
  }
}

function levelBadge(level: string): string {
  switch (level) {
    case "error":
      return "ERR";
    case "warn":
    case "warning":
      return "WRN";
    case "info":
      return "INF";
    case "debug":
      return "DBG";
    default:
      return "LOG";
  }
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
        Console
      </span>
      <span class="text-[11px] text-muted-foreground/50">{{ events.length }} entries</span>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0 font-mono">
      <div v-if="sortedEvents.length === 0" class="flex items-center justify-center h-16">
        <p class="text-[11px] text-muted-foreground/40">No console events recorded</p>
      </div>

      <div
        v-for="(ev, i) in sortedEvents"
        :key="i"
        class="flex items-start gap-2 px-3 py-0.5 text-[11px] border-b border-border/10 transition-opacity"
        :class="ev.t > positionMs ? 'opacity-25' : 'opacity-100'"
      >
        <span class="w-16 shrink-0 text-muted-foreground/50 pt-0.5">
          {{ formatOffset(ev.t) }}
        </span>

        <span class="w-7 shrink-0 font-bold pt-0.5" :class="levelColor(ev.data.level)">
          {{ levelBadge(ev.data.level) }}
        </span>

        <span class="flex-1 break-all whitespace-pre-wrap text-foreground/80">{{
          ev.data.text
        }}</span>
      </div>
    </div>
  </div>
</template>
