<script setup lang="ts">
import { ref, computed } from "vue";
import { Search, Trash2, Copy } from "lucide-vue-next";
import PanelHeader from "@/components/layout/PanelHeader.vue";
import { consoleMessages } from "@/data/mock-data";

const filter = ref("");
const levelFilter = ref("all");
const replInput = ref("");

const levelStyles: Record<string, { border: string; text: string; bg: string; badge: string }> = {
  log: { border: "", text: "text-secondary-foreground", bg: "", badge: "" },
  info: { border: "", text: "text-info", bg: "", badge: "bg-info/10 text-info" },
  warn: {
    border: "border-l-2 border-warning/30",
    text: "text-warning",
    bg: "bg-warning/[0.02]",
    badge: "bg-warning/10 text-warning",
  },
  error: {
    border: "border-l-2 border-error/40",
    text: "text-error",
    bg: "bg-error/[0.03]",
    badge: "bg-error/10 text-error",
  },
  debug: { border: "", text: "text-dimmed", bg: "", badge: "bg-surface-3 text-dimmed" },
};

const levelCounts = computed(() => ({
  all: consoleMessages.length,
  error: consoleMessages.filter((m) => m.level === "error").length,
  warn: consoleMessages.filter((m) => m.level === "warn").length,
  info: consoleMessages.filter((m) => m.level === "info" || m.level === "log").length,
}));

const filtered = computed(() =>
  consoleMessages.filter((m) => {
    if (
      levelFilter.value !== "all" &&
      m.level !== levelFilter.value &&
      !(levelFilter.value === "info" && m.level === "log")
    )
      return false;
    if (filter.value && !m.message.toLowerCase().includes(filter.value.toLowerCase())) return false;
    return true;
  }),
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PanelHeader title="Console" subtitle="JS Runtime" />

    <!-- Level filter toolbar -->
    <div class="h-10 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2 shrink-0">
      <div class="flex items-center gap-0.5">
        <button
          v-for="[level, count] in Object.entries(levelCounts) as [string, number][]"
          :key="level"
          @click="levelFilter = level"
          class="px-2 py-1 text-2xs rounded-md transition-colors flex items-center gap-1"
          :class="
            levelFilter === level
              ? 'bg-surface-3 text-foreground'
              : 'text-muted-foreground hover:text-secondary-foreground'
          "
        >
          <span class="capitalize">{{ level }}</span>
          <span
            class="text-2xs font-mono"
            :class="
              level === 'error' ? 'text-error' : level === 'warn' ? 'text-warning' : 'text-dimmed'
            "
            >{{ count }}</span
          >
        </button>
      </div>

      <div class="flex-1" />

      <button
        class="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Filter bar -->
    <div
      class="h-8 border-b border-border/[0.15] bg-surface-2/30 flex items-center px-3 gap-2 shrink-0"
    >
      <Search class="w-3 h-3 text-dimmed" />
      <input
        v-model="filter"
        class="bg-transparent text-2xs text-foreground flex-1 outline-none placeholder:text-dimmed font-mono"
        placeholder="Filter output…"
      />
    </div>

    <!-- Messages -->
    <div class="flex-1 overflow-y-auto font-mono text-2xs leading-[20px]">
      <div
        v-for="(msg, i) in filtered"
        :key="i"
        class="flex items-start gap-0 px-3 py-[3px] group hover:bg-surface-2/30 transition-colors"
        :class="[levelStyles[msg.level]?.bg || '', levelStyles[msg.level]?.border || '']"
      >
        <span class="w-[72px] shrink-0 text-dimmed tabular-nums select-none">{{
          msg.timestamp
        }}</span>

        <span
          v-if="msg.level !== 'log'"
          class="shrink-0 px-1 py-[1px] rounded text-2xs font-medium mr-2"
          :class="levelStyles[msg.level]?.badge || ''"
          >{{ msg.level }}</span
        >

        <span
          class="flex-1 whitespace-pre-wrap break-all"
          :class="levelStyles[msg.level]?.text || 'text-secondary-foreground'"
          >{{ msg.message }}</span
        >

        <span
          v-if="msg.source"
          class="text-dimmed shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-2xs"
          >{{ msg.source }}</span
        >

        <button
          class="ml-1 p-0.5 rounded text-dimmed opacity-0 group-hover:opacity-100 hover:text-muted-foreground transition-all"
        >
          <Copy class="w-2.5 h-2.5" />
        </button>
      </div>
    </div>

    <!-- REPL input -->
    <div
      class="h-9 border-t border-border/20 bg-surface-2/30 flex items-center px-3 shrink-0 gap-2"
    >
      <span class="text-primary text-xs font-mono font-bold select-none">›</span>
      <input
        v-model="replInput"
        class="bg-transparent text-xs font-mono text-foreground flex-1 outline-none placeholder:text-dimmed"
        placeholder="Evaluate expression…"
      />
      <kbd class="text-2xs text-dimmed bg-surface-3 px-1.5 py-0.5 rounded border border-border/30"
        >⏎</kbd
      >
    </div>
  </div>
</template>
