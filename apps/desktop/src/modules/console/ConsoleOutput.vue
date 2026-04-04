<script setup lang="ts">
import { ref, computed } from "vue";
import { Search, Trash2, Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consoleMessages } from "@/data/mock-data";

const filter = ref("");
const levelFilter = ref("all");

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
  debug: {
    border: "",
    text: "text-muted-foreground",
    bg: "",
    badge: "bg-secondary text-muted-foreground",
  },
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
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="h-8 border-b border-border bg-accent flex items-center px-3 gap-2 shrink-0">
      <div class="flex items-center gap-0.5">
        <Button
          v-for="[level, count] in Object.entries(levelCounts) as [string, number][]"
          :key="level"
          :variant="levelFilter === level ? 'secondary' : 'ghost'"
          size="sm"
          class="h-6 px-2 text-2xs gap-1"
          @click="levelFilter = level"
        >
          <span class="capitalize">{{ level }}</span>
          <span
            class="text-2xs font-mono"
            :class="
              level === 'error'
                ? 'text-error'
                : level === 'warn'
                  ? 'text-warning'
                  : 'text-muted-foreground'
            "
            >{{ count }}</span
          >
        </Button>
      </div>
      <div class="flex-1" />
      <Button variant="ghost" size="icon-sm">
        <Trash2 class="w-3.5 h-3.5" />
      </Button>
    </div>

    <div class="h-7 border-b border-border bg-accent flex items-center px-3 gap-2 shrink-0">
      <Search class="w-3 h-3 text-muted-foreground" />
      <Input
        v-model="filter"
        class="h-5 text-2xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
        placeholder="Filter output…"
      />
    </div>

    <div class="flex-1 overflow-y-auto font-mono text-2xs leading-[20px]">
      <div
        v-for="(msg, i) in filtered"
        :key="i"
        class="flex items-start gap-0 px-3 py-[3px] group hover:bg-accent transition-colors"
        :class="[levelStyles[msg.level]?.bg || '', levelStyles[msg.level]?.border || '']"
      >
        <span class="w-[72px] shrink-0 text-muted-foreground tabular-nums select-none">{{
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
          class="text-muted-foreground shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-2xs"
          >{{ msg.source }}</span
        >

        <Button
          variant="ghost"
          size="icon-sm"
          class="ml-1 w-4 h-4 opacity-0 group-hover:opacity-100"
        >
          <Copy class="w-2.5 h-2.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
