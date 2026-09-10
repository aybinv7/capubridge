<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { invokeCommand } from "@/runtime/ipc/client";
import {
  FolderOpen,
  RefreshCw,
  Trash2,
  Search,
  Clock,
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  HardDrive,
  Smartphone,
  Globe,
  AlertCircle,
  Share2,
  ShieldCheck,
  FileWarning,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "vue-sonner";
import type {
  RecordingExportReport,
  RecordingSanitizeOptions,
} from "@/runtime/ipc/contracts/recording";

interface SessionListItem {
  sessionId: string;
  label: string;
  startedAt: number;
  duration: number;
  deviceSerial: string | null;
  targetUrl: string | null;
  filePath: string;
  fileSizeBytes: number;
  incomplete: boolean;
  missingTracks: string[];
}

interface RawSessionListItem {
  sessionId?: string;
  session_id?: string;
  label?: string;
  startedAt?: number;
  started_at?: number;
  duration?: number;
  deviceSerial?: string | null;
  device_serial?: string | null;
  targetUrl?: string | null;
  target_url?: string | null;
  filePath?: string;
  file_path?: string;
  fileSizeBytes?: number;
  file_size_bytes?: number;
  incomplete?: boolean;
  missingTracks?: string[];
  missing_tracks?: string[];
}

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [filePath: string];
  openFromDisk: [];
}>();

type SortKey = "startedAt" | "label" | "duration" | "fileSizeBytes";
type SortDir = "asc" | "desc";

const sessions = ref<SessionListItem[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const search = ref("");
const sortKey = ref<SortKey>("startedAt");
const sortDir = ref<SortDir>("desc");
const deletingId = ref<string | null>(null);
const exporting = ref(false);
const exportItem = ref<SessionListItem | null>(null);
const exportPreview = ref<RecordingExportReport | null>(null);
const exportDialogOpen = ref(false);
let previewRequest = 0;
const exportOptions = ref<RecordingSanitizeOptions>({
  redactUrls: true,
  redactBodies: true,
  redactDom: true,
});

async function refresh() {
  isLoading.value = true;
  error.value = null;
  try {
    const items = await invokeCommand("recording_list_sessions");
    sessions.value = items
      .map(normalizeSession)
      .filter((item): item is SessionListItem => item !== null);
  } catch (err) {
    error.value = String(err);
  } finally {
    isLoading.value = false;
  }
}

function normalizeSession(item: RawSessionListItem): SessionListItem | null {
  const filePath = item.filePath ?? item.file_path;
  const sessionId = item.sessionId ?? item.session_id;
  if (!filePath || !sessionId) return null;
  return {
    sessionId,
    label: item.label ?? "",
    startedAt: item.startedAt ?? item.started_at ?? 0,
    duration: item.duration ?? 0,
    deviceSerial: item.deviceSerial ?? item.device_serial ?? null,
    targetUrl: item.targetUrl ?? item.target_url ?? null,
    filePath,
    fileSizeBytes: item.fileSizeBytes ?? item.file_size_bytes ?? 0,
    incomplete: item.incomplete ?? false,
    missingTracks: item.missingTracks ?? item.missing_tracks ?? [],
  };
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void refresh();
  },
  { immediate: true },
);

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    // Sensible defaults: text ascending, dates/sizes descending.
    sortDir.value = key === "label" ? "asc" : "desc";
  }
}

const filtered = computed<SessionListItem[]>(() => {
  const q = search.value.trim().toLowerCase();
  const list = q
    ? sessions.value.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          (s.deviceSerial ?? "").toLowerCase().includes(q) ||
          (s.targetUrl ?? "").toLowerCase().includes(q),
      )
    : [...sessions.value];

  const dir = sortDir.value === "asc" ? 1 : -1;
  list.sort((a, b) => {
    const key = sortKey.value;
    if (key === "label") return a.label.localeCompare(b.label) * dir;
    return ((a[key] as number) - (b[key] as number)) * dir;
  });
  return list;
});

function selectSession(item: SessionListItem) {
  emit("select", item.filePath);
  emit("update:open", false);
}

async function deleteSession(item: SessionListItem, e: Event) {
  e.stopPropagation();
  if (!confirm(`Delete "${item.label || item.sessionId}"? This cannot be undone.`)) return;
  deletingId.value = item.sessionId;
  try {
    await invokeCommand("recording_delete_session", { sessionId: item.sessionId });
    sessions.value = sessions.value.filter((s) => s.sessionId !== item.sessionId);
    toast.success("Session deleted");
  } catch (err) {
    toast.error("Delete failed", { description: String(err) });
  } finally {
    deletingId.value = null;
  }
}

async function prepareExport(item: SessionListItem, e: Event) {
  e.stopPropagation();
  const request = ++previewRequest;
  exportItem.value = item;
  exporting.value = true;
  try {
    const preview = await invokeCommand("recording_export_preview", {
      sourcePath: item.filePath,
      options: exportOptions.value,
    });
    if (request !== previewRequest) return;
    exportPreview.value = preview;
    exportDialogOpen.value = true;
  } catch (err) {
    toast.error("Export preview failed", { description: String(err) });
  } finally {
    if (request === previewRequest) exporting.value = false;
  }
}

async function refreshExportPreview() {
  if (!exportItem.value) return;
  const request = ++previewRequest;
  exporting.value = true;
  try {
    const preview = await invokeCommand("recording_export_preview", {
      sourcePath: exportItem.value.filePath,
      options: exportOptions.value,
    });
    if (request === previewRequest) exportPreview.value = preview;
  } catch (err) {
    toast.error("Export preview failed", { description: String(err) });
  } finally {
    if (request === previewRequest) exporting.value = false;
  }
}

async function exportSession(raw: boolean) {
  const item = exportItem.value;
  if (!item) return;
  const suffix = raw ? "raw" : "shareable";
  const destination = await save({
    defaultPath: `${item.label || item.sessionId}-${suffix}.capu`,
    filters: [{ name: "Capubridge recording", extensions: ["capu"] }],
  });
  if (!destination) return;
  exporting.value = true;
  try {
    const report = await invokeCommand("recording_export_session", {
      sourcePath: item.filePath,
      destinationPath: destination,
      raw,
      options: exportOptions.value,
    });
    exportDialogOpen.value = false;
    toast.success(raw ? "Raw recording exported" : "Shareable recording exported", {
      description: raw
        ? "Raw export may contain credentials and personal data."
        : `${report.redactedHeaders + report.redactedBodies + report.redactedUrls} values redacted.`,
    });
  } catch (err) {
    toast.error("Export failed", { description: String(err) });
  } finally {
    exporting.value = false;
  }
}

function openFromDisk() {
  emit("openFromDisk");
  emit("update:open", false);
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function shortPath(p: string | null | undefined): string {
  if (!p) return "Unknown file";
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="w-8xl p-0 overflow-hidden">
      <DialogHeader class="px-5 pt-5 pb-3 border-b border-border/30">
        <DialogTitle class="flex items-center gap-2">
          <FolderOpen class="w-4 h-4 text-muted-foreground/70" />
          Open replay session
        </DialogTitle>
        <DialogDescription class="text-[11px] text-muted-foreground/60">
          Pick a recorded .capu session, or open one from disk.
        </DialogDescription>
      </DialogHeader>

      <!-- Toolbar -->
      <div class="flex items-center gap-2 px-5 py-2 border-b border-border/20 bg-surface-1/50">
        <div
          class="flex flex-1 items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2 py-1.5 focus-within:border-border/60 transition-colors"
        >
          <Search class="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <Input
            v-model="search"
            class="h-5 text-xs bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
            placeholder="Filter by label, device, URL…"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1 text-[11px]"
          :disabled="isLoading"
          @click="refresh"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoading }" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" class="h-7 gap-1 text-[11px]" @click="openFromDisk">
          <FolderOpen class="w-3 h-3" />
          Open from disk…
        </Button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-hidden min-h-0 max-h-[60vh]">
        <!-- Loading -->
        <div
          v-if="isLoading && sessions.length === 0"
          class="flex items-center justify-center gap-2 py-16 text-muted-foreground/50 text-xs"
        >
          <RefreshCw class="w-3.5 h-3.5 animate-spin" />
          Loading sessions…
        </div>

        <!-- Error -->
        <div
          v-else-if="error"
          class="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground/60 text-xs"
        >
          <AlertCircle class="w-5 h-5 text-error" />
          <p>{{ error }}</p>
          <Button variant="outline" size="sm" class="h-6 text-[11px]" @click="refresh">
            Try again
          </Button>
        </div>

        <!-- Empty -->
        <div
          v-else-if="filtered.length === 0"
          class="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground/40 text-xs"
        >
          <FolderOpen class="w-6 h-6" />
          <p v-if="search">No sessions match "{{ search }}"</p>
          <p v-else>No recorded sessions yet</p>
          <Button variant="outline" size="sm" class="h-6 text-[11px] mt-1" @click="openFromDisk">
            <FolderOpen class="w-3 h-3 mr-1" />
            Open from disk
          </Button>
        </div>

        <!-- List -->
        <div v-else class="overflow-auto h-full">
          <table class="w-full text-xs">
            <thead
              class="sticky top-0 z-10 bg-surface-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground/50 border-b border-border/30"
            >
              <tr>
                <th class="px-4 py-2 font-medium cursor-pointer" @click="toggleSort('label')">
                  <span class="inline-flex items-center gap-1">
                    Label
                    <component
                      v-if="sortKey === 'label'"
                      :is="sortDir === 'asc' ? ArrowDownAZ : ArrowUpAZ"
                      class="w-3 h-3 text-foreground/60"
                    />
                  </span>
                </th>
                <th class="px-4 py-2 font-medium cursor-pointer" @click="toggleSort('startedAt')">
                  <span class="inline-flex items-center gap-1">
                    <Calendar class="w-3 h-3" />
                    Recorded
                    <component
                      v-if="sortKey === 'startedAt'"
                      :is="sortDir === 'asc' ? ArrowDownAZ : ArrowUpAZ"
                      class="w-3 h-3 text-foreground/60"
                    />
                  </span>
                </th>
                <th class="px-4 py-2 font-medium cursor-pointer" @click="toggleSort('duration')">
                  <span class="inline-flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    Duration
                    <component
                      v-if="sortKey === 'duration'"
                      :is="sortDir === 'asc' ? ArrowDownAZ : ArrowUpAZ"
                      class="w-3 h-3 text-foreground/60"
                    />
                  </span>
                </th>
                <th class="px-4 py-2 font-medium">
                  <span class="inline-flex items-center gap-1">
                    <Smartphone class="w-3 h-3" />
                    Device
                  </span>
                </th>
                <th
                  class="px-4 py-2 font-medium text-right cursor-pointer"
                  @click="toggleSort('fileSizeBytes')"
                >
                  <span class="inline-flex items-center gap-1">
                    <HardDrive class="w-3 h-3" />
                    Size
                    <component
                      v-if="sortKey === 'fileSizeBytes'"
                      :is="sortDir === 'asc' ? ArrowDownAZ : ArrowUpAZ"
                      class="w-3 h-3 text-foreground/60"
                    />
                  </span>
                </th>
                <th class="px-2 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filtered"
                :key="item.sessionId"
                class="border-b border-border/15 hover:bg-surface-3/40 cursor-pointer group transition-colors"
                @click="selectSession(item)"
              >
                <td class="px-4 py-2.5 align-top">
                  <div class="font-medium text-foreground truncate max-w-[260px]">
                    {{ item.label || item.sessionId }}
                    <span
                      v-if="item.incomplete"
                      class="ml-1 rounded bg-warning/15 px-1 py-0.5 text-[9px] font-medium text-warning"
                      :title="`Missing tracks: ${item.missingTracks.join(', ') || 'unknown'}`"
                    >
                      Incomplete
                    </span>
                  </div>
                  <div
                    v-if="item.targetUrl"
                    class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 truncate max-w-[260px]"
                  >
                    <Globe class="w-2.5 h-2.5" />
                    {{ item.targetUrl }}
                  </div>
                  <div class="mt-0.5 text-[10px] font-mono text-muted-foreground/30 truncate">
                    {{ shortPath(item.filePath) }}
                  </div>
                </td>
                <td class="px-4 py-2.5 align-top text-muted-foreground/80 whitespace-nowrap">
                  {{ formatDate(item.startedAt) }}
                </td>
                <td class="px-4 py-2.5 align-top text-muted-foreground/80 whitespace-nowrap">
                  {{ formatDuration(item.duration) }}
                </td>
                <td class="px-4 py-2.5 align-top text-muted-foreground/70 whitespace-nowrap">
                  {{ item.deviceSerial || "—" }}
                </td>
                <td
                  class="px-4 py-2.5 align-top text-right font-mono text-muted-foreground/70 whitespace-nowrap"
                >
                  {{ formatSize(item.fileSizeBytes) }}
                </td>
                <td class="px-2 py-2.5 align-top text-right">
                  <div
                    class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                  >
                    <button
                      class="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-surface-3 transition-colors"
                      :disabled="exporting"
                      title="Export session"
                      @click="prepareExport(item, $event)"
                    >
                      <Share2 class="w-3 h-3" />
                    </button>
                    <button
                      class="p-1 rounded text-muted-foreground/40 hover:text-error hover:bg-surface-3 transition-colors"
                      :disabled="deletingId === item.sessionId"
                      title="Delete session"
                      @click="deleteSession(item, $event)"
                    >
                      <RefreshCw
                        v-if="deletingId === item.sessionId"
                        class="w-3 h-3 animate-spin"
                      />
                      <Trash2 v-else class="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-surface-1/50 text-[10px] text-muted-foreground/50"
      >
        <span>
          {{ filtered.length }}
          {{ filtered.length === 1 ? "session" : "sessions" }}
          <template v-if="search && filtered.length !== sessions.length">
            (of {{ sessions.length }})
          </template>
        </span>
        <span>Click a row to open · sort by clicking column headers</span>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="exportDialogOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-primary" />
          Export recording
        </DialogTitle>
        <DialogDescription>
          Shareable export removes common secret-bearing data. Review scope before saving. Automated
          redaction does not guarantee anonymity.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <label class="flex items-start gap-2 rounded-md border border-border/30 p-3">
          <Checkbox
            :model-value="exportOptions.redactUrls"
            @update:model-value="
              exportOptions.redactUrls = $event === true;
              refreshExportPreview();
            "
          />
          <span
            ><Label>Mask URLs</Label
            ><span class="block text-[11px] text-muted-foreground"
              >Removes paths and query values.</span
            ></span
          >
        </label>
        <label class="flex items-start gap-2 rounded-md border border-border/30 p-3">
          <Checkbox
            :model-value="exportOptions.redactBodies"
            @update:model-value="
              exportOptions.redactBodies = $event === true;
              refreshExportPreview();
            "
          />
          <span
            ><Label>Mask request and response bodies</Label
            ><span class="block text-[11px] text-muted-foreground"
              >Removes captured payload contents.</span
            ></span
          >
        </label>
        <label class="flex items-start gap-2 rounded-md border border-border/30 p-3">
          <Checkbox
            :model-value="exportOptions.redactDom"
            @update:model-value="
              exportOptions.redactDom = $event === true;
              refreshExportPreview();
            "
          />
          <span
            ><Label>Remove DOM replay</Label
            ><span class="block text-[11px] text-muted-foreground"
              >Prevents page text and form values from being shared.</span
            ></span
          >
        </label>

        <div v-if="exportPreview" class="rounded-md bg-surface-2 p-3 text-xs text-muted-foreground">
          {{ exportPreview.redactedHeaders }} sensitive headers,
          {{ exportPreview.redactedBodies }} bodies, and {{ exportPreview.redactedUrls }} URLs will
          be redacted.
          <span v-if="exportPreview.excludedTracks.length" class="block mt-1">
            Excluded tracks: {{ exportPreview.excludedTracks.join(", ") }}.
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          class="gap-2 text-warning"
          :disabled="exporting"
          @click="exportSession(true)"
        >
          <FileWarning class="w-4 h-4" />
          Export raw data
        </Button>
        <Button class="gap-2" :disabled="exporting" @click="exportSession(false)">
          <RefreshCw v-if="exporting" class="w-4 h-4 animate-spin" />
          <ShieldCheck v-else class="w-4 h-4" />
          Export shareable copy
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
