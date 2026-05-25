<script setup lang="ts">
import { RefreshCw, ChevronLeft, ChevronRight, Radio, GitCompare } from "lucide-vue-next";
import type { SqliteChangeSummary } from "@/types/sqliteChanges.types";

defineProps<{
  tableName: string;
  dbName: string;
  isLoading: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  recordCount: number;
  liveEnabled?: boolean;
  liveIntervalMs?: number;
  changeSummary?: SqliteChangeSummary;
  showChangesOnly?: boolean;
  showLiveControl?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  prev: [];
  next: [];
  pageSizeChange: [size: number];
  toggleLive: [];
  toggleChangesOnly: [];
}>();

const pageSizes = [25, 50, 100, 250, 500];
</script>

<template>
  <div
    class="shrink-0 border-b border-border/30 bg-surface-0 px-4 py-2 flex items-center justify-between gap-3"
  >
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-xs font-medium text-foreground/70 truncate">{{ tableName }}</span>
      <span class="text-[10px] text-muted-foreground/40 font-mono"> {{ recordCount }} rows </span>
    </div>

    <div class="flex items-center gap-1.5">
      <button
        class="p-1 rounded hover:bg-surface-3 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        :disabled="page === 0"
        @click="emit('prev')"
      >
        <ChevronLeft :size="13" />
      </button>

      <span class="text-[11px] font-mono text-muted-foreground/50 min-w-[60px] text-center">
        Page {{ page + 1 }}
      </span>

      <button
        class="p-1 rounded hover:bg-surface-3 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        :disabled="!hasMore"
        @click="emit('next')"
      >
        <ChevronRight :size="13" />
      </button>

      <select
        :value="pageSize"
        class="text-[10px] font-mono bg-surface-2 border border-border/20 rounded px-1.5 py-0.5 text-muted-foreground/60 outline-none focus:border-border/50"
        @change="emit('pageSizeChange', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}/page</option>
      </select>
    </div>

    <div class="flex items-center gap-1.5">
      <button
        v-if="changeSummary && changeSummary.total > 0"
        class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border transition-colors"
        :class="
          showChangesOnly
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
            : 'border-border/20 text-muted-foreground/60 hover:text-foreground/80 hover:bg-surface-2'
        "
        :title="
          showChangesOnly
            ? 'Showing only rows with tracked changes'
            : `Show only changed rows (${changeSummary.total})`
        "
        @click="emit('toggleChangesOnly')"
      >
        <GitCompare :size="11" />
        Changes
        <span class="font-mono text-[10px] tabular-nums opacity-70">
          {{ changeSummary.total }}
        </span>
      </button>

      <button
        v-if="showLiveControl !== false"
        class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border transition-colors"
        :class="
          liveEnabled
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-border/20 text-muted-foreground/60 hover:text-foreground/80 hover:bg-surface-2'
        "
        :title="
          liveEnabled
            ? `Live polling every ${(liveIntervalMs ?? 5000) / 1000}s`
            : 'Enable live polling'
        "
        @click="emit('toggleLive')"
      >
        <Radio :size="11" :class="{ 'animate-pulse': liveEnabled }" />
        Live
      </button>

      <button
        class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-border/20 text-muted-foreground/60 hover:text-foreground/80 hover:bg-surface-2 transition-colors"
        :class="{ 'opacity-50 cursor-wait': isLoading }"
        @click="emit('refresh')"
      >
        <RefreshCw :size="11" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </button>
    </div>
  </div>
</template>
