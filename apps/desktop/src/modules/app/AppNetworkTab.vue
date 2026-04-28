<script setup lang="ts">
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  RefreshCw,
  Signal,
  Wifi,
  WifiOff,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import type { AppNetworkStats } from "@/types/app-inspector.types";

defineProps<{
  stats: AppNetworkStats | null;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ refresh: [] }>();

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
</script>

<template>
  <div class="min-h-0">
    <div class="flex h-9 items-center justify-between border-b border-border/20 bg-surface-1 px-3">
      <div class="flex min-w-0 items-center gap-2">
        <Wifi class="h-3.5 w-3.5 text-sky-400" />
        <span class="text-xs font-medium">Network counters</span>
        <span v-if="stats?.uid" class="truncate font-mono text-[10px] text-muted-foreground/40">
          uid={{ stats.uid }}
        </span>
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
      <div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded bg-muted/20" />
    </div>

    <div
      v-else-if="stats && !stats.available && stats.uid"
      class="flex items-center gap-3 px-3 py-4 text-xs text-muted-foreground/45"
    >
      <WifiOff class="h-4 w-4 shrink-0 text-muted-foreground/25" />
      <span>/proc/net/xt_qtaguid/stats is restricted on this device.</span>
    </div>

    <div
      v-else-if="!stats && !isLoading"
      class="flex items-center justify-center gap-2 px-3 py-8 text-xs text-muted-foreground/40"
    >
      <Wifi class="h-4 w-4 text-muted-foreground/25" />
      Refresh to load network stats
    </div>

    <template v-else-if="stats">
      <div>
        <div class="flex items-center gap-2 border-b border-border/15 bg-surface-0 px-3 py-2">
          <Wifi class="h-3.5 w-3.5 text-sky-400" />
          <span class="text-xs font-medium text-foreground/70">Wi-Fi</span>
        </div>
        <div class="grid grid-cols-2 divide-x divide-border/15">
          <div class="px-3 py-2">
            <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <ArrowDown class="h-3 w-3 text-emerald-400" /> Received
            </div>
            <div class="mt-1 font-mono text-sm font-semibold text-foreground/85">
              {{ fmtBytes(stats.wifiRxBytes) }}
            </div>
          </div>
          <div class="px-3 py-2">
            <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <ArrowUp class="h-3 w-3 text-amber-400" /> Sent
            </div>
            <div class="mt-1 font-mono text-sm font-semibold text-foreground/85">
              {{ fmtBytes(stats.wifiTxBytes) }}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center gap-2 border-y border-border/15 bg-surface-0 px-3 py-2">
          <Signal class="h-3.5 w-3.5 text-violet-400" />
          <span class="text-xs font-medium text-foreground/70">Mobile Data</span>
        </div>
        <div class="grid grid-cols-2 divide-x divide-border/15">
          <div class="px-3 py-2">
            <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <ArrowDown class="h-3 w-3 text-emerald-400" /> Received
            </div>
            <div class="mt-1 font-mono text-sm font-semibold text-foreground/85">
              {{ fmtBytes(stats.mobileRxBytes) }}
            </div>
          </div>
          <div class="px-3 py-2">
            <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <ArrowUp class="h-3 w-3 text-amber-400" /> Sent
            </div>
            <div class="mt-1 font-mono text-sm font-semibold text-foreground/85">
              {{ fmtBytes(stats.mobileTxBytes) }}
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-between border-t border-border/20 bg-surface-1 px-3 py-2"
      >
        <span class="text-xs text-muted-foreground/50">Total transferred</span>
        <span class="font-mono text-sm font-semibold text-foreground/80">
          {{
            fmtBytes(
              stats.wifiRxBytes + stats.wifiTxBytes + stats.mobileRxBytes + stats.mobileTxBytes,
            )
          }}
        </span>
      </div>
    </template>
  </div>
</template>
