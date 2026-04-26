<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterView } from "vue-router";
import { BookMarked, Circle, Download, Search, Trash2, X } from "lucide-vue-next";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTargetsStore } from "@/stores/targets.store";
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { useNetwork } from "@/composables/useNetwork";
import { useMockServer } from "@/composables/useMockServer";
import type { NetworkTypeFilter } from "@/types/network.types";

const TYPE_FILTERS: NetworkTypeFilter[] = [
  "All",
  "XHR/Fetch",
  "WS",
  "Doc",
  "Img",
  "Media",
  "Font",
  "Script",
  "Preflight",
  "Other",
];

const HTTP_METHODS = ["All", "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

useNetwork();
useMockServer();

const store = useNetworkStore();
const targetsStore = useTargetsStore();
const hasTarget = computed(() => !!targetsStore.selectedTarget?.id);

const searchInputRef = ref<InstanceType<typeof Input> | null>(null);

// Focus search input when triggered from NetworkRequests Ctrl+F
watch(
  () => store.focusSearchTrigger,
  () => {
    const el = searchInputRef.value?.$el as HTMLInputElement | null;
    el?.focus();
    el?.select();
  },
);

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 10 || u === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />

    <!-- Toolbar -->
    <div
      class="flex h-10 shrink-0 items-center gap-1.5 border-b border-border/30 bg-surface-2 px-3"
    >
      <!-- Record indicator / toggle -->
      <button
        class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-surface-3"
        :title="store.isRecording ? 'Pause recording' : 'Resume recording'"
        @click="store.isRecording = !store.isRecording"
      >
        <span
          v-if="store.isRecording"
          class="h-[9px] w-[9px] rounded-full bg-red-500"
          :class="hasTarget ? 'animate-pulse' : 'opacity-40'"
        />
        <Circle v-else class="h-3.5 w-3.5 text-muted-foreground/50" />
      </button>

      <!-- Clear -->
      <button
        class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground/70"
        title="Clear log"
        @click="store.clear()"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>

      <div class="mx-0.5 h-4 w-px bg-border/30" />

      <!-- Search scope select -->
      <Select v-model="store.searchScope">
        <SelectTrigger
          class="h-7 gap-1 border-border/25 bg-surface-3 px-2 text-[11px] focus:ring-0 focus-visible:ring-0"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="url" class="text-xs">URL / Headers</SelectItem>
          <SelectItem value="all" class="text-xs">All (incl. bodies)</SelectItem>
        </SelectContent>
      </Select>

      <!-- Search -->
      <div
        class="flex max-w-[220px] flex-1 items-center gap-1.5 rounded border border-border/25 bg-surface-3 px-2 transition-colors focus-within:border-border/60"
      >
        <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <Input
          ref="searchInputRef"
          v-model="store.filterText"
          class="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0 placeholder:text-muted-foreground/35"
          placeholder="Filter…"
        />
        <button
          v-if="store.filterText"
          class="shrink-0 text-muted-foreground/40 hover:text-foreground/60"
          @click="store.filterText = ''"
        >
          <X class="h-3 w-3" />
        </button>
      </div>

      <!-- Type filters -->
      <div class="flex items-center gap-0.5">
        <button
          v-for="f in TYPE_FILTERS"
          :key="f"
          class="h-6 rounded px-2 text-[11px] transition-colors"
          :class="
            store.typeFilter === f
              ? 'bg-surface-3 font-medium text-foreground'
              : 'text-muted-foreground/55 hover:bg-surface-3/60 hover:text-foreground/70'
          "
          @click="store.typeFilter = f"
        >
          {{ f }}
        </button>
      </div>

      <div class="mx-0.5 h-4 w-px bg-border/30" />

      <!-- Method filter -->
      <Select v-model="store.methodFilter">
        <SelectTrigger
          class="h-7 gap-1 border-border/25 bg-surface-3 px-2 text-[11px] focus:ring-0 focus-visible:ring-0"
          size="sm"
        >
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="m in HTTP_METHODS" :key="m" :value="m" class="text-xs font-mono">
            {{ m }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex-1" />

      <!-- Preserve log -->
      <button
        class="flex h-6 items-center gap-1 rounded px-2 text-[11px] transition-colors"
        :class="
          store.preserveLog
            ? 'bg-surface-3 text-foreground'
            : 'text-muted-foreground/45 hover:bg-surface-3/60 hover:text-foreground/70'
        "
        title="Preserve log on navigation"
        @click="store.preserveLog = !store.preserveLog"
      >
        <BookMarked class="h-3 w-3" />
        Preserve
      </button>

      <!-- Export HAR -->
      <button
        class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground/70"
        title="Export as HAR"
      >
        <Download class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Stats bar -->
    <div
      v-if="hasTarget"
      class="flex h-6 shrink-0 items-center gap-3 border-b border-border/15 bg-surface-1 px-3 text-[10px] text-muted-foreground/45"
    >
      <span>{{ store.requestCount }} requests</span>
      <span>{{ formatBytes(store.transferredBytes) }} transferred</span>
      <template
        v-if="store.filterText || store.typeFilter !== 'All' || store.methodFilter !== 'All'"
      >
        <span class="text-muted-foreground/60">{{ store.filteredEntries.length }} shown</span>
      </template>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
