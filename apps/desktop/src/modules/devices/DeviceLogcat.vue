<script setup lang="ts">
import { ref, computed } from "vue";
import { Search } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logcatMessages } from "@/data/mock-data";

const logFilter = ref("");
const logTag = ref("");
const activeLevels = ref(new Set(["V", "D", "I", "W", "E", "F"]));

const logLevelColor: Record<string, string> = {
  V: "text-muted-foreground",
  D: "text-secondary-foreground",
  I: "text-success",
  W: "text-warning",
  E: "text-error",
  F: "text-error font-bold",
};
const logLevelBg: Record<string, string> = {
  E: "bg-error/[0.04]",
  W: "bg-warning/[0.04]",
  F: "bg-error/[0.08]",
};

function toggleLevel(lvl: string) {
  if (activeLevels.value.has(lvl)) {
    activeLevels.value.delete(lvl);
  } else {
    activeLevels.value.add(lvl);
  }
}

const filteredLogs = computed(() =>
  logcatMessages.filter((m) => {
    if (!activeLevels.value.has(m.level)) return false;
    if (logTag.value && !m.tag.toLowerCase().includes(logTag.value.toLowerCase())) return false;
    if (logFilter.value && !m.message.toLowerCase().includes(logFilter.value.toLowerCase()))
      return false;
    return true;
  }),
);
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Filter bar -->
    <div class="border-b border-border/30 bg-surface-2 shrink-0">
      <div class="flex items-center px-4 gap-3 h-10">
        <div class="flex items-center gap-2 flex-1 max-w-sm">
          <Search class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            v-model="logFilter"
            class="h-7 text-sm font-mono bg-transparent border border-border/30 rounded-md px-2.5 placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-border/60"
            placeholder="Filter messages…"
          />
        </div>
        <div class="w-px h-4 bg-border/30" />
        <div class="flex gap-1">
          <Button
            v-for="lvl in ['V', 'D', 'I', 'W', 'E']"
            :key="lvl"
            :variant="activeLevels.has(lvl) ? 'secondary' : 'ghost'"
            size="sm"
            class="w-7 h-7 text-xs font-mono"
            :class="activeLevels.has(lvl) ? logLevelColor[lvl] : 'text-muted-foreground/40'"
            @click="toggleLevel(lvl)"
          >
            {{ lvl }}
          </Button>
        </div>
        <div class="flex-1" />
        <span class="text-xs text-muted-foreground/50 font-mono"
          >{{ filteredLogs.length }} lines</span
        >
      </div>
      <div class="flex items-center px-4 gap-2 h-8 border-t border-border/30">
        <span class="text-xs text-muted-foreground/50 font-mono w-10">tag</span>
        <Input
          v-model="logTag"
          class="h-6 w-40 text-xs font-mono bg-transparent border border-border/30 rounded-md px-2.5 placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-border/60"
          placeholder="Capacitor…"
        />
      </div>
    </div>

    <!-- Log output -->
    <div class="flex-1 overflow-y-auto bg-surface-1 font-mono text-xs leading-5">
      <div
        v-for="(msg, i) in filteredLogs"
        :key="i"
        class="flex gap-0 px-4 py-1 data-row"
        :class="logLevelBg[msg.level] || ''"
      >
        <span class="w-4 shrink-0 font-bold" :class="logLevelColor[msg.level]">{{
          msg.level
        }}</span>
        <span class="w-28 shrink-0 text-muted-foreground truncate px-2">{{ msg.tag }}</span>
        <span class="w-12 shrink-0 text-muted-foreground/50 text-right pr-3">{{ msg.pid }}</span>
        <span
          class="flex-1"
          :class="msg.level === 'E' ? 'text-error' : 'text-secondary-foreground'"
          >{{ msg.message }}</span
        >
      </div>
    </div>
  </div>
</template>
