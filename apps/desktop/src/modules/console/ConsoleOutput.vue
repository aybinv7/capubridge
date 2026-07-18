<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { ChevronRight, Search, Ban } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConsoleStore } from "@/stores/console.store";
import type { ConsoleEntry, ConsoleEntryLevel } from "@/types/console.types";
import ConsoleArgsView from "@/components/console/ConsoleArgsView.vue";

type FilterLevel = ConsoleEntryLevel | "all" | "verbose";

const consoleStore = useConsoleStore();

const searchQuery = ref("");
const activeLevel = ref<FilterLevel>("all");
const groupOverride = ref(new Map<string, boolean>());

onMounted(() => {
  void consoleStore.initialize();
  void consoleStore.acquireLease();
});

watch(
  () => consoleStore.activeTarget?.id ?? null,
  () => {
    void consoleStore.syncLease(consoleStore.activeTarget ?? null);
  },
);

onUnmounted(() => {
  void consoleStore.releaseLease();
});

const levelCounts = computed(() => ({
  all: consoleStore.entries.length,
  error: consoleStore.entries.filter((e) => e.level === "error").length,
  warn: consoleStore.entries.filter((e) => e.level === "warn").length,
  info: consoleStore.entries.filter((e) => e.level === "info").length,
  verbose: consoleStore.entries.filter((e) => e.level === "log" || e.level === "debug").length,
}));

const matchedSet = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const matched = new Set<string>();
  for (const e of consoleStore.entries) {
    if (activeLevel.value !== "all") {
      const levelMatch =
        activeLevel.value === "verbose"
          ? e.level === "log" || e.level === "debug"
          : e.level === activeLevel.value;
      if (!levelMatch) continue;
    }
    if (q && !`${e.source} ${e.message}`.toLowerCase().includes(q)) continue;
    matched.add(e.id);
  }
  return matched;
});

const childrenByParent = computed(() => {
  const map = new Map<string, ConsoleEntry[]>();
  for (const e of consoleStore.entries) {
    if (e.parentId) {
      if (!map.has(e.parentId)) map.set(e.parentId, []);
      map.get(e.parentId)!.push(e);
    }
  }
  return map;
});

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
  const rows: Array<{ entry: ConsoleEntry; depth: number }> = [];
  const matched = matchedSet.value;
  const filterActive = searchQuery.value.trim() !== "" || activeLevel.value !== "all";
  const visited = new Set<string>();

  function shouldShow(e: ConsoleEntry, seen: Set<string>): boolean {
    if (!filterActive) return true;
    if (matched.has(e.id)) return true;
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    if (e.isGroup) {
      const kids = childrenByParent.value.get(e.id) ?? [];
      return kids.some((k) => shouldShow(k, seen));
    }
    return false;
  }

  function visit(entry: ConsoleEntry, depth: number) {
    if (visited.has(entry.id)) return;
    visited.add(entry.id);
    if (!shouldShow(entry, new Set())) return;
    rows.push({ entry, depth });
    if (entry.isGroup && isExpanded(entry)) {
      const kids = childrenByParent.value.get(entry.id) ?? [];
      for (const k of kids) {
        if (k.id === entry.id) continue;
        visit(k, depth + 1);
      }
    }
  }

  for (const e of consoleStore.entries) {
    if (e.parentId) continue;
    visit(e, 0);
  }

  return rows;
});

function rowClass(level: ConsoleEntryLevel): string {
  if (level === "error")
    return "bg-red-500/[0.07] border-l-2 border-red-500/60 hover:bg-red-500/[0.12]";
  if (level === "warn")
    return "bg-yellow-500/[0.07] border-l-2 border-yellow-500/60 hover:bg-yellow-500/[0.12]";
  return "border-l-2 border-transparent hover:bg-surface-2/40";
}

function textClass(level: ConsoleEntryLevel): string {
  if (level === "error") return "text-red-300";
  if (level === "warn") return "text-yellow-200";
  if (level === "info") return "text-sky-300";
  if (level === "debug") return "text-violet-300";
  return "text-foreground/85";
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
          class="h-6 border-0 bg-transparent px-0 font-mono text-[11px] focus-visible:ring-0"
          placeholder="Filter"
        />
      </div>

      <Button
        v-for="lvl in FILTER_LEVELS"
        :key="lvl"
        variant="ghost"
        size="sm"
        class="h-7 gap-1 rounded-md px-2 font-mono text-[10px]"
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
        class="ml-1 h-6 rounded-full border px-2 font-mono text-[10px]"
        :class="
          consoleStore.boundTargetId
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-border/40 bg-surface-3 text-muted-foreground'
        "
      >
        {{ consoleStore.boundTargetId ? "Live" : "Idle" }}
      </Badge>
    </div>

    <div
      v-if="consoleStore.error"
      class="flex shrink-0 items-center gap-2 border-b border-warning/20 bg-warning/8 px-3 py-1.5 text-[11px] text-warning"
    >
      <span class="font-mono">{{ consoleStore.error }}</span>
    </div>

    <div
      v-if="!consoleStore.boundTargetId"
      class="flex flex-1 items-center justify-center text-[12px] text-muted-foreground/45"
    >
      Connect target first.
    </div>

    <div
      v-else-if="visibleRows.length === 0"
      class="flex flex-1 items-center justify-center text-[12px] text-muted-foreground/45"
    >
      No console entries.
    </div>

    <ScrollArea v-else class="min-h-0 flex-1">
      <div class="font-mono text-[12px]">
        <div
          v-for="{ entry, depth } in visibleRows"
          :key="entry.id"
          class="group select-text"
          :class="rowClass(entry.level)"
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
              class="ml-2 shrink-0 truncate pt-px text-[11px] text-muted-foreground/45 hover:text-muted-foreground/80 max-w-[35%]"
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
