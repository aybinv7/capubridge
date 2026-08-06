<script setup lang="ts">
import { ChevronLeft, ChevronRight, Radio, RefreshCw } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SqliteChangeSummary } from "@/types/sqliteChanges.types";

const props = withDefaults(
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
  }>(),
  {
    showLiveControl: true,
  },
);

const emit = defineEmits<{
  refresh: [];
  prev: [];
  next: [];
  pageSizeChange: [size: number];
  toggleLive: [];
  toggleChangesOnly: [];
}>();

const pageSizeOptions = [50, 100, 500];
</script>

<template>
  <div
    class="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border/30 bg-surface-2 px-4"
  >
    <div class="flex min-w-0 items-center gap-2 overflow-hidden">
      <span class="truncate text-sm font-medium text-foreground">{{ props.tableName }}</span>
      <span class="shrink-0 text-muted-foreground/20">·</span>
      <span class="truncate font-mono text-xs text-muted-foreground/40">{{ props.dbName }}</span>
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <span class="tabular-nums text-xs text-muted-foreground/40">
        {{ props.recordCount.toLocaleString() }} rows
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
          class="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-400"
        >
          +{{ props.changeSummary.add }}
        </Badge>
        <Badge
          v-if="props.changeSummary.update"
          variant="outline"
          class="h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-400"
        >
          ~{{ props.changeSummary.update }}
        </Badge>
        <Badge
          v-if="props.changeSummary.delete"
          variant="outline"
          class="h-5 border-red-500/30 bg-red-500/10 px-1.5 text-[10px] text-red-400"
        >
          -{{ props.changeSummary.delete }}
        </Badge>
      </button>

      <Button
        v-if="props.showLiveControl !== false"
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-xs"
        :class="props.liveEnabled ? 'text-success' : 'text-muted-foreground'"
        :title="
          props.liveEnabled
            ? `Live polling every ${(props.liveIntervalMs ?? 5000) / 1000}s`
            : 'Enable live polling'
        "
        @click="emit('toggleLive')"
      >
        <Radio :size="13" :class="{ 'animate-pulse': props.liveEnabled }" />
        Live
      </Button>

      <Select
        :model-value="String(props.pageSize)"
        @update:model-value="(value: string) => emit('pageSizeChange', Number(value))"
      >
        <SelectTrigger
          class="h-7 w-auto gap-1.5 border-border/30 px-2 text-xs text-muted-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="size in pageSizeOptions" :key="size" :value="String(size)">
            {{ size }} / page
          </SelectItem>
        </SelectContent>
      </Select>

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
        <span class="w-8 text-center text-xs tabular-nums text-muted-foreground">{{
          props.page + 1
        }}</span>
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
