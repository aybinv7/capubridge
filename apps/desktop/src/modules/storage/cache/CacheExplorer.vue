<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Search, Archive, FileText, Globe, ChevronRight, ChevronDown } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { mockCacheAPIOrigins, type MockCacheOrigin } from "@/data/mock-data";

const route = useRoute();
const router = useRouter();
const filter = ref("");
const selectedUrl = ref<string | null>(null);
const expandedCaches = ref<Set<string>>(new Set(["v1-static"]));

const selectedOrigin = computed<MockCacheOrigin | null>(() => {
  const origin = route.query.origin as string | undefined;
  if (!origin) return mockCacheAPIOrigins[0] ?? null;
  return mockCacheAPIOrigins.find((o) => o.origin === origin) ?? mockCacheAPIOrigins[0] ?? null;
});

const selectedEntry = computed(() => {
  if (!selectedUrl.value || !selectedOrigin.value) return null;
  for (const cache of selectedOrigin.value.caches) {
    const found = cache.entries.find((e) => e.url === selectedUrl.value);
    if (found) return { ...found, cacheName: cache.cacheName };
  }
  return null;
});

const allEntries = computed(() => {
  if (!selectedOrigin.value) return [];
  return selectedOrigin.value.caches.flatMap((c) =>
    c.entries.map((e) => ({ ...e, cacheName: c.cacheName })),
  );
});

const filtered = computed(() => {
  if (!filter.value) return allEntries.value;
  const q = filter.value.toLowerCase();
  return allEntries.value.filter(
    (e) => e.url.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
  );
});

function selectOrigin(origin: string) {
  router.push({ query: { origin } });
}

function toggleCache(name: string) {
  if (expandedCaches.value.has(name)) expandedCaches.value.delete(name);
  else expandedCaches.value.add(name);
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- Sidebar: origins + cache tree -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border/30">
          <div
            class="flex items-center gap-2 bg-surface-3 rounded-md px-2.5 py-1.5 border border-border/30 focus-within:border-border/60 transition-colors"
          >
            <Search class="w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              v-model="filter"
              class="h-6 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
              placeholder="Filter by URL or type…"
            />
          </div>
          <ScrollArea class="flex-1">
            <div class="py-1">
              <template v-if="selectedOrigin">
                <Button
                  v-for="origin in mockCacheAPIOrigins"
                  :key="origin.origin"
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start gap-2 px-3 py-2 h-auto text-xs"
                  :class="
                    selectedOrigin?.origin === origin.origin
                      ? 'text-foreground bg-surface-3 font-medium border-l-2 border-foreground pl-[10px]'
                      : 'text-muted-foreground/50 border-l-2 border-transparent pl-[10px] hover:bg-surface-3/50 hover:text-muted-foreground'
                  "
                  @click="selectOrigin(origin.origin)"
                >
                  <Globe :size="13" class="shrink-0 opacity-40" />
                  <span class="truncate text-left font-mono text-xs">{{ origin.origin }}</span>
                </Button>

                <!-- Cache tree for selected origin -->
                <div class="mt-2 pt-2 border-t border-border/30">
                  <ul>
                    <li v-for="cache in selectedOrigin.caches" :key="cache.cacheName">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="w-full justify-start gap-2 px-3 py-2 h-auto text-xs text-muted-foreground/60 hover:bg-surface-3/50 hover:text-muted-foreground"
                        @click="toggleCache(cache.cacheName)"
                      >
                        <component
                          :is="expandedCaches.has(cache.cacheName) ? ChevronDown : ChevronRight"
                          :size="12"
                          class="shrink-0 opacity-50"
                        />
                        <Archive :size="13" class="shrink-0 opacity-40" />
                        <span class="flex-1 truncate text-left">{{ cache.cacheName }}</span>
                        <span class="text-[10px] font-mono text-muted-foreground/30 shrink-0">{{
                          cache.entries.length
                        }}</span>
                      </Button>
                      <ul v-if="expandedCaches.has(cache.cacheName)">
                        <li v-for="entry in cache.entries" :key="entry.url">
                          <Button
                            variant="ghost"
                            size="sm"
                            class="w-full justify-start py-1.5 pl-[26px] pr-3 h-auto"
                            :class="
                              selectedUrl === entry.url
                                ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground pl-[24px]'
                                : 'text-muted-foreground/50 hover:bg-surface-3/50 hover:text-muted-foreground'
                            "
                            @click="selectedUrl = entry.url"
                          >
                            <span class="truncate text-left font-mono text-xs">{{
                              entry.url
                            }}</span>
                          </Button>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />

      <!-- Table -->
      <ResizablePanel :default-size="80">
        <div class="flex-1 overflow-auto h-full">
          <table class="w-full text-xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2 text-left text-muted-foreground/50 uppercase tracking-wider border-b border-border/30"
              >
                <th class="px-4 py-2.5 font-medium">URL</th>
                <th class="px-4 py-2.5 font-medium w-28">Cache</th>
                <th class="px-4 py-2.5 font-medium w-24">Type</th>
                <th class="px-4 py-2.5 font-medium w-24">Size</th>
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
                  class="px-4 py-2.5 font-mono text-sm text-secondary-foreground truncate max-w-[300px]"
                >
                  <div class="flex items-center gap-2">
                    <FileText class="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    {{ entry.url }}
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    class="text-xs font-mono px-2 py-0.5 rounded bg-surface-3 border border-border/30 text-muted-foreground/60"
                    >{{ entry.cacheName }}</span
                  >
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                  {{ entry.type }}
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                  {{ entry.size }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
