<script setup lang="ts">
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  storeName: string;
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

const pageSizeOptions = [50, 100, 500];
</script>

<template>
  <div
    class="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3 gap-3"
  >
    <!-- Left: store path -->
    <div class="flex items-center gap-2 min-w-0 overflow-hidden">
      <span class="text-[12px] font-medium text-foreground truncate">{{ props.storeName }}</span>
      <span class="text-muted-foreground/30 shrink-0">·</span>
      <span class="text-[11px] text-muted-foreground/50 truncate font-mono">{{
        props.dbName
      }}</span>
    </div>

    <!-- Right: controls -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Record count -->
      <span class="text-[11px] text-muted-foreground/40 tabular-nums">
        {{ props.recordCount.toLocaleString() }} records
      </span>

      <!-- Page size selector -->
      <select
        class="h-6 border border-border bg-transparent px-1.5 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        :value="props.pageSize"
        @change="emit('pageSizeChange', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="s in pageSizeOptions" :key="s" :value="s">{{ s }} / page</option>
      </select>

      <!-- Pagination -->
      <div class="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="props.page === 0"
          aria-label="Previous page"
          @click="emit('prev')"
        >
          <ChevronLeft :size="13" />
        </Button>
        <span class="w-6 text-center text-[11px] text-muted-foreground tabular-nums">
          {{ props.page + 1 }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!props.hasMore"
          aria-label="Next page"
          @click="emit('next')"
        >
          <ChevronRight :size="13" />
        </Button>
      </div>

      <!-- Refresh -->
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh"
        :class="{ 'animate-spin': props.isLoading }"
        @click="emit('refresh')"
      >
        <RefreshCw :size="13" />
      </Button>
    </div>
  </div>
</template>
