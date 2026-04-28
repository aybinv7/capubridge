<script setup lang="ts">
import {
  BatteryMedium,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Moon,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-vue-next";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import type { AppBatteryStats } from "@/types/app-inspector.types";

const props = defineProps<{
  stats: AppBatteryStats | null;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ refresh: [] }>();
const showRaw = ref(false);

function fmtMs(ms: number): string {
  if (ms === 0) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtBar(ms: number, maxMs: number): number {
  return maxMs > 0 ? Math.min(100, Math.max(0, (ms / maxMs) * 100)) : 0;
}
</script>

<template>
  <div class="min-h-0">
    <div class="flex h-9 items-center justify-between border-b border-border/20 bg-surface-1 px-3">
      <div class="flex items-center gap-2 text-xs font-medium">
        <BatteryMedium class="h-3.5 w-3.5 text-emerald-400" />
        Battery consumption
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-[11px]"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <Loader2 v-if="isLoading" class="h-3 w-3 animate-spin" />
        <RefreshCw v-else class="h-3 w-3" />
      </Button>
    </div>

    <div
      v-if="error"
      class="flex items-start gap-2 border-b border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400"
    >
      <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span class="font-mono text-[10px]">{{ error }}</span>
    </div>

    <div v-if="isLoading && !stats" class="space-y-2 p-3">
      <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded bg-muted/20" />
    </div>

    <div
      v-else-if="!stats && !isLoading"
      class="flex items-center justify-center gap-2 px-3 py-8 text-xs text-muted-foreground/40"
    >
      <BatteryMedium class="h-4 w-4 text-muted-foreground/25" />
      Refresh to load battery stats
    </div>

    <div v-else-if="stats && !stats.hasData" class="px-3 py-4 text-center">
      <div class="text-xs text-muted-foreground/45">No battery stats available for this app</div>
      <div class="mt-1 text-[10px] text-muted-foreground/25">
        Battery stats reset on full charge and some OS builds restrict access
      </div>
    </div>

    <template v-else-if="stats">
      <div>
        <div class="border-b border-border/15 px-3 py-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Zap class="h-3.5 w-3.5 text-amber-400" />
              Foreground CPU
            </div>
            <span class="font-mono text-sm font-bold text-foreground/80">
              {{ fmtMs(stats.fgCpuTimeMs) }}
            </span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/20">
            <div
              class="h-full rounded-full bg-amber-500 transition-all"
              :style="{
                width: `${fmtBar(stats.fgCpuTimeMs, Math.max(stats.fgCpuTimeMs, stats.bgCpuTimeMs, 1))}%`,
              }"
            />
          </div>
        </div>

        <div class="border-b border-border/15 px-3 py-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Moon class="h-3.5 w-3.5 text-violet-400" />
              Background CPU
            </div>
            <span class="font-mono text-sm font-bold text-foreground/80">
              {{ fmtMs(stats.bgCpuTimeMs) }}
            </span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/20">
            <div
              class="h-full rounded-full bg-violet-500 transition-all"
              :style="{
                width: `${fmtBar(stats.bgCpuTimeMs, Math.max(stats.fgCpuTimeMs, stats.bgCpuTimeMs, 1))}%`,
              }"
            />
          </div>
        </div>

        <div v-if="stats.wakelocksMs > 0" class="border-b border-border/15 px-3 py-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Clock class="h-3.5 w-3.5 text-sky-400" />
              Wake Locks
            </div>
            <span class="font-mono text-sm font-bold text-foreground/80">
              {{ fmtMs(stats.wakelocksMs) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="stats.raw" class="border-t border-border/15">
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
          @click="showRaw = !showRaw"
        >
          <span class="font-medium uppercase tracking-wider">Raw output</span>
          <ChevronDown v-if="!showRaw" class="h-3.5 w-3.5" />
          <ChevronUp v-else class="h-3.5 w-3.5" />
        </button>
        <div v-if="showRaw" class="border-t border-border/15 bg-surface-1 p-3">
          <pre
            class="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-muted-foreground/45"
            >{{ stats.raw }}</pre
          >
        </div>
      </div>
    </template>
  </div>
</template>
