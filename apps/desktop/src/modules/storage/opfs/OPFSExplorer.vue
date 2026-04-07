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
  RefreshCw,
  AlertCircle,
} from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useOPFS } from "@/composables/useStorage";
import type { OPFSEntry } from "utils";

const filter = ref("");
const selectedFile = ref<string | null>(null);
const currentPath = ref("");

const { useDirectory, getDomain } = useOPFS();

const { data: entries, isLoading, isError, refetch } = useDirectory(currentPath);

const filtered = computed(() => {
  if (!entries.value) return [];
  if (!filter.value) return entries.value;
  const q = filter.value.toLowerCase();
  return entries.value.filter(
    (e) => e.name.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q),
  );
});

const selectedEntry = computed(() => {
  if (!selectedFile.value || !entries.value) return null;
  return entries.value.find((e) => e.name === selectedFile.value) ?? null;
});

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function getFileIcon(entry: OPFSEntry) {
  if (entry.kind === "directory") return FolderOpen;
  if (entry.name.endsWith(".json") || entry.name.endsWith(".sqlite") || entry.name.endsWith(".db"))
    return Database;
  return FileText;
}

function navigateTo(name: string, kind: string) {
  if (kind === "directory") {
    currentPath.value = currentPath.value ? `${currentPath.value}/${name}` : name;
    selectedFile.value = null;
  } else {
    selectedFile.value = name;
  }
}

function goBack() {
  const parts = currentPath.value.split("/");
  parts.pop();
  currentPath.value = parts.join("/");
  selectedFile.value = null;
}

async function deleteEntry(name: string) {
  const path = currentPath.value ? `${currentPath.value}/${name}` : name;
  await getDomain().deleteEntry(path);
  void refetch();
  if (selectedFile.value === name) selectedFile.value = null;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col">
          <div
            class="flex items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
          >
            <Search class="w-3 h-3 text-muted-foreground/50" />
            <Input
              v-model="filter"
              class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
              placeholder="Filter files…"
            />
          </div>
          <ScrollArea class="flex-1">
            <div v-if="isLoading" class="flex items-center justify-center py-8">
              <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
            </div>

            <div
              v-else-if="isError || !entries?.length"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <HardDrive :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-muted-foreground/40">
                {{ isError ? "Failed to load" : "No OPFS files" }}
              </p>
            </div>

            <div v-else class="py-1">
              <button
                v-for="entry in filtered"
                :key="entry.name"
                @click="navigateTo(entry.name, entry.kind)"
                class="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors rounded-r-lg mr-1"
                :class="
                  selectedFile === entry.name
                    ? 'text-foreground font-medium bg-surface-3'
                    : 'text-muted-foreground/50 hover:bg-surface-3/50 hover:text-muted-foreground'
                "
              >
                <component :is="getFileIcon(entry)" class="w-3.5 h-3.5 shrink-0 opacity-40" />
                <span class="truncate text-left font-mono text-xs">{{ entry.name }}</span>
                <span class="ml-auto text-[10px] font-mono shrink-0 text-muted-foreground/20">{{
                  formatSize(entry.size)
                }}</span>
              </button>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />

      <ResizablePanel :default-size="85">
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
                @click="navigateTo(entry.name, entry.kind)"
                class="border-b border-border/20 cursor-pointer transition-colors group"
                :class="selectedFile === entry.name ? 'bg-surface-3' : 'data-row'"
              >
                <td class="px-4 py-2.5 font-mono text-sm text-secondary-foreground">
                  <div class="flex items-center gap-2.5">
                    <component
                      :is="getFileIcon(entry)"
                      class="w-4 h-4 text-muted-foreground/30 shrink-0"
                    />
                    {{ entry.name }}
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    class="text-xs font-mono px-2 py-0.5 rounded bg-surface-3 border border-border/30 text-muted-foreground/60"
                    >{{ entry.kind }}</span
                  >
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                  {{ formatSize(entry.size) }}
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">
                  {{ formatDate(entry.lastModified) }}
                </td>
                <td class="px-4 py-2.5">
                  <div
                    v-if="entry.kind === 'file'"
                    class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
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
                      @click.stop="deleteEntry(entry.name)"
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
