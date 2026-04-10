<script setup lang="ts">
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-vue-next";

const props = defineProps<{
  tableName: string;
  dbName: string;
  isLoading: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  recordCount: number;
}>();

const emit = defineEmits<{
  refresh: [];
  prev: [];
  next: [];
  pageSizeChange: [size: number];
}>();

const pageSizes = [25, 50, 100, 250, 500];
</script>

<template>
  <div
    class="shrink-0 border-b border-border/30 bg-surface-0 px-4 py-2 flex items-center justify-between gap-3"
  >
    <!-- Left: table info -->
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-xs font-medium text-foreground/70 truncate">{{ tableName }}</span>
      <span class="text-[10px] text-muted-foreground/40 font-mono"> {{ recordCount }} rows </span>
    </div>

    <!-- Center: pagination -->
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

    <!-- Right: refresh -->
    <button
      class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-border/20 text-muted-foreground/60 hover:text-foreground/80 hover:bg-surface-2 transition-colors"
      :class="{ 'opacity-50 cursor-wait': isLoading }"
      @click="emit('refresh')"
    >
      <RefreshCw :size="11" :class="{ 'animate-spin': isLoading }" />
      Refresh
    </button>
  </div>
</template>
