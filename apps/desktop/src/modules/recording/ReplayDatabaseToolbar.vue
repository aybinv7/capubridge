<script setup lang="ts">
import { ChevronLeft, ChevronRight, GitCompare, RefreshCw } from "lucide-vue-next";

defineProps<{
  tableName: string;
  databaseName: string;
  isLoading: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  recordCount: number;
  changeSummary?: {
    add: number;
    update: number;
    delete: number;
    total: number;
  };
  showChangesOnly?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  previous: [];
  next: [];
  pageSizeChange: [size: number];
  toggleChangesOnly: [];
}>();

const pageSizes = [25, 50];
</script>

<template>
  <div
    class="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/30 bg-surface-0 px-4"
  >
    <div class="min-w-0">
      <div class="truncate text-xs font-medium text-foreground/80">{{ tableName }}</div>
      <div class="truncate font-mono text-[10px] text-muted-foreground/40">
        {{ databaseName }} · {{ recordCount.toLocaleString() }} rows
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <button
        v-if="changeSummary?.total"
        type="button"
        class="flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors"
        :class="
          showChangesOnly
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
            : 'border-border/30 text-muted-foreground/60 hover:bg-surface-2 hover:text-foreground'
        "
        @click="emit('toggleChangesOnly')"
      >
        <GitCompare :size="12" />
        {{ changeSummary.total }} changes
      </button>

      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
        :disabled="page === 0"
        aria-label="Previous page"
        @click="emit('previous')"
      >
        <ChevronLeft :size="14" />
      </button>
      <span class="min-w-12 text-center font-mono text-[11px] text-muted-foreground/50">
        {{ page + 1 }}
      </span>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
        :disabled="!hasMore"
        aria-label="Next page"
        @click="emit('next')"
      >
        <ChevronRight :size="14" />
      </button>

      <select
        :value="pageSize"
        class="h-7 rounded-md border border-border/30 bg-surface-2 px-2 font-mono text-[10px] text-muted-foreground outline-none"
        aria-label="Rows per page"
        @change="emit('pageSizeChange', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} / page</option>
      </select>

      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground"
        aria-label="Refresh rows"
        @click="emit('refresh')"
      >
        <RefreshCw :size="13" :class="{ 'animate-spin': isLoading }" />
      </button>
    </div>
  </div>
</template>
