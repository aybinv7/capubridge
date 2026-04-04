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
  E: "bg-error/[0.03]",
  W: "bg-warning/[0.03]",
  F: "bg-error/[0.06]",
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
    <div class="border-b border-border bg-accent shrink-0">
      <div class="flex items-center px-3 gap-2 h-8">
        <Search class="w-3 h-3 text-muted-foreground shrink-0" />
        <Input
          v-model="logFilter"
          class="h-6 text-2xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
          placeholder="Filter messages…"
        />
        <div class="w-px h-3 bg-border" />
        <div class="flex gap-0.5">
          <Button
            v-for="lvl in ['V', 'D', 'I', 'W', 'E']"
            :key="lvl"
            :variant="activeLevels.has(lvl) ? 'secondary' : 'ghost'"
            size="icon-sm"
            class="w-5 h-5 text-2xs font-mono"
            :class="activeLevels.has(lvl) ? logLevelColor[lvl] : 'text-muted-foreground'"
            @click="toggleLevel(lvl)"
          >
            {{ lvl }}
          </Button>
        </div>
      </div>
      <div class="flex items-center px-3 gap-2 h-7 border-t border-border">
        <span class="text-2xs text-muted-foreground font-mono w-8">tag</span>
        <Input
          v-model="logTag"
          class="h-5 w-32 text-2xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
          placeholder="Capacitor…"
        />
        <span class="ml-auto text-2xs text-muted-foreground font-mono"
          >{{ filteredLogs.length }} lines</span
        >
      </div>
    </div>

    <div class="flex-1 overflow-y-auto bg-background font-mono text-2xs leading-[18px]">
      <div
        v-for="(msg, i) in filteredLogs"
        :key="i"
        class="flex gap-0 px-3 py-[3px] data-row"
        :class="logLevelBg[msg.level] || ''"
      >
        <span class="w-3 shrink-0 font-bold" :class="logLevelColor[msg.level]">{{
          msg.level
        }}</span>
        <span class="w-24 shrink-0 text-muted-foreground truncate px-2">{{ msg.tag }}</span>
        <span class="w-10 shrink-0 text-muted-foreground text-right pr-3">{{ msg.pid }}</span>
        <span
          class="flex-1"
          :class="msg.level === 'E' ? 'text-error' : 'text-secondary-foreground'"
          >{{ msg.message }}</span
        >
      </div>
    </div>
  </div>
</template>
