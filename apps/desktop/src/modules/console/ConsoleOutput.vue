<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Copy, RefreshCw, Search, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConsoleStore } from "@/stores/console.store";
import type { ConsoleEntryLevel } from "@/types/console.types";

const consoleStore = useConsoleStore();

const searchQuery = ref("");
const activeLevel = ref<ConsoleEntryLevel | "all">("all");

onMounted(() => {
  void consoleStore.initialize();
});

const levelCounts = computed(() => ({
  all: consoleStore.entries.length,
  error: consoleStore.entries.filter((entry) => entry.level === "error").length,
  warn: consoleStore.entries.filter((entry) => entry.level === "warn").length,
  info: consoleStore.entries.filter((entry) => entry.level === "info").length,
  log: consoleStore.entries.filter((entry) => entry.level === "log").length,
  debug: consoleStore.entries.filter((entry) => entry.level === "debug").length,
}));

const filteredEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return consoleStore.entries.filter((entry) => {
    if (activeLevel.value !== "all" && entry.level !== activeLevel.value) {
      return false;
    }

    if (!query) {
      return true;
    }

    return `${entry.source} ${entry.message}`.toLowerCase().includes(query);
  });
});

function levelClass(level: ConsoleEntryLevel) {
  if (level === "error") {
    return "text-error";
  }

  if (level === "warn") {
    return "text-warning";
  }

  if (level === "info") {
    return "text-success";
  }

  if (level === "debug") {
    return "text-sky-300";
  }

  return "text-foreground/85";
}

async function copyEntry(message: string) {
  try {
    await navigator.clipboard.writeText(message);
  } catch {}
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-0">
    <div class="border-b border-border/30 bg-surface-2">
      <div class="flex h-11 items-center gap-2 px-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">Console</div>
          <div class="text-[11px] text-muted-foreground/60">
            {{ consoleStore.activeTargetLabel }} · {{ filteredEntries.length }} visible ·
            {{ consoleStore.entries.length }} total
          </div>
        </div>
        <Badge
          variant="outline"
          class="h-6 rounded-full border px-2 font-mono text-[10px]"
          :class="
            consoleStore.boundTargetId
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border/40 bg-surface-3 text-muted-foreground'
          "
        >
          {{ consoleStore.boundTargetId ? "Attached" : "Waiting" }}
        </Badge>
        <Button variant="ghost" size="sm" class="h-7 w-7" @click="consoleStore.clearConsole()">
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>

      <div class="flex h-10 items-center gap-2 border-t border-border/20 px-3">
        <div
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2"
        >
          <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
          <Input
            v-model="searchQuery"
            class="h-7 border-0 bg-transparent px-0 font-mono text-xs focus-visible:ring-0"
            placeholder="Filter console output…"
          />
        </div>
        <Button
          v-for="level in ['all', 'error', 'warn', 'info', 'log', 'debug'] as const"
          :key="level"
          variant="ghost"
          size="sm"
          class="h-7 gap-1 rounded-full px-2 font-mono text-[10px]"
          :class="
            activeLevel === level
              ? 'bg-surface-1 text-foreground'
              : 'text-muted-foreground/55 hover:text-foreground'
          "
          @click="activeLevel = level"
        >
          <span>{{ level }}</span>
          <span>{{ levelCounts[level] }}</span>
        </Button>
      </div>
    </div>

    <div
      v-if="consoleStore.error"
      class="flex shrink-0 items-center gap-2 border-b border-warning/20 bg-warning/8 px-3 py-2 text-xs text-warning"
    >
      <RefreshCw class="h-3.5 w-3.5" />
      <span class="font-mono">{{ consoleStore.error }}</span>
    </div>

    <div
      v-if="!consoleStore.boundTargetId"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/45"
    >
      Connect target first to stream console events.
    </div>

    <div
      v-else-if="filteredEntries.length === 0"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/45"
    >
      No console entries for current filters.
    </div>

    <ScrollArea v-else class="min-h-0 flex-1">
      <div class="font-mono text-[11px] leading-5">
        <div
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="group grid grid-cols-[76px_84px_140px_minmax(0,1fr)_28px] gap-2 border-b border-border/15 px-3 py-2 hover:bg-surface-2/60"
        >
          <div class="text-muted-foreground/65">{{ entry.timestampLabel }}</div>
          <div class="uppercase text-muted-foreground/55">{{ entry.level }}</div>
          <div class="truncate text-muted-foreground/70">{{ entry.source }}</div>
          <pre class="whitespace-pre-wrap break-words" :class="levelClass(entry.level)">{{
            entry.message
          }}</pre>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            @click="void copyEntry(entry.message)"
          >
            <Copy class="h-3 w-3" />
          </Button>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
