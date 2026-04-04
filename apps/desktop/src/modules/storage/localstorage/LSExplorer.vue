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
    <!-- Toolbar -->
    <div class="h-8 shrink-0 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2">
      <div
        class="flex items-center gap-1 bg-surface-2/60 rounded-md px-2 py-0.5 max-w-xs border border-border/20 focus-within:border-primary/20 transition-colors"
      >
        <Search class="w-3 h-3 text-dimmed" />
        <Input
          v-model="filter"
          class="h-5 text-3xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-dimmed"
          placeholder="Filter keys or values…"
        />
      </div>
      <span class="text-3xs text-muted-foreground/40 font-mono">{{ filtered.length }} entries</span>
    </div>

    <!-- Resizable panels: origins | table | detail -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- Origins sidebar -->
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
              <Button
                v-for="origin in mockLocalStorageOrigins"
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
          <table class="w-full text-2xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
              >
                <th class="px-3 py-2 font-medium">Key</th>
                <th class="px-3 py-2 font-medium">Value</th>
                <th class="px-3 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filtered"
                :key="entry.key"
                @click="selectedKey = selectedKey === entry.key ? null : entry.key"
                class="border-b border-border/10 cursor-pointer transition-colors"
                :class="selectedKey === entry.key ? 'bg-primary/[0.04]' : 'data-row group'"
              >
                <td
                  class="px-3 py-2 font-mono text-xs text-info/70 whitespace-nowrap max-w-[200px] truncate"
                >
                  {{ entry.key }}
                </td>
                <td class="px-3 py-2 font-mono text-xs text-secondary-foreground max-w-md truncate">
                  {{ entry.value }}
                </td>
                <td class="px-3 py-2">
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-dimmed hover:text-muted-foreground"
                    >
                      <Copy class="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-dimmed hover:text-muted-foreground"
                    >
                      <Pencil class="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" class="text-dimmed hover:text-error">
                      <Trash2 class="w-3 h-3" />
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
      <ResizablePanel :default-size="25" :min-size="20" :max-size="40">
        <div class="flex h-full flex-col border-l border-border/30 bg-surface-1">
          <template v-if="selectedEntry">
            <div
              class="h-10 flex items-center justify-between px-3 border-b border-border/20 shrink-0"
            >
              <span class="text-xs font-medium text-foreground">Entry Detail</span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-dimmed"
                @click="selectedKey = null"
              >
                ✕
              </Button>
            </div>
            <ScrollArea class="flex-1">
              <div class="p-3 space-y-3">
                <div>
                  <div class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider">
                    Key
                  </div>
                  <div
                    class="text-xs font-mono text-info/70 break-all bg-surface-2/50 rounded-md px-2 py-1.5 border border-border/10"
                  >
                    {{ selectedEntry.key }}
                  </div>
                </div>
                <div>
                  <div class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider">
                    Value
                  </div>
                  <div
                    class="text-xs font-mono text-foreground break-all bg-surface-2/50 rounded-md px-2 py-1.5 border border-border/10 whitespace-pre-wrap"
                  >
                    {{ selectedEntry.value }}
                  </div>
                </div>
                <div>
                  <div class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider">
                    Size
                  </div>
                  <div
                    class="text-xs font-mono text-foreground bg-surface-2/50 rounded-md px-2 py-1.5 border border-border/10"
                  >
                    {{ new Blob([selectedEntry.value]).size }} bytes
                  </div>
                </div>
              </div>
            </ScrollArea>
          </template>
          <template v-else>
            <div class="flex-1 flex items-center justify-center text-dimmed text-2xs">
              Select an entry to view details
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
