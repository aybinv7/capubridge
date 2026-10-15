<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { drawerRows, historyEmptyReason, permalinkFor } from "./runsDrawerState";
import { RECORDING_ENABLED } from "./runTrace";
import { toRunRow } from "./runHistory";
import type { RunRow } from "./runHistory";
import { invokeCommand } from "@/runtime/ipc/client";

const emit = defineEmits<{
  select: [runId: string];
}>();

const router = useRouter();
const open = ref(false);
const statusFilter = ref("all");
const rows = ref<RunRow[]>([]);
const scrollRef = ref<HTMLDivElement | null>(null);

const filtered = computed(() => drawerRows(rows.value, { status: statusFilter.value }));

const emptyReason = computed(() => historyEmptyReason(filtered.value.length, RECORDING_ENABLED));

const virtualizer = useVirtualizer(
  computed(() => ({
    count: filtered.value.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => 72,
    overscan: 10,
  })),
);

const virtualItems = computed(() => virtualizer.value.getVirtualItems());

function rowAt(index: number): RunRow | null {
  return filtered.value[index] ?? null;
}

function statusVariant(status: string): "secondary" | "default" | "outline" {
  if (status === "passed") {
    return "secondary";
  }
  if (status === "running") {
    return "default";
  }
  return "outline";
}

function titleOf(row: RunRow): string {
  return row.flowName ?? row.goal ?? "ad-hoc run";
}

async function load(): Promise<void> {
  try {
    const items = await invokeCommand("recording_list_sessions", undefined);
    rows.value = items.map((item) => toRunRow(item)).filter((row): row is RunRow => row !== null);
  } catch {
    rows.value = [];
  }
}

function onOpen(value: boolean): void {
  open.value = value;
  if (value) {
    void load();
  }
}

function selectRun(row: RunRow): void {
  const path = `/automation/runs/${row.sessionId}`;
  void router.push(path);
  emit("select", row.sessionId);
  open.value = false;
}

function copyPermalink(row: RunRow, index: number): void {
  const link = permalinkFor(row.sessionId, index);
  void navigator.clipboard.writeText(`${window.location.origin}${link}`);
}

defineExpose({
  open: () => {
    open.value = true;
    void load();
  },
});
</script>

<template>
  <Dialog :open="open" @update:open="onOpen">
    <DialogContent
      class="flex h-[min(42rem,calc(100vh-4rem))] max-w-2xl flex-col gap-0 overflow-hidden p-0"
    >
      <DialogHeader class="shrink-0 border-b px-6 py-5 pr-12">
        <DialogTitle>Conversation history</DialogTitle>
        <DialogDescription>
          Each completed run is a separate device conversation. Open one to inspect its saved
          context.
        </DialogDescription>
        <div class="flex gap-2 pt-2">
          <div class="flex flex-1 flex-col gap-1">
            <Label>Status</Label>
            <Select v-model:model-value="statusFilter">
              <SelectTrigger class="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogHeader>
      <div ref="scrollRef" class="flex-1 overflow-auto px-4 py-3">
        <p v-if="emptyReason !== null" class="px-2 py-8 text-center text-sm text-muted-foreground">
          {{ emptyReason }}
        </p>
        <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
          <div
            v-for="v in virtualItems"
            :key="v.key"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${v.start}px)`,
            }"
          >
            <div v-if="rowAt(v.index) !== null" class="pb-3">
              <button
                class="flex w-full flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:bg-muted/40"
                @click="selectRun(rowAt(v.index)!)"
              >
                <span class="flex items-center gap-2">
                  <Badge :variant="statusVariant(rowAt(v.index)!.runStatus)">{{
                    rowAt(v.index)!.runStatus
                  }}</Badge>
                  <span class="truncate text-sm font-medium">{{ titleOf(rowAt(v.index)!) }}</span>
                  <Badge v-if="rowAt(v.index)!.flowName === null" variant="outline" class="shrink-0"
                    >ad-hoc</Badge
                  >
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ rowAt(v.index)!.policyId }} · {{ rowAt(v.index)!.stepCount }} steps ·
                  {{ new Date(rowAt(v.index)!.startedAt).toLocaleString() }}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  class="h-6 self-start px-2 text-xs"
                  @click.stop="copyPermalink(rowAt(v.index)!, 0)"
                  >Copy link</Button
                >
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
