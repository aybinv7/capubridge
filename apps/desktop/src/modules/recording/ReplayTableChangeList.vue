<script setup lang="ts">
import { computed } from "vue";
import { GitCommitHorizontal, GitCompare } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TABLE_CHANGE_ORDER,
  countChangesAtOrBefore,
  formatAffectedRows,
  groupTableChanges,
  tableChangeBadgeClass,
  tableChangeSegmentClass,
  truncateAffectedIds,
} from "./replayTableChanges";
import type { ReplayTableChangeEntry, ReplayTableChangeSource } from "./replayTableChanges";

const props = defineProps<{
  source: ReplayTableChangeSource;
  positionMs: number;
}>();

const emit = defineEmits<{
  seek: [ms: number];
}>();

const groups = computed(() => groupTableChanges(props.source.changes));
const reachedCount = computed(() => countChangesAtOrBefore(props.source.changes, props.positionMs));
const segments = computed(() =>
  TABLE_CHANGE_ORDER.map((type) => ({
    type,
    count: props.source.counts[type],
    class: tableChangeSegmentClass(type),
  })).filter((segment) => segment.count > 0),
);

function isFuture(tMs: number) {
  return tMs > props.positionMs;
}

function idsOf(change: ReplayTableChangeEntry) {
  return truncateAffectedIds(change.affectedIds);
}

function idsTitle(change: ReplayTableChangeEntry) {
  return change.affectedIds && change.affectedIds.length > 0
    ? change.affectedIds.map(String).join(", ")
    : "";
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div
      class="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/30 bg-surface-0 px-4"
    >
      <div class="min-w-0">
        <div class="truncate text-xs font-medium text-foreground/80">{{ source.table }}</div>
        <div class="truncate font-mono text-[10px] text-muted-foreground/40">
          {{ source.engine }} · {{ source.recordCount.toLocaleString() }} changes · no row content
          recorded
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span
          v-for="segment in segments"
          :key="segment.type"
          class="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60"
        >
          <span class="inline-block h-1.5 w-1.5 rounded-full" :class="segment.class" />
          {{ segment.count.toLocaleString() }} {{ segment.type }}
        </span>
      </div>
    </div>

    <div
      class="flex h-7 shrink-0 items-center gap-2 border-b border-border/20 bg-surface-1/40 px-3 text-[10px] text-muted-foreground/50"
    >
      <GitCompare class="h-3 w-3" />
      <span>
        {{ reachedCount.toLocaleString() }} of {{ source.recordCount.toLocaleString() }} changes at
        {{ Math.max(0, positionMs).toLocaleString() }} ms
      </span>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="divide-y divide-border/15">
        <section
          v-for="group in groups"
          :key="group.key"
          class="px-3 py-2 transition-opacity"
          :class="isFuture(group.tMs) ? 'opacity-40' : ''"
        >
          <button
            v-if="group.transactionId !== null"
            type="button"
            class="mb-1.5 flex w-full items-center gap-2 rounded px-1 py-0.5 text-left font-mono text-[10px] text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground"
            :title="`Seek to ${group.tMs.toLocaleString()} ms`"
            @click="emit('seek', group.tMs)"
          >
            <GitCommitHorizontal class="h-3 w-3 shrink-0 text-sky-300/80" />
            <span class="truncate">tx {{ group.transactionId }}</span>
            <span class="ml-auto shrink-0">{{ group.changes.length }} changes</span>
          </button>

          <button
            v-for="change in group.changes"
            :key="change.id"
            type="button"
            class="flex w-full items-start gap-3 rounded px-1 py-1 text-left transition-colors hover:bg-surface-2/70"
            :class="group.transactionId !== null ? 'pl-5' : ''"
            :title="`Seek to ${change.tMs.toLocaleString()} ms`"
            @click="emit('seek', change.tMs)"
          >
            <span class="w-20 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/50">
              {{ change.tMs.toLocaleString() }} ms
            </span>
            <Badge
              variant="outline"
              class="h-5 shrink-0 border px-1.5 font-mono text-[10px] uppercase tracking-wider"
              :class="tableChangeBadgeClass(change.type)"
            >
              {{ change.type }}
            </Badge>
            <span class="w-16 shrink-0 font-mono text-[10px] text-muted-foreground/70">
              {{ formatAffectedRows(change) }}
            </span>
            <span
              class="flex min-w-0 flex-1 flex-wrap items-center gap-1"
              :title="idsTitle(change)"
            >
              <template v-if="idsOf(change).shown.length > 0">
                <span
                  v-for="id in idsOf(change).shown"
                  :key="id"
                  class="max-w-40 truncate rounded border border-border/30 bg-surface-3 px-1 font-mono text-[10px] text-foreground/80"
                >
                  {{ id }}
                </span>
                <span
                  v-if="idsOf(change).hidden > 0"
                  class="font-mono text-[10px] text-muted-foreground/50"
                >
                  +{{ idsOf(change).hidden }} more
                </span>
              </template>
              <span v-else class="font-mono text-[10px] text-muted-foreground/40">
                {{ change.affectedIds === null ? "ids not recorded" : "no ids" }}
              </span>
            </span>
          </button>
        </section>
      </div>
    </ScrollArea>
  </div>
</template>
