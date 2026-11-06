<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { refDebounced } from "@vueuse/core";
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
import { formatLogcatLine } from "@/lib/logcat/logcatEntry";
import { compileLogcatFilter } from "@/lib/logcat/logcatFilter";
import { useRingView } from "@/composables/useRingView";
import { useScrollAreaVirtualizer } from "@/composables/useScrollAreaVirtualizer";
import type { LogcatEntry } from "@/types/logcat.types";

const devicesStore = useDevicesStore();
const logcatStore = useLogcatStore();
const targetsStore = useTargetsStore();

const textFilter = ref("");
const tagFilter = ref("");
const packageFilter = ref("__all__");
const activeLevels = ref<LogcatEntry["level"][]>(["V", "D", "I", "W", "E", "F"]);
const debouncedText = refDebounced(textFilter, 150);
const debouncedTag = refDebounced(tagFilter, 150);
const isPaused = toRef(logcatStore, "isPaused");

const selectedDevice = computed(() => devicesStore.selectedDevice);
const selectedTargetPackage = computed(() => targetsStore.selectedTarget?.packageName ?? null);
const packageOptions = computed(() => {
  const values = new Set(logcatStore.packages);
  if (selectedTargetPackage.value) {
    values.add(selectedTargetPackage.value);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
});

const levelCounts = computed(() => logcatStore.levelCounts);

const predicate = computed(() =>
  compileLogcatFilter({
    text: debouncedText.value,
    tag: debouncedTag.value,
    packageName: packageFilter.value === "__all__" ? null : packageFilter.value,
    levels: activeLevels.value,
  }),
);
const { rows: filteredEntries } = useRingView(logcatStore, predicate, { frozen: isPaused });
const {
  bindScrollArea,
  visible: virtualItems,
  totalSize,
  measure,
} = useScrollAreaVirtualizer(filteredEntries, {
  estimateSize: 37,
  itemKey: (entry) => entry.id,
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
    return "border-info/30 bg-info/10 text-info";
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
  const data = filteredEntries.value.map(formatLogcatLine).join("\n");
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
          <div class="text-2xs text-muted-foreground/60">
            Android stream · {{ filteredEntries.length }} visible · {{ logcatStore.size }}
            total
            <span v-if="logcatStore.pausedCount" class="text-warning">
              · {{ logcatStore.pausedCount }} new lines kept while paused
              <template v-if="logcatStore.pausedDropped">
                · the oldest {{ logcatStore.pausedDropped }} are no longer kept
              </template>
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          class="h-6 rounded-full border px-2 font-mono text-2xs"
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
          class="inline-flex h-6 items-center gap-1 rounded-full border px-2 font-mono text-2xs transition-colors"
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

    <ScrollArea v-else :ref="bindScrollArea" class="min-h-0 flex-1">
      <div class="relative font-mono text-2xs leading-5" :style="{ height: `${totalSize}px` }">
        <div
          v-for="item in virtualItems"
          :key="item.key"
          :ref="measure"
          :data-index="item.index"
          class="absolute top-0 left-0 grid w-full grid-cols-[44px_84px_54px_160px_96px_minmax(0,1fr)] gap-2 border-b border-border/15 px-3 py-2 hover:bg-surface-2/60"
          :style="{ transform: `translateY(${item.start}px)` }"
        >
          <div class="text-muted-foreground/65">{{ item.item.level }}</div>
          <div class="text-muted-foreground/55">{{ item.item.time }}</div>
          <div class="text-muted-foreground/55">{{ item.item.pid ?? "—" }}</div>
          <div class="truncate text-cyan-300/85">{{ packageLabel(item.item) }}</div>
          <div class="truncate text-info/90">{{ item.item.tag }}</div>
          <pre
            class="whitespace-pre-wrap break-words"
            :class="
              item.item.level === 'E' || item.item.level === 'F'
                ? 'text-error'
                : item.item.level === 'W'
                  ? 'text-warning'
                  : item.item.level === 'I'
                    ? 'text-success'
                    : 'text-foreground/85'
            "
            >{{ item.item.message }}</pre
          >
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
