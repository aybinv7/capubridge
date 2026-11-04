<script setup lang="ts">
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IndexedDBChangeSummary } from "@/types/storageChanges.types";

const props = defineProps<{
  storeName: string;
  dbName: string;
  isLoading: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  recordCount: number;
  changeSummary?: IndexedDBChangeSummary;
  showChangesOnly?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  prev: [];
  next: [];
  pageSizeChange: [size: number];
  toggleChangesOnly: [];
}>();

const pageSizeOptions = [50, 100, 500];
</script>

<template>
  <div
    class="flex h-9 shrink-0 items-center justify-between border-b border-border/30 bg-surface-2 px-4 gap-3"
  >
    <!-- Left: store path -->
    <div class="flex items-center gap-2 min-w-0 overflow-hidden">
      <span class="text-sm font-medium text-foreground truncate">{{ props.storeName }}</span>
      <span class="text-muted-foreground/20 shrink-0">·</span>
      <span class="text-xs text-muted-foreground/40 truncate font-mono">{{ props.dbName }}</span>
    </div>

    <!-- Right: controls -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Record count -->
      <span class="text-xs text-muted-foreground/40 tabular-nums">
        {{ props.recordCount.toLocaleString() }} records
      </span>

      <button
        v-if="props.changeSummary?.total"
        type="button"
        class="flex items-center gap-1 rounded-md border px-1 py-0.5 transition-colors"
        :class="
          props.showChangesOnly
            ? 'border-primary/40 bg-primary/10'
            : 'border-transparent hover:border-border/40 hover:bg-surface-3'
        "
        :title="props.showChangesOnly ? 'Show all rows' : 'Show changed rows only'"
        @click="emit('toggleChangesOnly')"
      >
        <Badge
          v-if="props.changeSummary.add"
          variant="outline"
          class="h-5 border-success/30 bg-success/10 px-1.5 text-2xs text-success"
        >
          +{{ props.changeSummary.add }}
        </Badge>
        <Badge
          v-if="props.changeSummary.update"
          variant="outline"
          class="h-5 border-warning/30 bg-warning/10 px-1.5 text-2xs text-warning"
        >
          ~{{ props.changeSummary.update }}
        </Badge>
        <Badge
          v-if="props.changeSummary.delete"
          variant="outline"
          class="h-5 border-error/30 bg-error/10 px-1.5 text-2xs text-error"
        >
          -{{ props.changeSummary.delete }}
        </Badge>
      </button>

      <!-- Page size selector -->
      <Select
        :model-value="String(props.pageSize)"
        @update:model-value="(v: string) => emit('pageSizeChange', Number(v))"
      >
        <SelectTrigger
          class="h-7 w-auto gap-1.5 border-border/30 px-2 text-xs text-muted-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in pageSizeOptions" :key="s" :value="String(s)">
            {{ s }} / page
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Pagination -->
      <div class="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="props.page === 0"
          aria-label="Previous page"
          @click="emit('prev')"
        >
          <ChevronLeft :size="14" />
        </Button>
        <span class="w-8 text-center text-xs text-muted-foreground tabular-nums">
          {{ props.page + 1 }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!props.hasMore"
          aria-label="Next page"
          @click="emit('next')"
        >
          <ChevronRight :size="14" />
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
        <RefreshCw :size="14" />
      </Button>
    </div>
  </div>
</template>
