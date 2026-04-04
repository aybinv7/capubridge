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
    <!-- Toolbar -->
    <div class="h-8 shrink-0 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2">
      <div
        class="flex items-center gap-1 bg-surface-2/60 rounded-md px-2 py-0.5 max-w-xs border border-border/20 focus-within:border-primary/20 transition-colors"
      >
        <Search class="w-3 h-3 text-dimmed" />
        <Input
          v-model="filter"
          class="h-5 text-3xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-dimmed"
          placeholder="Filter by URL or type…"
        />
      </div>
      <span class="text-3xs text-muted-foreground/40 font-mono">{{ filtered.length }} entries</span>
    </div>

    <!-- Resizable panels: sidebar | table -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- Sidebar: origins + cache tree -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border">
          <div class="flex h-7 shrink-0 items-center border-b border-border/50 px-3">
            <span
              class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40"
            >
              Origins
            </span>
          </div>
          <ScrollArea class="flex-1">
            <div class="py-1">
              <template v-if="selectedOrigin">
                <Button
                  v-for="origin in mockCacheAPIOrigins"
                  :key="origin.origin"
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start gap-2 px-3 py-[6px] h-auto text-[12px]"
                  :class="
                    selectedOrigin?.origin === origin.origin
                      ? 'text-primary bg-primary/10 font-medium border-l-2 border-primary pl-[10px]'
                      : 'text-muted-foreground/60 border-l-2 border-transparent pl-[10px]'
                  "
                  @click="selectOrigin(origin.origin)"
                >
                  <Globe :size="12" class="shrink-0 opacity-50" />
                  <span class="truncate text-left font-mono text-[11px]">{{ origin.origin }}</span>
                </Button>

                <!-- Cache tree for selected origin -->
                <div class="mt-2 pt-2 border-t border-border/30">
                  <div class="px-3 pb-1">
                    <span
                      class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40"
                    >
                      Caches
                    </span>
                  </div>
                  <ul>
                    <li v-for="cache in selectedOrigin.caches" :key="cache.cacheName">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="w-full justify-start gap-1.5 px-3 py-[5px] h-auto text-[12px] text-muted-foreground"
                        @click="toggleCache(cache.cacheName)"
                      >
                        <component
                          :is="expandedCaches.has(cache.cacheName) ? ChevronDown : ChevronRight"
                          :size="11"
                          class="shrink-0 opacity-50"
                        />
                        <Archive :size="12" class="shrink-0 opacity-50" />
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
                            class="w-full justify-start py-[4px] pl-[26px] pr-3 h-auto text-[11px]"
                            :class="
                              selectedUrl === entry.url
                                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary pl-[24px]'
                                : 'text-muted-foreground/60'
                            "
                            @click="selectedUrl = entry.url"
                          >
                            <span class="truncate text-left font-mono text-[10px]">{{
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
          <table class="w-full text-2xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
              >
                <th class="px-3 py-2 font-medium">URL</th>
                <th class="px-3 py-2 font-medium w-24">Cache</th>
                <th class="px-3 py-2 font-medium w-20">Type</th>
                <th class="px-3 py-2 font-medium w-20">Size</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filtered"
                :key="entry.url"
                @click="selectedUrl = selectedUrl === entry.url ? null : entry.url"
                class="border-b border-border/10 cursor-pointer transition-colors"
                :class="selectedUrl === entry.url ? 'bg-primary/[0.04]' : 'data-row'"
              >
                <td
                  class="px-3 py-2 font-mono text-xs text-secondary-foreground truncate max-w-[300px]"
                >
                  <div class="flex items-center gap-1.5">
                    <FileText class="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    {{ entry.url }}
                  </div>
                </td>
                <td class="px-3 py-2">
                  <span
                    class="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground"
                    >{{ entry.cacheName }}</span
                  >
                </td>
                <td class="px-3 py-2 text-muted-foreground font-mono">{{ entry.type }}</td>
                <td class="px-3 py-2 text-muted-foreground font-mono">{{ entry.size }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
