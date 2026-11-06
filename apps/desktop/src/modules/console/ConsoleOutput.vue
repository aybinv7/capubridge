<script setup lang="ts">
import { computed, ref } from "vue";
import { refDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { ChevronRight, Search, Ban } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConsoleStore } from "@/stores/console.store";
import type { ConsoleEntry, ConsoleEntryLevel } from "@/types/console.types";
import ConsoleArgsView from "@/components/console/ConsoleArgsView.vue";
import { buildConsoleRows, consoleSearchText } from "@/lib/console/consoleRows";
import { useScrollAreaVirtualizer } from "@/composables/useScrollAreaVirtualizer";
import { useRevealFocus } from "@/shared/timeline/revealFocus";

type FilterLevel = ConsoleEntryLevel | "all" | "verbose";

const consoleStore = useConsoleStore();

const searchQuery = ref("");
const debouncedQuery = refDebounced(searchQuery, 150);
const activeLevel = ref<FilterLevel>("all");
const groupOverride = ref(new Map<string, boolean>());

const levelCounts = computed(() => consoleStore.levelCounts);

function isExpanded(entry: ConsoleEntry): boolean {
  const o = groupOverride.value.get(entry.id);
  if (o !== undefined) return o;
  return !entry.groupCollapsed;
}

function toggleGroup(entry: ConsoleEntry) {
  const next = new Map(groupOverride.value);
  next.set(entry.id, !isExpanded(entry));
  groupOverride.value = next;
}

const visibleRows = computed(() => {
  void consoleStore.entryVersion;
  const query = debouncedQuery.value.trim().toLowerCase();
  const level = activeLevel.value;
  const levelOk = (entry: ConsoleEntry) =>
    level === "all" ||
    (level === "verbose"
      ? entry.level === "log" || entry.level === "debug"
      : entry.level === level);
  return buildConsoleRows(consoleStore.consoleSource.ring, {
    test:
      query || level !== "all"
        ? (entry) => levelOk(entry) && (!query || consoleSearchText(entry).includes(query))
        : null,
    isExpanded,
  });
});

const {
  bindScrollArea,
  virtualizer,
  visible: virtualRows,
  totalSize,
  measure,
} = useScrollAreaVirtualizer(visibleRows, {
  estimateSize: 26,
  itemKey: (row) => row.entry.id,
});

const flashId = useRevealFocus("console", {
  rows: visibleRows,
  idOf: (row) => row.entry.id,
  scrollToIndex: (index) => virtualizer.value.scrollToIndex(index, { align: "center" }),
  showAll: () => {
    searchQuery.value = "";
    activeLevel.value = "all";
  },
});

function rowClass(level: ConsoleEntryLevel): string {
  if (level === "error") return "bg-error/[0.07] border-l-2 border-error/60 hover:bg-error/[0.12]";
  if (level === "warn")
    return "bg-warning/[0.07] border-l-2 border-warning/60 hover:bg-warning/[0.12]";
  return "border-l-2 border-transparent hover:bg-surface-2/40";
}

function textClass(level: ConsoleEntryLevel): string {
  if (level === "error") return "text-error";
  if (level === "warn") return "text-warning";
  if (level === "info") return "text-info";
  if (level === "debug") return "text-violet-300";
  return "text-foreground/85";
}

function retryCapture() {
  consoleStore.retry().catch((error: unknown) => {
    toast.error("Could not reconnect the console", { description: String(error) });
  });
}

function copyEntry(e: ConsoleEntry) {
  void navigator.clipboard.writeText(e.message).catch((error) => {
    toast.error("Failed to copy console entry", { description: String(error) });
  });
}

const FILTER_LEVELS = [
  "all",
  "error",
  "warn",
  "info",
  "verbose",
] as const satisfies readonly FilterLevel[];
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-0">
    <div class="flex h-9 flex-none items-center gap-1 border-b border-border/30 bg-surface-2 px-2">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7"
        title="Clear console"
        @click="consoleStore.clearConsole()"
      >
        <Ban class="h-3.5 w-3.5" />
      </Button>

      <div
        class="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/30 bg-surface-3 px-2"
      >
        <Search class="h-3 w-3 shrink-0 text-muted-foreground/45" />
        <Input
          v-model="searchQuery"
          class="h-6 border-0 bg-transparent px-0 font-mono text-2xs focus-visible:ring-0"
          placeholder="Filter"
        />
      </div>

      <Button
        v-for="lvl in FILTER_LEVELS"
        :key="lvl"
        variant="ghost"
        size="sm"
        class="h-7 gap-1 rounded-md px-2 font-mono text-2xs"
        :class="
          activeLevel === lvl
            ? 'bg-surface-1 text-foreground'
            : 'text-muted-foreground/55 hover:text-foreground'
        "
        @click="activeLevel = lvl"
      >
        <span class="capitalize">{{ lvl }}</span>
        <span class="text-muted-foreground/50">{{ levelCounts[lvl] }}</span>
      </Button>

      <Badge
        variant="outline"
        class="ml-1 h-6 rounded-full border px-2 font-mono text-2xs"
        :class="
          consoleStore.captureStatus === 'live'
            ? 'border-success/30 bg-success/10 text-success'
            : consoleStore.captureStatus === 'error'
              ? 'border-error/30 bg-error/10 text-error'
              : 'border-border/40 bg-surface-3 text-muted-foreground'
        "
      >
        {{ consoleStore.captureStatus }}
      </Badge>
    </div>

    <div
      v-if="consoleStore.error"
      class="flex shrink-0 items-center gap-2 border-b border-warning/20 bg-warning/8 px-3 py-1.5 text-2xs text-warning"
    >
      <span class="min-w-0 flex-1 font-mono">{{ consoleStore.error }}</span>
      <Button
        v-if="consoleStore.captureStatus === 'error'"
        variant="ghost"
        size="sm"
        class="h-6 px-2 text-2xs"
        @click="retryCapture()"
      >
        Retry
      </Button>
    </div>

    <div
      v-if="!consoleStore.boundTargetId"
      class="flex flex-1 items-center justify-center text-xs text-muted-foreground/45"
    >
      Connect target first.
    </div>

    <div
      v-else-if="visibleRows.length === 0"
      class="flex flex-1 items-center justify-center text-xs text-muted-foreground/45"
    >
      No console entries.
    </div>

    <ScrollArea v-else :ref="bindScrollArea" class="min-h-0 flex-1">
      <div class="relative font-mono text-xs" :style="{ height: `${totalSize}px` }">
        <div
          v-for="{ key, index, start, item: { entry, depth } } in virtualRows"
          :key="key"
          :ref="measure"
          :data-index="index"
          class="group absolute top-0 left-0 w-full select-text"
          :class="[rowClass(entry.level), flashId === entry.id ? 'reveal-flash' : '']"
          :style="{ transform: `translateY(${start}px)` }"
          @dblclick="copyEntry(entry)"
        >
          <div
            class="flex items-start gap-1 px-2 py-1"
            :style="{ paddingLeft: `${8 + depth * 14}px` }"
            :class="entry.isGroup ? 'cursor-pointer' : ''"
            @click="entry.isGroup && toggleGroup(entry)"
          >
            <ChevronRight
              v-if="entry.isGroup"
              class="mt-[3px] h-3 w-3 shrink-0 text-muted-foreground/55 transition-transform"
              :class="isExpanded(entry) ? 'rotate-90' : ''"
            />
            <span v-else class="mt-[3px] h-3 w-3 shrink-0" />

            <div class="flex-1 min-w-0">
              <ConsoleArgsView :args="entry.args" :text-class="textClass(entry.level)" />
            </div>

            <span
              v-if="entry.source && entry.source !== 'runtime'"
              class="ml-2 shrink-0 truncate pt-px text-2xs text-muted-foreground/45 hover:text-muted-foreground/80 max-w-[35%]"
              :title="entry.url ?? entry.source"
            >
              {{ entry.source }}
            </span>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
