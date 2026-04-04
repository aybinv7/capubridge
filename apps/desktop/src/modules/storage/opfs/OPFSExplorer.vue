<script setup lang="ts">
import { ref, computed } from "vue";
import {
  FolderOpen,
  FileText,
  Database,
  HardDrive,
  Search,
  Download,
  Trash2,
} from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { mockOPFSEntries } from "@/data/mock-data";

const filter = ref("");
const selectedFile = ref<string | null>(null);

const selectedEntry = computed(() => mockOPFSEntries.find((e) => e.name === selectedFile.value));

const filtered = computed(() => {
  if (!filter.value) return mockOPFSEntries;
  const q = filter.value.toLowerCase();
  return mockOPFSEntries.filter(
    (e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
  );
});

function getFileIcon(type: string) {
  if (type === "database") return Database;
  if (type === "directory") return FolderOpen;
  return FileText;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- Sidebar -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border/30">
          <div
            class="flex items-center gap-2 bg-surface-3 rounded-md px-2.5 py-1.5 border border-border/30 focus-within:border-border/60 transition-colors"
          >
            <Search class="w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              v-model="filter"
              class="h-6 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
              placeholder="Filter files…"
            />
          </div>
          <ScrollArea class="flex-1">
            <div class="py-1">
              <button
                v-for="entry in filtered"
                :key="entry.name"
                @click="selectedFile = selectedFile === entry.name ? null : entry.name"
                class="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors rounded-r-lg mr-1"
                :class="
                  selectedFile === entry.name
                    ? 'text-foreground font-medium bg-surface-3'
                    : 'text-muted-foreground/50 hover:bg-surface-3/50 hover:text-muted-foreground'
                "
              >
                <component :is="getFileIcon(entry.type)" class="w-3.5 h-3.5 shrink-0 opacity-40" />
                <span class="truncate text-left font-mono text-xs">{{ entry.name }}</span>
                <span
                  class="ml-auto text-[10px] font-mono shrink-0"
                  :class="
                    selectedFile === entry.name
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground/20'
                  "
                  >{{ entry.size }}</span
                >
              </button>
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
                <th class="px-4 py-2.5 font-medium">Name</th>
                <th class="px-4 py-2.5 font-medium w-28">Type</th>
                <th class="px-4 py-2.5 font-medium w-28">Size</th>
                <th class="px-4 py-2.5 font-medium w-44">Modified</th>
                <th class="px-4 py-2.5 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filtered"
                :key="entry.name"
                @click="selectedFile = selectedFile === entry.name ? null : entry.name"
                class="border-b border-border/20 cursor-pointer transition-colors group"
                :class="selectedFile === entry.name ? 'bg-surface-3' : 'data-row'"
              >
                <td class="px-4 py-2.5 font-mono text-sm text-secondary-foreground">
                  <div class="flex items-center gap-2.5">
                    <component
                      :is="getFileIcon(entry.type)"
                      class="w-4 h-4 text-muted-foreground/30 shrink-0"
                    />
                    {{ entry.name }}
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    class="text-xs font-mono px-2 py-0.5 rounded bg-surface-3 border border-border/30 text-muted-foreground/60"
                    >{{ entry.type }}</span
                  >
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                  {{ entry.size }}
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                  {{ entry.modified }}
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Download"
                      class="text-muted-foreground/40 hover:text-foreground h-7 w-7"
                    >
                      <Download class="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete"
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
    </ResizablePanelGroup>
  </div>
</template>
