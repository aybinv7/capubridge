<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Search, Copy, Pencil, Trash2, Globe } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { mockLocalStorageOrigins, type MockLSOrigin } from "@/data/mock-data";

const route = useRoute();
const router = useRouter();
const filter = ref("");
const selectedKey = ref<string | null>(null);

const selectedOrigin = computed<MockLSOrigin | null>(() => {
  const origin = route.query.origin as string | undefined;
  if (!origin) return mockLocalStorageOrigins[0] ?? null;
  return (
    mockLocalStorageOrigins.find((o) => o.origin === origin) ?? mockLocalStorageOrigins[0] ?? null
  );
});

const selectedEntry = computed(
  () => selectedOrigin.value?.entries.find((e) => e.key === selectedKey.value) ?? null,
);

const filtered = computed(() => {
  if (!selectedOrigin.value) return [];
  if (!filter.value) return selectedOrigin.value.entries;
  const q = filter.value.toLowerCase();
  return selectedOrigin.value.entries.filter(
    (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
  );
});

function selectOrigin(origin: string) {
  router.push({ query: { origin } });
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- Origins sidebar -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border/30">
          <div
            class="flex items-center gap-2 bg-surface-3 rounded-md px-2.5 py-1.5 border border-border/30 focus-within:border-border/60 transition-colors"
          >
            <Search class="w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              v-model="filter"
              class="h-6 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
              placeholder="Filter keys or values…"
            />
          </div>
          <ScrollArea class="flex-1">
            <div class="py-1">
              <Button
                v-for="origin in mockLocalStorageOrigins"
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
                <span class="ml-auto text-[10px] font-mono text-muted-foreground/30 shrink-0">{{
                  origin.entries.length
                }}</span>
              </Button>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />

      <!-- Table -->
      <ResizablePanel :default-size="60">
        <div class="flex-1 overflow-auto h-full">
          <table class="w-full text-xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2 text-left text-muted-foreground/50 uppercase tracking-wider border-b border-border/30"
              >
                <th class="px-4 py-2.5 font-medium">Key</th>
                <th class="px-4 py-2.5 font-medium">Value</th>
                <th class="px-4 py-2.5 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filtered"
                :key="entry.key"
                @click="selectedKey = selectedKey === entry.key ? null : entry.key"
                class="border-b border-border/20 cursor-pointer transition-colors"
                :class="selectedKey === entry.key ? 'bg-surface-3' : 'data-row group'"
              >
                <td
                  class="px-4 py-2.5 font-mono text-sm text-info/70 whitespace-nowrap max-w-[200px] truncate"
                >
                  {{ entry.key }}
                </td>
                <td
                  class="px-4 py-2.5 font-mono text-sm text-secondary-foreground max-w-md truncate"
                >
                  {{ entry.value }}
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-muted-foreground/40 hover:text-muted-foreground h-7 w-7"
                    >
                      <Copy class="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-muted-foreground/40 hover:text-muted-foreground h-7 w-7"
                    >
                      <Pencil class="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-muted-foreground/40 hover:text-error h-7 w-7"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>

      <!-- Detail panel -->
      <ResizableHandle />
      <ResizablePanel :default-size="22" :min-size="20" :max-size="40">
        <div class="flex h-full flex-col border-l border-border/30 bg-surface-1">
          <template v-if="selectedEntry">
            <div
              class="h-11 flex items-center justify-between px-4 border-b border-border/30 shrink-0"
            >
              <span class="text-sm font-medium text-foreground">Entry Detail</span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground/50"
                @click="selectedKey = null"
              >
                ✕
              </Button>
            </div>
            <ScrollArea class="flex-1">
              <div class="p-5 space-y-4">
                <div>
                  <div class="text-xs text-muted-foreground/50 mb-1.5 uppercase tracking-wider">
                    Key
                  </div>
                  <div
                    class="text-sm font-mono text-info/70 break-all bg-surface-2 border border-border/30 rounded-lg px-3 py-2"
                  >
                    {{ selectedEntry.key }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground/50 mb-1.5 uppercase tracking-wider">
                    Value
                  </div>
                  <div
                    class="text-sm font-mono text-foreground break-all bg-surface-2 border border-border/30 rounded-lg px-3 py-2 whitespace-pre-wrap"
                  >
                    {{ selectedEntry.value }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground/50 mb-1.5 uppercase tracking-wider">
                    Size
                  </div>
                  <div
                    class="text-sm font-mono text-foreground bg-surface-2 border border-border/30 rounded-lg px-3 py-2"
                  >
                    {{ new Blob([selectedEntry.value]).size }} bytes
                  </div>
                </div>
              </div>
            </ScrollArea>
          </template>
          <template v-else>
            <div class="flex-1 flex items-center justify-center text-muted-foreground/30 text-xs">
              Select an entry to view details
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
