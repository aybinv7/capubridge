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
  ChevronLeft,
  Layers,
  Boxes,
  Info,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useSqlSessionStore } from "@/stores/sqlSession.store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOPFS } from "@/composables/useStorage";
import {
  detectStorageTechs,
  type OPFSEntry,
  type StorageTechHint,
  type SahPoolDatabase,
} from "utils";
const filter = ref("");
const selectedFile = ref<string | null>(null);
const currentPath = ref("");
const view = ref<"raw" | "decoded">("raw");

const { useDirectory, useSahPoolDatabases, getDomain } = useOPFS();
const { data: entries, isLoading, isError, refetch } = useDirectory(currentPath);

const router = useRouter();
const sqlSessionStore = useSqlSessionStore();
const openingInExplorer = ref<string | null>(null);

async function openInExplorer(opts: { path: string; label: string; stripSahPool: boolean }) {
  openingInExplorer.value = opts.path;
  try {
    const bytes = await getDomain().readSqliteBytes(opts.path, {
      stripSahPoolHeader: opts.stripSahPool,
    });
    const session = await sqlSessionStore.startLocalSession(opts.label, bytes, {
      opfsPath: opts.path,
      stripSahPoolHeader: opts.stripSahPool,
    });
    await router.push(`/storage/sqlite/${encodeURIComponent(session.fileName)}`);
  } catch (err) {
    toast.error("Failed to open in SQL Explorer", { description: String(err) });
  } finally {
    openingInExplorer.value = null;
  }
}

const techHints = computed<StorageTechHint[]>(() =>
  entries.value ? detectStorageTechs(entries.value) : [],
);
const sahPoolHint = computed(() =>
  techHints.value.find((h) => h.id === "sqlite-wasm-sah-pool" && h.inspectable),
);
const isSahPoolHere = computed(() => !!sahPoolHint.value);

const sahPoolEnabled = computed(() => isSahPoolHere.value && view.value === "decoded");
const {
  data: sahPoolDbs,
  isLoading: sahPoolLoading,
  isError: sahPoolError,
} = useSahPoolDatabases(currentPath, sahPoolEnabled);

const filtered = computed<OPFSEntry[]>(() => {
  if (!entries.value) return [];
  if (!filter.value) return entries.value;
  const q = filter.value.toLowerCase();
  return entries.value.filter(
    (e) => e.name.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q),
  );
});

const filteredSahPool = computed<SahPoolDatabase[]>(() => {
  if (!sahPoolDbs.value) return [];
  if (!filter.value) return sahPoolDbs.value;
  const q = filter.value.toLowerCase();
  return sahPoolDbs.value.filter(
    (d) => d.logicalPath.toLowerCase().includes(q) || d.opaqueName.toLowerCase().includes(q),
  );
});

const breadcrumbs = computed(() => {
  if (!currentPath.value) return [];
  return currentPath.value.split("/").filter(Boolean);
});

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function entryBadge(
  entry: OPFSEntry,
): { label: string; tone: "sqlite" | "journal" | "opaque" | "neutral" } | null {
  if (entry.kind === "directory") return null;
  if (/\.(sqlite3?|db3?)$/i.test(entry.name)) return { label: "sqlite", tone: "sqlite" };
  if (/-journal$/i.test(entry.name)) return { label: "journal", tone: "journal" };
  if (/-wal$/i.test(entry.name)) return { label: "wal", tone: "journal" };
  if (/-shm$/i.test(entry.name)) return { label: "shm", tone: "journal" };
  if (
    isSahPoolHere.value &&
    sahPoolHint.value?.affectedEntries.includes(entry.name) &&
    (entry.size ?? 0) >= 4096
  ) {
    return { label: "sah-pool", tone: "opaque" };
  }
  return null;
}

function badgeClass(tone: "sqlite" | "journal" | "opaque" | "neutral"): string {
  if (tone === "sqlite") return "bg-info/10 text-info border-info/20";
  if (tone === "journal") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (tone === "opaque") return "bg-violet-500/10 text-violet-300 border-violet-500/20";
  return "bg-surface-3 text-muted-foreground/60 border-border/30";
}

function confidenceClass(c: StorageTechHint["confidence"]): string {
  if (c === "high") return "bg-success/10 text-success border-success/20";
  if (c === "medium") return "bg-info/10 text-info border-info/20";
  return "bg-surface-3 text-muted-foreground/60 border-border/30";
}

function getFileIcon(entry: OPFSEntry) {
  if (entry.kind === "directory") return FolderOpen;
  if (/\.(sqlite3?|db3?|json)$/i.test(entry.name)) return Database;
  return FileText;
}

function navigateEntry(entry: OPFSEntry) {
  if (entry.kind === "directory") {
    currentPath.value = currentPath.value ? `${currentPath.value}/${entry.name}` : entry.name;
    selectedFile.value = null;
    view.value = "raw";
    return;
  }
  if (/\.(sqlite3?|db3?)$/i.test(entry.name)) {
    const path = currentPath.value ? `${currentPath.value}/${entry.name}` : entry.name;
    void openInExplorer({ path, label: entry.name, stripSahPool: false });
    return;
  }
  selectedFile.value = entry.name;
}

function inspectSahPoolEntry(db: SahPoolDatabase) {
  void openInExplorer({
    path: db.opaquePath,
    label: db.logicalPath,
    stripSahPool: true,
  });
}

function goUp() {
  const parts = currentPath.value.split("/").filter(Boolean);
  parts.pop();
  currentPath.value = parts.join("/");
  selectedFile.value = null;
  view.value = "raw";
}

function goTo(index: number) {
  const parts = currentPath.value
    .split("/")
    .filter(Boolean)
    .slice(0, index + 1);
  currentPath.value = parts.join("/");
  selectedFile.value = null;
  view.value = "raw";
}

function goRoot() {
  currentPath.value = "";
  selectedFile.value = null;
  view.value = "raw";
}

async function deleteEntry(name: string) {
  const path = currentPath.value ? `${currentPath.value}/${name}` : name;
  await getDomain().deleteEntry(path);
  void refetch();
  if (selectedFile.value === name) selectedFile.value = null;
}
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="flex h-full flex-col overflow-hidden">
      <div
        class="flex shrink-0 items-center gap-2 border-b border-border/20 bg-surface-1/40 px-3 py-1.5"
      >
        <Button
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
          :disabled="!currentPath"
          @click="goUp"
        >
          <ChevronLeft :size="12" /> Up
        </Button>

        <div class="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50">
          <button class="hover:text-foreground transition-colors" @click="goRoot">opfs:/</button>
          <template v-for="(part, idx) in breadcrumbs" :key="idx">
            <span class="text-muted-foreground/25">/</span>
            <button class="hover:text-foreground transition-colors" @click="goTo(idx)">
              {{ part }}
            </button>
          </template>
        </div>

        <div class="ml-auto flex items-center gap-1">
          <Button
            v-if="isSahPoolHere"
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-[11px]"
            :class="view === 'raw' ? 'text-foreground bg-surface-3' : 'text-muted-foreground/60'"
            @click="view = 'raw'"
          >
            <Boxes :size="12" /> Raw files
          </Button>
          <Button
            v-if="isSahPoolHere"
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-[11px]"
            :class="
              view === 'decoded' ? 'text-foreground bg-surface-3' : 'text-muted-foreground/60'
            "
            @click="view = 'decoded'"
          >
            <Layers :size="12" /> Decoded DBs
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
            @click="void refetch()"
          >
            <RefreshCw :size="12" />
          </Button>
        </div>
      </div>

      <div
        v-if="techHints.length"
        class="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/20 bg-surface-0/60 px-3 py-2"
      >
        <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
          Detected
        </span>
        <Tooltip v-for="hint in techHints" :key="hint.id">
          <TooltipTrigger as-child>
            <span
              class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-mono cursor-default"
              :class="confidenceClass(hint.confidence)"
            >
              <Info :size="10" />
              {{ hint.label }}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-sm text-[11px]">
            <div class="space-y-1">
              <div class="font-medium">{{ hint.label }}</div>
              <div v-if="hint.packageName" class="font-mono text-muted-foreground/70">
                {{ hint.packageName }}
              </div>
              <p class="text-muted-foreground/80">{{ hint.description }}</p>
              <div v-if="hint.evidence.length" class="pt-1">
                <div class="text-[9px] uppercase tracking-wider text-muted-foreground/40">
                  Evidence
                </div>
                <ul class="list-inside list-disc text-muted-foreground/70">
                  <li v-for="ev in hint.evidence" :key="ev">{{ ev }}</li>
                </ul>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <ResizablePanelGroup direction="horizontal" class="flex-1">
        <ResizablePanel :default-size="22" :min-size="15" :max-size="40">
          <div class="flex h-full flex-col">
            <div
              class="m-2 flex items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2 py-1.5 focus-within:border-border/60 transition-colors"
            >
              <Search class="h-3 w-3 text-muted-foreground/50" />
              <Input
                v-model="filter"
                class="h-5 border-0 bg-transparent p-0 text-xs font-mono focus-visible:ring-0 placeholder:text-muted-foreground/40"
                placeholder="Filter…"
              />
            </div>

            <ScrollArea class="flex-1">
              <div v-if="isLoading" class="flex items-center justify-center py-8">
                <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
              </div>

              <div
                v-else-if="isError"
                class="flex flex-col items-center justify-center px-3 py-8 text-center"
              >
                <HardDrive :size="16" class="mb-2 text-muted-foreground/30" />
                <p class="text-[11px] text-muted-foreground/40">Failed to load OPFS</p>
              </div>

              <div
                v-else-if="!filtered.length"
                class="px-3 py-8 text-center text-[11px] text-muted-foreground/40"
              >
                Empty directory
              </div>

              <div v-else class="py-1">
                <button
                  v-for="entry in filtered"
                  :key="entry.name"
                  class="mr-1 flex w-full items-center gap-2 rounded-r-lg px-3 py-2 text-xs transition-colors"
                  :class="
                    selectedFile === entry.name
                      ? 'bg-surface-3 font-medium text-foreground'
                      : 'text-muted-foreground/60 hover:bg-surface-3/50 hover:text-muted-foreground'
                  "
                  @click="navigateEntry(entry)"
                >
                  <component :is="getFileIcon(entry)" class="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <span class="truncate text-left font-mono">{{ entry.name }}</span>
                  <span class="ml-auto text-[10px] font-mono text-muted-foreground/30">{{
                    formatSize(entry.size)
                  }}</span>
                </button>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle with-handle />

        <ResizablePanel :default-size="78">
          <div class="flex h-full flex-col overflow-hidden">
            <template v-if="view === 'decoded' && isSahPoolHere">
              <div v-if="sahPoolLoading" class="flex items-center justify-center py-12">
                <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
                <span class="ml-2 text-[11px] text-muted-foreground/50"
                  >Decoding SAH-Pool headers…</span
                >
              </div>

              <div
                v-else-if="sahPoolError"
                class="flex flex-col items-center justify-center px-3 py-12 text-center text-[11px] text-error/80"
              >
                Failed to decode SAH-Pool. The directory may not be in pool format.
              </div>

              <div
                v-else-if="!filteredSahPool.length"
                class="flex flex-col items-center justify-center px-3 py-12 text-center text-[11px] text-muted-foreground/50"
              >
                No live databases inside this pool (all slots empty).
              </div>

              <div v-else class="overflow-auto">
                <table class="w-full text-xs">
                  <thead class="sticky top-0 z-10">
                    <tr
                      class="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground/50 border-b border-border/30"
                    >
                      <th class="px-4 py-2.5 font-medium">Logical path</th>
                      <th class="w-40 px-4 py-2.5 font-medium">Opaque file</th>
                      <th class="w-24 px-4 py-2.5 font-medium">Data size</th>
                      <th class="w-20 px-4 py-2.5 font-medium">Flags</th>
                      <th class="w-44 px-4 py-2.5 font-medium">Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="db in filteredSahPool"
                      :key="db.opaqueName"
                      class="cursor-pointer border-b border-border/20 transition-colors data-row"
                      @click="inspectSahPoolEntry(db)"
                    >
                      <td class="px-4 py-2.5 font-mono text-sm text-secondary-foreground">
                        <div class="flex items-center gap-2.5">
                          <Database class="h-4 w-4 shrink-0 text-info/70" />
                          {{ db.logicalPath }}
                        </div>
                      </td>
                      <td class="px-4 py-2.5 font-mono text-muted-foreground/50">
                        {{ db.opaqueName }}
                      </td>
                      <td class="px-4 py-2.5 font-mono text-muted-foreground/70">
                        {{ formatSize(db.dataSize) }}
                      </td>
                      <td class="px-4 py-2.5 font-mono text-muted-foreground/50">
                        0x{{ db.flags.toString(16).padStart(8, "0") }}
                      </td>
                      <td class="px-4 py-2.5 font-mono text-muted-foreground/60">
                        {{ formatDate(db.lastModified) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <div v-else class="flex-1 overflow-auto">
              <table class="w-full text-xs">
                <thead class="sticky top-0 z-10">
                  <tr
                    class="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground/50 border-b border-border/30"
                  >
                    <th class="px-4 py-2.5 font-medium">Name</th>
                    <th class="w-32 px-4 py-2.5 font-medium">Type</th>
                    <th class="w-28 px-4 py-2.5 font-medium">Size</th>
                    <th class="w-44 px-4 py-2.5 font-medium">Modified</th>
                    <th class="w-24 px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in filtered"
                    :key="entry.name"
                    class="group cursor-pointer border-b border-border/20 transition-colors"
                    :class="selectedFile === entry.name ? 'bg-surface-3' : 'data-row'"
                    @click="navigateEntry(entry)"
                  >
                    <td class="px-4 py-2.5 font-mono text-sm text-secondary-foreground">
                      <div class="flex items-center gap-2.5">
                        <component
                          :is="getFileIcon(entry)"
                          class="h-4 w-4 shrink-0 text-muted-foreground/40"
                        />
                        <span class="truncate">{{ entry.name }}</span>
                        <Badge
                          v-if="entryBadge(entry)"
                          variant="outline"
                          class="ml-1 h-4 border px-1.5 text-[9px] font-mono uppercase tracking-wider"
                          :class="badgeClass(entryBadge(entry)!.tone)"
                        >
                          {{ entryBadge(entry)!.label }}
                        </Badge>
                      </div>
                    </td>
                    <td class="px-4 py-2.5">
                      <span
                        class="rounded border border-border/30 bg-surface-3 px-2 py-0.5 text-xs font-mono text-muted-foreground/60"
                      >
                        {{ entry.kind }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 font-mono text-muted-foreground/60">
                      {{ formatSize(entry.size) }}
                    </td>
                    <td class="px-4 py-2.5 font-mono text-muted-foreground/60">
                      {{ formatDate(entry.lastModified) }}
                    </td>
                    <td class="px-4 py-2.5">
                      <div
                        v-if="entry.kind === 'file'"
                        class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download"
                          class="h-7 w-7 text-muted-foreground/40 hover:text-foreground"
                        >
                          <Download class="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete"
                          class="h-7 w-7 text-muted-foreground/40 hover:text-error"
                          @click.stop="deleteEntry(entry.name)"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </TooltipProvider>
</template>
