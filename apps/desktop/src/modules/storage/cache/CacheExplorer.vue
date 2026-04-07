<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  Archive,
  FileText,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  AlertCircle,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useCacheAPI } from "@/composables/useStorage";
import type { CacheEntry } from "utils";

const filter = ref("");
const selectedUrl = ref<string | null>(null);
const expandedCaches = ref<Set<string>>(new Set());

const { useCacheNames, useCacheEntries } = useCacheAPI();

const { data: cacheNames, isLoading: isLoadingNames, refetch: refetchNames } = useCacheNames();

const selectedCacheName = ref("");

const {
  data: cacheEntries,
  isLoading: isLoadingEntries,
  refetch: refetchEntries,
} = useCacheEntries(selectedCacheName);

const allEntries = computed<CacheEntry[]>(() => {
  if (!cacheEntries.value) return [];
  return cacheEntries.value;
});

const filtered = computed(() => {
  if (!filter.value) return allEntries.value;
  const q = filter.value.toLowerCase();
  return allEntries.value.filter(
    (e) => e.url.toLowerCase().includes(q) || e.method.toLowerCase().includes(q),
  );
});

const selectedEntry = computed(() => {
  if (!selectedUrl.value) return null;
  return allEntries.value.find((e) => e.url === selectedUrl.value) ?? null;
});

function selectCache(name: string) {
  selectedCacheName.value = name;
  if (!expandedCaches.value.has(name)) {
    expandedCaches.value.add(name);
  }
}

function toggleCache(name: string) {
  if (expandedCaches.value.has(name)) expandedCaches.value.delete(name);
  else expandedCaches.value.add(name);
}

function refetch() {
  void refetchNames();
  if (selectedCacheName.value) void refetchEntries();
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border/30">
          <div
            class="flex items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
          >
            <Search class="w-3 h-3 text-muted-foreground/50" />
            <Input
              v-model="filter"
              class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
              placeholder="Filter by URL or type…"
            />
          </div>
          <ScrollArea class="flex-1">
            <div v-if="isLoadingNames" class="flex items-center justify-center py-8">
              <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
            </div>

            <div
              v-else-if="!cacheNames?.length"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <AlertCircle :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-muted-foreground/40">No Cache API caches found</p>
            </div>

            <div v-else class="py-1">
              <ul>
                <li v-for="cacheName in cacheNames" :key="cacheName">
                  <button
                    class="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground/60 transition-colors hover:bg-surface-3/50 hover:text-muted-foreground"
                    @click="toggleCache(cacheName)"
                  >
                    <component
                      :is="expandedCaches.has(cacheName) ? ChevronDown : ChevronRight"
                      :size="12"
                      class="shrink-0 opacity-50"
                    />
                    <Archive :size="13" class="shrink-0 opacity-40" />
                    <span class="flex-1 truncate text-left">{{ cacheName }}</span>
                  </button>
                  <ul v-if="expandedCaches.has(cacheName)">
                    <li>
                      <button
                        class="flex w-full items-center py-1.5 pl-[26px] pr-3 text-xs transition-colors"
                        :class="
                          selectedCacheName === cacheName
                            ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground pl-[24px]'
                            : 'text-[#676767] hover:bg-surface-3/50 hover:text-[#888888]'
                        "
                        @click="selectCache(cacheName)"
                      >
                        <span class="truncate text-left">View entries</span>
                      </button>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />

      <ResizablePanel :default-size="85">
        <div class="flex flex-col h-full">
          <div
            v-if="!selectedCacheName"
            class="flex flex-1 items-center justify-center text-sm text-muted-foreground/30"
          >
            Select a cache from the sidebar
          </div>

          <template v-else>
            <div class="flex items-center gap-2 px-4 py-2 border-b border-border/30">
              <Archive :size="14" class="text-muted-foreground/40" />
              <span class="text-xs font-mono text-foreground/70">{{ selectedCacheName }}</span>
              <span class="text-xs text-muted-foreground/40"
                >({{ allEntries.length }} entries)</span
              >
              <div class="flex-1" />
              <Button variant="ghost" size="sm" class="h-6 text-xs" @click="refetch()">
                <RefreshCw :size="12" class="mr-1" />
                Refresh
              </Button>
            </div>

            <div class="flex-1 overflow-auto">
              <div v-if="isLoadingEntries" class="flex items-center justify-center py-8">
                <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
              </div>

              <table v-else class="w-full text-xs">
                <thead class="sticky top-0 z-10">
                  <tr
                    class="bg-surface-2 text-left text-muted-foreground/50 uppercase tracking-wider border-b border-border/30"
                  >
                    <th class="px-4 py-2.5 font-medium">URL</th>
                    <th class="px-4 py-2.5 font-medium w-24">Method</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in filtered"
                    :key="entry.url"
                    @click="selectedUrl = selectedUrl === entry.url ? null : entry.url"
                    class="border-b border-border/20 cursor-pointer transition-colors"
                    :class="selectedUrl === entry.url ? 'bg-surface-3' : 'data-row'"
                  >
                    <td
                      class="px-4 py-2.5 font-mono text-sm text-secondary-foreground truncate max-w-[500px]"
                    >
                      <div class="flex items-center gap-2">
                        <FileText class="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                        {{ entry.url }}
                      </div>
                    </td>
                    <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                      {{ entry.method }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
