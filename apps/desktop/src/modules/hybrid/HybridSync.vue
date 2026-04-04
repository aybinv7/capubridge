<script setup lang="ts">
import { ref, computed } from "vue";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { syncQueueRecords } from "@/data/mock-data";

const syncRecords = ref(syncQueueRecords.map((r) => ({ ...r })));

const syncStats = computed(() => ({
  pending: syncRecords.value.filter((r) => r.status === "pending").length,
  failed: syncRecords.value.filter((r) => r.status === "failed").length,
  synced: syncRecords.value.filter((r) => r.status === "synced").length,
}));

const syncTypeColor: Record<string, string> = {
  CREATE: "text-success bg-success/10 border-success/20",
  UPDATE: "text-info bg-info/10 border-info/20",
  DELETE: "text-error bg-error/10 border-error/20",
};

const syncStatusIcon: Record<string, typeof Clock> = {
  pending: Clock,
  failed: XCircle,
  synced: CheckCircle,
};

const syncStatusColor: Record<string, string> = {
  pending: "text-warning",
  failed: "text-error",
  synced: "text-success",
};
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex items-stretch border-b border-border bg-accent shrink-0">
      <div
        v-for="stat in [
          { label: 'Pending', value: syncStats.pending, color: 'text-warning', bg: 'bg-warning/5' },
          { label: 'Failed', value: syncStats.failed, color: 'text-error', bg: 'bg-error/5' },
          { label: 'Synced', value: syncStats.synced, color: 'text-success', bg: 'bg-success/5' },
        ]"
        :key="stat.label"
        class="flex-1 flex flex-col items-center justify-center py-3 border-r border-border last:border-r-0"
        :class="stat.bg"
      >
        <span class="text-xl font-bold font-mono" :class="stat.color">{{ stat.value }}</span>
        <span class="text-2xs text-muted-foreground mt-0.5">{{ stat.label }}</span>
      </div>
      <div class="flex items-center px-3 border-l border-border">
        <Button variant="ghost" size="sm" class="text-2xs gap-1.5">
          <RefreshCw class="w-3 h-3" />
          Flush all
        </Button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
      <div
        v-for="record in syncRecords"
        :key="record.id"
        class="flex items-start gap-3 p-3 border transition-colors"
        :class="
          record.status === 'failed'
            ? 'border-error/20 bg-error/[0.03]'
            : record.status === 'synced'
              ? 'border-border bg-accent opacity-60'
              : 'border-border bg-accent'
        "
      >
        <div class="shrink-0 mt-0.5">
          <component
            :is="syncStatusIcon[record.status]"
            class="w-4 h-4"
            :class="syncStatusColor[record.status]"
          />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="text-2xs font-medium font-mono px-1.5 py-0.5 rounded border"
              :class="syncTypeColor[record.type]"
            >
              {{ record.type }}
            </span>
            <span class="text-xs text-foreground font-medium">{{ record.entity }}</span>
            <span class="text-2xs font-mono text-muted-foreground">{{ record.entityId }}</span>
            <span class="ml-auto text-2xs font-mono text-muted-foreground">{{
              record.timestamp.slice(11, 19)
            }}</span>
          </div>

          <div
            v-if="record.payload"
            class="font-mono text-2xs text-muted-foreground/70 bg-background rounded-md px-2 py-1.5 border border-border"
          >
            {{ JSON.stringify(record.payload) }}
          </div>

          <div v-if="record.retries > 0" class="flex items-center gap-1 mt-1.5">
            <AlertTriangle class="w-2.5 h-2.5 text-error" />
            <span class="text-2xs text-error"
              >{{ record.retries }} failed attempt{{ record.retries > 1 ? "s" : "" }}</span
            >
          </div>
        </div>

        <div class="flex gap-0.5 shrink-0">
          <Button
            v-if="record.status === 'failed'"
            variant="ghost"
            size="icon-sm"
            title="Retry"
            class="text-muted-foreground hover:text-warning"
          >
            <RotateCcw class="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete"
            class="text-muted-foreground hover:text-error"
          >
            <Trash2 class="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
