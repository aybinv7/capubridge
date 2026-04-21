<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Download, Pause, Play, RefreshCw, Search, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDevicesStore } from "@/stores/devices.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { LogcatEntry } from "@/types/console.types";

const devicesStore = useDevicesStore();
const logcatStore = useLogcatStore();
const targetsStore = useTargetsStore();

const textFilter = ref("");
const tagFilter = ref("");
const packageFilter = ref("__all__");
const activeLevels = ref<LogcatEntry["level"][]>(["V", "D", "I", "W", "E", "F"]);

onMounted(() => {
  void logcatStore.initialize();
});

const selectedDevice = computed(() => devicesStore.selectedDevice);
const selectedTargetPackage = computed(() => targetsStore.selectedTarget?.packageName ?? null);
const packageOptions = computed(() => {
  const values = new Set<string>();

  if (selectedTargetPackage.value) {
    values.add(selectedTargetPackage.value);
  }

  for (const entry of logcatStore.entries) {
    if (entry.packageName) {
      values.add(entry.packageName);
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b));
});

const levelCounts = computed(() => ({
  V: logcatStore.entries.filter((entry) => entry.level === "V").length,
  D: logcatStore.entries.filter((entry) => entry.level === "D").length,
  I: logcatStore.entries.filter((entry) => entry.level === "I").length,
  W: logcatStore.entries.filter((entry) => entry.level === "W").length,
  E: logcatStore.entries.filter((entry) => entry.level === "E").length,
  F: logcatStore.entries.filter((entry) => entry.level === "F").length,
}));

const filteredEntries = computed(() => {
  const query = textFilter.value.trim().toLowerCase();
  const tag = tagFilter.value.trim().toLowerCase();
  const packageName = packageFilter.value === "__all__" ? "" : packageFilter.value;

  return logcatStore.entries.filter((entry) => {
    if (!activeLevels.value.includes(entry.level)) {
      return false;
    }

    if (tag && !entry.tag.toLowerCase().includes(tag)) {
      return false;
    }

    if (packageName && entry.packageName !== packageName) {
      return false;
    }

    if (!query) {
      return true;
    }

    const message = [entry.packageName, entry.processName, entry.tag, entry.message, entry.raw]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return message.includes(query);
  });
});

function toggleLevel(level: LogcatEntry["level"]) {
  activeLevels.value = activeLevels.value.includes(level)
    ? activeLevels.value.filter((item) => item !== level)
    : [...activeLevels.value, level];
}

function levelBadgeClass(level: LogcatEntry["level"]) {
  if (level === "E" || level === "F") {
    return "border-error/30 bg-error/10 text-error";
  }

  if (level === "W") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  if (level === "I") {
    return "border-success/30 bg-success/10 text-success";
  }

  if (level === "D") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-400";
  }

  return "border-border/40 bg-surface-3 text-muted-foreground";
}

function packageLabel(entry: LogcatEntry) {
  return entry.packageName ?? entry.processName ?? "system";
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const serial = selectedDevice.value?.serial ?? "device";
  const data = JSON.stringify(filteredEntries.value, null, 2);
  downloadFile(data, `logcat_${serial}.json`, "application/json");
}

function exportTxt() {
  const serial = selectedDevice.value?.serial ?? "device";
  const data = filteredEntries.value.map((entry) => entry.raw).join("\n");
  downloadFile(data, `logcat_${serial}.txt`, "text/plain");
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-0">
    <div class="border-b border-border/30 bg-surface-2">
      <div class="flex h-11 items-center gap-2 px-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-foreground">
            {{
              selectedDevice
                ? `${selectedDevice.model} · ${selectedDevice.serial}`
                : "No device selected"
            }}
          </div>
          <div class="text-[11px] text-muted-foreground/60">
            Android stream · {{ filteredEntries.length }} visible · {{ logcatStore.entries.length }}
            total
            <span v-if="logcatStore.pausedCount" class="text-warning">
              · {{ logcatStore.pausedCount }} buffered
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          class="h-6 rounded-full border px-2 font-mono text-[10px]"
          :class="
            logcatStore.error
              ? 'border-error/30 bg-error/10 text-error'
              : logcatStore.isPaused
                ? 'border-warning/30 bg-warning/10 text-warning'
                : logcatStore.isStreaming
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-border/40 bg-surface-3 text-muted-foreground'
          "
        >
          {{
            logcatStore.error
              ? "Error"
              : logcatStore.isPaused
                ? "Paused"
                : logcatStore.isStreaming
                  ? "Live"
                  : "Idle"
          }}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1.5 px-2 text-xs"
          @click="logcatStore.togglePaused()"
        >
          <Play v-if="logcatStore.isPaused" class="h-3.5 w-3.5" />
          <Pause v-else class="h-3.5 w-3.5" />
          {{ logcatStore.isPaused ? "Resume" : "Pause" }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1.5 px-2 text-xs"
          @click="void logcatStore.restart()"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          Restart
        </Button>
        <Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs" @click="exportJson()">
          <Download class="h-3.5 w-3.5" />
          JSON
        </Button>
        <Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs" @click="exportTxt()">
          <Download class="h-3.5 w-3.5" />
          TXT
        </Button>
        <Button variant="ghost" size="sm" class="h-7 w-7" @click="logcatStore.clear()">
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>

      <div class="flex h-10 items-center gap-2 border-t border-border/20 px-3">
        <div
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2"
        >
          <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
          <Input
            v-model="textFilter"
            class="h-7 border-0 bg-transparent px-0 font-mono text-xs focus-visible:ring-0"
            placeholder="Filter messages, stack traces, payloads…"
          />
        </div>
        <Input
          v-model="tagFilter"
          class="h-7 w-[150px] border-border/30 bg-surface-3 font-mono text-xs"
          placeholder="Tag"
        />
        <Select v-model:model-value="packageFilter">
          <SelectTrigger class="h-7 w-[220px] border-border/30 bg-surface-3 font-mono text-xs">
            <SelectValue placeholder="All packages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All packages</SelectItem>
            <SelectItem v-if="selectedTargetPackage" :value="selectedTargetPackage">
              {{ selectedTargetPackage }}
            </SelectItem>
            <SelectItem
              v-for="packageName in packageOptions.filter((item) => item !== selectedTargetPackage)"
              :key="packageName"
              :value="packageName"
            >
              {{ packageName }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex h-9 items-center gap-1 border-t border-border/20 px-3">
        <button
          v-for="level in ['V', 'D', 'I', 'W', 'E', 'F'] as LogcatEntry['level'][]"
          :key="level"
          class="inline-flex h-6 items-center gap-1 rounded-full border px-2 font-mono text-[10px] transition-colors"
          :class="
            activeLevels.includes(level)
              ? levelBadgeClass(level)
              : 'border-border/25 bg-surface-3 text-muted-foreground/45'
          "
          @click="toggleLevel(level)"
        >
          <span>{{ level }}</span>
          <span>{{ levelCounts[level] }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="logcatStore.error"
      class="flex shrink-0 items-start gap-2 border-b border-error/20 bg-error/8 px-3 py-2 text-xs text-error"
    >
      <span class="font-mono">{{ logcatStore.error }}</span>
    </div>

    <div
      v-if="!selectedDevice"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/45"
    >
      Select device first to start logcat.
    </div>

    <div
      v-else-if="filteredEntries.length === 0"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/45"
    >
      No log lines for current filters.
    </div>

    <ScrollArea v-else class="min-h-0 flex-1">
      <div class="font-mono text-[11px] leading-5">
        <div
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="grid grid-cols-[44px_84px_54px_160px_96px_minmax(0,1fr)] gap-2 border-b border-border/15 px-3 py-2 hover:bg-surface-2/60"
        >
          <div class="text-muted-foreground/65">{{ entry.level }}</div>
          <div class="text-muted-foreground/55">{{ entry.time }}</div>
          <div class="text-muted-foreground/55">{{ entry.pid ?? "—" }}</div>
          <div class="truncate text-cyan-300/85">{{ packageLabel(entry) }}</div>
          <div class="truncate text-sky-300/90">{{ entry.tag }}</div>
          <pre
            class="whitespace-pre-wrap break-words"
            :class="
              entry.level === 'E' || entry.level === 'F'
                ? 'text-error'
                : entry.level === 'W'
                  ? 'text-warning'
                  : entry.level === 'I'
                    ? 'text-success'
                    : 'text-foreground/85'
            "
            >{{ entry.message }}</pre
          >
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
