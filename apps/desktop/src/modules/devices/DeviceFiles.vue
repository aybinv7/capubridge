<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdb } from "@/composables/useAdb";
import { useDevicesStore } from "@/stores/devices.store";
import DeviceFileUnsupportedPopover from "./DeviceFileUnsupportedPopover.vue";
import DeviceFileViewerDialog from "./DeviceFileViewerDialog.vue";
import {
  decodeBase64Text,
  fileIcon,
  fileIconClass,
  fileMimeType,
  fileViewerKind,
  formatFileEntrySize,
  formatSize,
  formatSizeLabel,
  isFolderEntry,
  parseJsonViewerValue,
  type DeviceFileListEntry,
  type DeviceFileViewerContent,
} from "./deviceFiles.utils";
import type { DeviceFileContent, FileEntry } from "@/types/adb.types";

const devicesStore = useDevicesStore();
const route = useRoute();
const qc = useQueryClient();
const { shellCommand } = useAdb();
const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");

const expandedDirs = ref<Set<string>>(new Set(["/"]));
const treeContents = ref<Map<string, FileEntry[]>>(new Map());
const treeLoading = ref<Set<string>>(new Set());
const selectedDir = ref("/");
const filesView = ref<"list" | "grid">("grid");
const showHidden = ref(false);
const selectedEntryKey = ref<string | null>(null);
const previewOpen = ref(false);
const pendingDelete = ref<FileListEntry | null>(null);
const pendingDeleteFallbackIndex = ref<number | null>(null);
const listPaneEl = ref<HTMLDivElement | null>(null);
const searchInputFocused = ref(false);
const gridColumns = 5;
const searchQuery = ref("");
const searchScope = ref<"current" | "system">("current");
const debouncedSystemQuery = ref("");
const liveRefreshMode = ref("manual");
const fileViewerOpen = ref(false);
const fileViewerLoading = ref(false);
const fileViewerError = ref("");
const fileViewerPendingEntry = ref<FileListEntry | null>(null);
const fileViewerContent = shallowRef<DeviceFileViewerContent | null>(null);
const unsupportedPopoverOpen = ref(false);
const unsupportedEntry = ref<FileListEntry | null>(null);
const isWindowVisible = ref(
  typeof document === "undefined" ? true : document.visibilityState === "visible",
);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYSTEM_SEARCH_MIN_CHARS = 1;
const SYSTEM_SEARCH_DEBOUNCE_MS = 450;
const SYSTEM_SEARCH_LIMIT = 180;
const LIVE_REFRESH_INTERVAL_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "3000", label: "3s" },
  { value: "5000", label: "5s" },
  { value: "10000", label: "10s" },
  { value: "15000", label: "15s" },
  { value: "30000", label: "30s" },
];

type FileListEntry = DeviceFileListEntry;

const requestedPath = computed(() => {
  const raw = route.query.path;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? normalizePath(value) : null;
});
const isFilesRouteActive = computed(() => route.name === "devices-files");
const liveRefreshIntervalMs = computed(() =>
  liveRefreshMode.value === "manual" ? 0 : Number(liveRefreshMode.value) || 5000,
);
const shouldLiveRefresh = computed(
  () =>
    liveRefreshMode.value !== "manual" &&
    isFilesRouteActive.value &&
    isWindowVisible.value &&
    searchScope.value === "current" &&
    !!serial.value,
);

const {
  data: entries,
  isLoading,
  isError,
  error,
  refetch,
} = useQuery({
  queryKey: computed(() => ["adb-dir", serial.value, selectedDir.value]),
  queryFn: () =>
    invoke<FileEntry[]>("adb_list_dir", {
      serial: serial.value,
      path: selectedDir.value,
    }),
  enabled: computed(() => !!serial.value),
  staleTime: 15_000,
  refetchInterval: computed(() => (shouldLiveRefresh.value ? liveRefreshIntervalMs.value : false)),
});

const {
  data: systemSearchEntries,
  isFetching: isSystemSearchLoading,
  isError: isSystemSearchError,
  error: systemSearchError,
} = useQuery({
  queryKey: computed(() => ["adb-system-search", serial.value, debouncedSystemQuery.value]),
  queryFn: () => searchSystemEntries(debouncedSystemQuery.value),
  enabled: computed(
    () =>
      !!serial.value &&
      searchScope.value === "system" &&
      debouncedSystemQuery.value.length >= SYSTEM_SEARCH_MIN_CHARS,
  ),
  staleTime: 5_000,
});

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  let value = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (value.length > 1) value = value.replace(/\/+$/, "");
  return value || "/";
}
function joinPath(base: string, name: string) {
  return base === "/" ? `/${name}` : `${base}/${name}`;
}
function parentPath(path: string) {
  if (path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

function shellEscape(value: string) {
  return value.replace(/'/g, "'\\''");
}
function escapeFindPattern(value: string) {
  return value.replace(/(\\|\*|\?|\[|\])/g, "\\$1");
}
function fileNameFromPath(path: string) {
  if (path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  return parts.pop() ?? path;
}
function sortEntries(entriesToSort: FileListEntry[]) {
  return [...entriesToSort].sort((a, b) => {
    const aIsDir = a.entryType === "dir" || a.entryType === "symlink";
    const bIsDir = b.entryType === "dir" || b.entryType === "symlink";
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.name.localeCompare(b.name);
  });
}
async function searchSystemEntries(query: string): Promise<FileListEntry[]> {
  const escaped = shellEscape(escapeFindPattern(query.trim()));
  if (!escaped) return [];

  const command =
    `{ ` +
    `find /sdcard/Android/data -iname '*${escaped}*' 2>/dev/null; ` +
    `find /storage/emulated/0/Android/data -iname '*${escaped}*' 2>/dev/null; ` +
    `find /sdcard -maxdepth 8 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /storage/emulated/0 -maxdepth 8 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /data/local/tmp -iname '*${escaped}*' 2>/dev/null; ` +
    `find /data/data -maxdepth 4 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /data/app -maxdepth 4 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /system -maxdepth 7 -iname '*${escaped}*' 2>/dev/null; ` +
    `find /vendor -maxdepth 6 -iname '*${escaped}*' 2>/dev/null; ` +
    `} | awk '!seen[$0]++' | head -n ${SYSTEM_SEARCH_LIMIT} ` +
    `| while IFS= read -r p; do ` +
    `if [ -L "$p" ]; then t=symlink; ` +
    `elif [ -d "$p" ]; then t=dir; ` +
    `elif [ -f "$p" ]; then t=file; ` +
    `else t=other; fi; ` +
    `printf '%s\\t%s\\n' "$t" "$p"; done`;

  const output = await shellCommand(serial.value, command);
  const seen = new Set<string>();
  const parsed: FileListEntry[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [entryTypeRaw, ...pathParts] = trimmed.split("\t");
    const path = normalizePath(pathParts.join("\t").trim());
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const entryType: FileEntry["entryType"] = ["dir", "symlink", "file", "other"].includes(
      entryTypeRaw,
    )
      ? (entryTypeRaw as FileEntry["entryType"])
      : "other";
    parsed.push({
      name: fileNameFromPath(path),
      path,
      size: 0,
      modified: "—",
      permissions: "---------",
      entryType,
    });
  }
  return sortEntries(parsed);
}

const currentFolderEntries = computed<FileListEntry[]>(() => {
  const all = entries.value ?? [];
  const withHidden = showHidden.value ? all : all.filter((e) => !e.name.startsWith("."));
  const query = searchScope.value === "current" ? searchQuery.value.trim().toLowerCase() : "";
  const filtered = query
    ? withHidden.filter((entry) => entry.name.toLowerCase().includes(query))
    : withHidden;
  const mapped: FileListEntry[] = filtered.map((entry) => ({
    ...entry,
    path: joinPath(selectedDir.value, entry.name),
  }));
  return sortEntries(mapped);
});

const displayEntries = computed<FileListEntry[]>(() => {
  if (searchScope.value === "system") {
    return systemSearchEntries.value ?? [];
  }
  return currentFolderEntries.value;
});

const entriesLoading = computed(() =>
  searchScope.value === "system" ? isSystemSearchLoading.value : isLoading.value,
);
const entriesErrorText = computed(() => {
  if (searchScope.value === "system") {
    if (!isSystemSearchError.value) return "";
    return String(systemSearchError.value ?? "System search failed");
  }
  if (!isError.value) return "";
  return String(error.value ?? "Failed to load directory");
});
const showSystemSearchPrompt = computed(
  () => searchScope.value === "system" && searchQuery.value.trim().length < SYSTEM_SEARCH_MIN_CHARS,
);

const selectedEntry = computed(
  () => displayEntries.value.find((entry) => entry.path === selectedEntryKey.value) ?? null,
);
const selectedEntryPath = computed(() => selectedEntry.value?.path ?? "");
const fileViewerEntry = computed(
  () => fileViewerContent.value?.entry ?? fileViewerPendingEntry.value,
);
const mediaGalleryEntries = computed(() =>
  displayEntries.value.filter((entry) => {
    const kind = fileViewerKind(entry);
    return kind === "image" || kind === "video";
  }),
);
const fileViewerGalleryIndex = computed(() => {
  const entry = fileViewerEntry.value;
  if (!entry) return -1;
  return mediaGalleryEntries.value.findIndex((item) => item.path === entry.path);
});
const fileViewerGalleryTotal = computed(() => mediaGalleryEntries.value.length);

const breadcrumbs = computed(() => {
  const items: { label: string; path: string }[] = [{ label: "/", path: "/" }];
  let current = "";
  for (const part of selectedDir.value.split("/").filter(Boolean)) {
    current += `/${part}`;
    items.push({ label: part, path: current });
  }
  return items;
});

const flatDirs = computed(() => {
  const out: {
    path: string;
    label: string;
    depth: number;
    loading: boolean;
  }[] = [];
  const walk = (paths: string[], depth: number) => {
    for (const path of paths) {
      const label = path === "/" ? "/" : (path.split("/").filter(Boolean).pop() ?? path);
      out.push({ path, label, depth, loading: treeLoading.value.has(path) });
      if (expandedDirs.value.has(path) && treeContents.value.has(path)) {
        const sub = (treeContents.value.get(path) ?? [])
          .filter((e) => e.entryType === "dir" || e.entryType === "symlink")
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((e) => joinPath(path, e.name));
        walk(sub, depth + 1);
      }
    }
  };
  walk(["/"], 0);
  return out;
});

async function loadTreeDir(path: string) {
  if (!serial.value || treeLoading.value.has(path) || treeContents.value.has(path)) return;
  treeLoading.value.add(path);
  try {
    const value = await invoke<FileEntry[]>("adb_list_dir", {
      serial: serial.value,
      path,
    });
    treeContents.value.set(path, value);
  } catch {
    treeContents.value.set(path, []);
  } finally {
    treeLoading.value.delete(path);
  }
}
async function expandToPath(path: string) {
  expandedDirs.value.add("/");
  await loadTreeDir("/");
  let current = "/";
  for (const part of normalizePath(path).split("/").filter(Boolean)) {
    current = joinPath(current, part);
    expandedDirs.value.add(current);
    await loadTreeDir(current);
  }
}

function isTreeSelected(path: string) {
  return selectedDir.value === path;
}
function isTreeAncestor(path: string) {
  if (path === "/") return selectedDir.value !== "/";
  return selectedDir.value.startsWith(`${path}/`);
}
function leaveSearchModeForNavigation() {
  searchQuery.value = "";
  debouncedSystemQuery.value = "";
  if (searchScope.value === "system") {
    searchScope.value = "current";
  }
}
function selectDir(path: string) {
  leaveSearchModeForNavigation();
  selectedDir.value = normalizePath(path);
  selectedEntryKey.value = null;
  pendingDelete.value = null;
  previewOpen.value = false;
  fileViewerOpen.value = false;
  unsupportedPopoverOpen.value = false;
}
async function toggleDir(path: string, e: MouseEvent) {
  e.stopPropagation();
  if (expandedDirs.value.has(path)) expandedDirs.value.delete(path);
  else {
    expandedDirs.value.add(path);
    await loadTreeDir(path);
  }
}

function selectEntry(entry: FileListEntry) {
  selectedEntryKey.value = entry.path;
}
function revealPreview(entry: FileListEntry) {
  selectedEntryKey.value = entry.path;
  previewOpen.value = true;
}
function openDir(entry: FileListEntry) {
  if (entry.entryType !== "dir" && entry.entryType !== "symlink") return;
  leaveSearchModeForNavigation();
  selectedDir.value = normalizePath(entry.path);
  selectedEntryKey.value = null;
  pendingDelete.value = null;
  previewOpen.value = false;
  fileViewerOpen.value = false;
  unsupportedPopoverOpen.value = false;
}
function openParentDir() {
  if (selectedDir.value === "/") return;
  leaveSearchModeForNavigation();
  selectedDir.value = parentPath(selectedDir.value);
  selectedEntryKey.value = null;
  pendingDelete.value = null;
  previewOpen.value = false;
  fileViewerOpen.value = false;
  unsupportedPopoverOpen.value = false;
}
async function openOnHost(entry: FileListEntry) {
  if (entry.entryType === "dir" || entry.entryType === "symlink") return;
  try {
    await invoke("adb_open_file", {
      serial: serial.value,
      path: entry.path,
    });
    toast.success(`Opened ${entry.name}`);
  } catch (err) {
    toast.error(`Failed to open ${entry.name}`, {
      description: String(err),
    });
  }
}
async function pullEntry(entry: FileListEntry) {
  try {
    const saved = await invoke<string>("adb_pull_file", {
      serial: serial.value,
      path: entry.path,
    });
    toast.success(`Downloaded ${entry.name}`, {
      description: saved,
    });
  } catch (err) {
    toast.error(`Failed to download ${entry.name}`, {
      description: String(err),
    });
  }
}
function showUnsupportedFile(entry: FileListEntry) {
  selectedEntryKey.value = entry.path;
  fileViewerOpen.value = false;
  unsupportedEntry.value = entry;
  unsupportedPopoverOpen.value = true;
}
async function openInAppViewer(entry: FileListEntry) {
  const kind = fileViewerKind(entry);
  if (!kind) {
    showUnsupportedFile(entry);
    return;
  }
  selectedEntryKey.value = entry.path;
  unsupportedPopoverOpen.value = false;
  fileViewerOpen.value = true;
  fileViewerLoading.value = true;
  fileViewerError.value = "";
  fileViewerPendingEntry.value = entry;
  fileViewerContent.value = null;
  try {
    const content = await invoke<DeviceFileContent>("adb_read_file", {
      serial: serial.value,
      path: entry.path,
    });
    const mime = fileMimeType(entry, kind);
    const text = kind === "json" || kind === "text" ? decodeBase64Text(content.base64) : "";
    fileViewerContent.value = {
      entry: {
        ...entry,
        size: content.size,
      },
      kind,
      mime,
      dataUrl: `data:${mime};base64,${content.base64}`,
      text,
      jsonValue: kind === "json" ? parseJsonViewerValue(text) : null,
    };
  } catch (err) {
    fileViewerError.value = String(err);
    toast.error(`Failed to open ${entry.name}`, {
      description: String(err),
    });
  } finally {
    fileViewerLoading.value = false;
  }
}
function navigateFileViewer(direction: "prev" | "next") {
  const entries = mediaGalleryEntries.value;
  if (entries.length < 2) return;
  const currentIndex = fileViewerGalleryIndex.value < 0 ? 0 : fileViewerGalleryIndex.value;
  const nextIndex =
    direction === "prev"
      ? (currentIndex - 1 + entries.length) % entries.length
      : (currentIndex + 1) % entries.length;
  const nextEntry = entries[nextIndex];
  if (nextEntry) void openInAppViewer(nextEntry);
}
async function openUnsupportedOnHost() {
  const entry = unsupportedEntry.value;
  if (!entry) return;
  unsupportedPopoverOpen.value = false;
  await openOnHost(entry);
}
async function chooseUnsupportedApp() {
  const entry = unsupportedEntry.value;
  if (!entry) return;
  unsupportedPopoverOpen.value = false;
  try {
    await invoke("adb_open_file_picker", {
      serial: serial.value,
      path: entry.path,
    });
  } catch (err) {
    toast.error(`Failed to choose app for ${entry.name}`, {
      description: String(err),
    });
  }
}
async function downloadUnsupportedEntry() {
  const entry = unsupportedEntry.value;
  if (!entry) return;
  unsupportedPopoverOpen.value = false;
  await pullEntry(entry);
}
function requestDelete(entry: FileListEntry) {
  selectedEntryKey.value = entry.path;
  pendingDelete.value = entry;
}
async function confirmDelete() {
  const entry = pendingDelete.value;
  if (!entry) return;
  const idx = displayEntries.value.findIndex((e) => e.path === entry.path);
  pendingDeleteFallbackIndex.value = Math.max(0, idx - 1);
  pendingDelete.value = null;
  try {
    await invoke("adb_delete_file", {
      serial: serial.value,
      path: entry.path,
      isDir: entry.entryType === "dir",
    });
    toast.success(`Deleted ${entry.name}`);
    if (searchScope.value === "system") {
      if (debouncedSystemQuery.value) {
        await qc.invalidateQueries({
          queryKey: ["adb-system-search", serial.value, debouncedSystemQuery.value],
        });
      }
      return;
    }
    treeContents.value.delete(selectedDir.value);
    await qc.invalidateQueries({
      queryKey: ["adb-dir", serial.value, selectedDir.value],
    });
    await refetch();
  } catch (err) {
    toast.error(`Failed to delete ${entry.name}`, {
      description: String(err),
    });
  }
}
function moveSelection(step: number) {
  if (!displayEntries.value.length) return;
  const idx = displayEntries.value.findIndex((e) => e.path === selectedEntryKey.value);
  const current = idx < 0 ? 0 : idx;
  const next = Math.max(0, Math.min(displayEntries.value.length - 1, current + step));
  selectedEntryKey.value = displayEntries.value[next]?.path ?? null;
}
function onKeydown(e: KeyboardEvent) {
  if (!displayEntries.value.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveSelection(filesView.value === "grid" ? gridColumns : 1);
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    moveSelection(filesView.value === "grid" ? -gridColumns : -1);
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (filesView.value === "grid") {
      moveSelection(-1);
    } else {
      openParentDir();
    }
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    if (filesView.value === "grid") moveSelection(1);
    else if (
      selectedEntry.value &&
      (selectedEntry.value.entryType === "dir" || selectedEntry.value.entryType === "symlink")
    )
      openDir(selectedEntry.value);
    else if (selectedEntry.value) revealPreview(selectedEntry.value);
  }
  if (e.key === "Backspace") {
    e.preventDefault();
    openParentDir();
  }
  if (e.key === "Delete" && selectedEntry.value) {
    e.preventDefault();
    requestDelete(selectedEntry.value);
  }
  if (e.key === "Enter" && selectedEntry.value) {
    e.preventDefault();
    if (selectedEntry.value.entryType === "dir" || selectedEntry.value.entryType === "symlink")
      openDir(selectedEntry.value);
    else void openInAppViewer(selectedEntry.value);
  }
}
async function onDoubleClick(entry: FileListEntry) {
  if (entry.entryType === "dir" || entry.entryType === "symlink") openDir(entry);
  else {
    await openInAppViewer(entry);
  }
}

function formatEntrySize(entry: FileEntry) {
  return formatFileEntrySize(entry, searchScope.value === "system" ? "Unknown" : "0 B");
}
function formatEntryModified(entry: FileEntry) {
  if (!entry.modified || entry.modified === "—") return "Unknown";
  return entry.modified;
}

function refreshEntries() {
  if (searchScope.value === "system") {
    if (debouncedSystemQuery.value) {
      void qc.invalidateQueries({
        queryKey: ["adb-system-search", serial.value, debouncedSystemQuery.value],
      });
    }
    return;
  }
  void refetch();
}

function updateWindowVisibility() {
  isWindowVisible.value = document.visibilityState === "visible";
}

watch(
  [searchScope, searchQuery],
  ([scope, rawQuery]) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (scope !== "system") {
      debouncedSystemQuery.value = "";
      return;
    }
    const trimmed = rawQuery.trim();
    if (trimmed.length < SYSTEM_SEARCH_MIN_CHARS) {
      debouncedSystemQuery.value = "";
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      debouncedSystemQuery.value = trimmed;
    }, SYSTEM_SEARCH_DEBOUNCE_MS);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  document.removeEventListener("visibilitychange", updateWindowVisibility);
});
onMounted(() => {
  document.addEventListener("visibilitychange", updateWindowVisibility);
});

watch(
  [serial, requestedPath],
  ([nextSerial, path]) => {
    if (!nextSerial) return;
    selectedDir.value = path ?? "/";
    selectedEntryKey.value = null;
    previewOpen.value = false;
    expandedDirs.value = new Set(["/"]);
    treeContents.value.clear();
    void expandToPath(selectedDir.value);
  },
  { immediate: true },
);

watch(
  [entries, selectedDir, searchScope],
  ([nextEntries, dir, scope]) => {
    if (!nextEntries || scope !== "current") return;
    treeContents.value.set(dir, nextEntries);
  },
  { immediate: true },
);

watch(
  () => displayEntries.value,
  async (next) => {
    if (!next.length) {
      selectedEntryKey.value = null;
      previewOpen.value = false;
      return;
    }
    if (pendingDeleteFallbackIndex.value !== null) {
      const i = Math.min(next.length - 1, pendingDeleteFallbackIndex.value);
      selectedEntryKey.value = next[i]?.path ?? null;
      pendingDeleteFallbackIndex.value = null;
    } else if (!selectedEntryKey.value || !next.some((e) => e.path === selectedEntryKey.value)) {
      selectedEntryKey.value = next[0]?.path ?? null;
    }
    if (!searchInputFocused.value) {
      await nextTick();
      listPaneEl.value?.focus();
    }
  },
  { immediate: true },
);

watch(
  () => selectedDir.value,
  () => nextTick(() => listPaneEl.value?.focus()),
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div v-if="!serial" class="flex flex-1 items-center justify-center text-muted-foreground/40">
      No device connected
    </div>
    <template v-else>
      <div class="flex h-10 items-center gap-1 border-b border-border/30 bg-surface-2 px-3">
        <div class="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden font-mono text-xs">
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
            <span
              class="cursor-pointer rounded px-1 py-0.5 text-muted-foreground/50 hover:bg-surface-3"
              :class="{ 'text-foreground!': i === breadcrumbs.length - 1 }"
              :title="crumb.label"
              @click="selectDir(crumb.path)"
              >{{ crumb.label }}</span
            >
            <ChevronRight
              v-if="i < breadcrumbs.length - 1"
              class="h-3 w-3 text-muted-foreground/25"
            />
          </template>
        </div>
        <div
          class="flex w-[290px] items-center gap-1 rounded border border-border/25 bg-surface-3 px-2"
        >
          <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          <Input
            v-model="searchQuery"
            class="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
            :placeholder="
              searchScope === 'system' ? 'Search entire device…' : 'Search this folder…'
            "
            @focus="searchInputFocused = true"
            @blur="searchInputFocused = false"
          />
        </div>
        <Select v-model:model-value="searchScope">
          <SelectTrigger class="h-7 w-[122px] border-border/30 bg-surface-3 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current folder</SelectItem>
            <SelectItem value="system">Entire device</SelectItem>
          </SelectContent>
        </Select>
        <div class="flex rounded border border-border/20 bg-surface-3 p-0.5">
          <button
            class="h-6 w-6 rounded"
            :class="filesView === 'list' ? 'bg-surface-1' : ''"
            @click="filesView = 'list'"
          >
            <List class="mx-auto h-3.5 w-3.5" />
          </button>
          <button
            class="h-6 w-6 rounded"
            :class="filesView === 'grid' ? 'bg-surface-1' : ''"
            @click="filesView = 'grid'"
          >
            <LayoutGrid class="mx-auto h-3.5 w-3.5" />
          </button>
        </div>
        <Button variant="ghost" size="sm" class="h-7 w-7" @click="showHidden = !showHidden"
          ><EyeOff v-if="showHidden" class="h-3.5 w-3.5" /><Eye v-else class="h-3.5 w-3.5"
        /></Button>
        <Button variant="outline" size="sm" class="h-7 gap-1.5 px-2 text-xs" disabled
          ><Plus class="h-3 w-3" />Add</Button
        >
      </div>

      <div
        v-if="pendingDelete"
        class="absolute inset-0 z-50 flex items-center justify-center bg-background/60"
      >
        <div class="w-full max-w-sm rounded-lg border bg-surface-2 p-5">
          <p class="text-sm">
            Delete <span class="font-mono">{{ pendingDelete.name }}</span> ?
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" @click="pendingDelete = null">Cancel</Button>
            <Button variant="destructive" size="sm" @click="confirmDelete()">Delete</Button>
          </div>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" class="flex-1 overflow-hidden">
        <ResizablePanel :default-size="18" :min-size="12" :max-size="35">
          <div class="flex h-full min-h-0 flex-col border-r border-border/30">
            <div class="border-b border-border/20">
              <div class="flex items-center gap-1.5">
                <Select v-model:model-value="liveRefreshMode">
                  <SelectTrigger class="h-7 min-w-0 flex-1 rounded-none border-none text-xs">
                    <RadioTower />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in LIVE_REFRESH_INTERVAL_OPTIONS"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  class="flex-1 h-7 w-7 shrink-0 mr-1"
                  @click="refreshEntries()"
                  ><RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': entriesLoading }" />
                  Refresh
                </Button>
              </div>
            </div>
            <div class="flex h-8 items-center gap-2 border-b border-border/20 px-3">
              <HardDrive class="h-3 w-3 text-muted-foreground/30" /><span
                class="text-[11px] uppercase text-muted-foreground/40"
                >Folders</span
              >
            </div>
            <ScrollArea class="min-h-0 flex-1">
              <button
                v-for="dir in flatDirs"
                :key="dir.path"
                class="flex w-full items-center gap-1.5 py-1.5 pr-2 text-xs"
                :style="{ paddingLeft: `${8 + dir.depth * 12}px` }"
                :class="
                  isTreeSelected(dir.path)
                    ? 'bg-surface-3 text-foreground'
                    : isTreeAncestor(dir.path)
                      ? 'text-muted-foreground/45'
                      : 'text-muted-foreground/60'
                "
                @click="selectDir(dir.path)"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center"
                  @click.stop="toggleDir(dir.path, $event)"
                >
                  <Loader2 v-if="dir.loading" class="h-2.5 w-2.5 animate-spin" />
                  <ChevronDown v-else-if="expandedDirs.has(dir.path)" class="h-2.5 w-2.5" />
                  <ChevronRight v-else class="h-2.5 w-2.5" />
                </span>
                <component
                  :is="expandedDirs.has(dir.path) ? FolderOpen : Folder"
                  class="h-3.5 w-3.5 shrink-0 text-amber-400/70"
                  fill="#e0a528"
                  strokeWidth="0"
                />
                <span class="text-start min-w-0 flex-1 truncate" :title="dir.label">{{
                  dir.label
                }}</span>
              </button>
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle with-handle />

        <ResizablePanel :default-size="82">
          <div class="flex h-full">
            <div
              ref="listPaneEl"
              class="flex min-w-0 flex-1 flex-col overflow-hidden outline-none"
              tabindex="0"
              @keydown="onKeydown"
            >
              <div v-if="entriesLoading" class="flex h-full items-center justify-center gap-2">
                <Loader2 class="h-4 w-4 animate-spin" />Loading…
              </div>
              <div v-else-if="entriesErrorText" class="flex h-full items-center justify-center">
                <AlertCircle class="mr-2 h-5 w-5 text-error/50" />{{ entriesErrorText }}
              </div>
              <div
                v-else-if="showSystemSearchPrompt"
                class="flex h-full items-center justify-center text-muted-foreground/40"
              >
                Type at least {{ SYSTEM_SEARCH_MIN_CHARS }} characters to search entire device
              </div>
              <div
                v-else-if="!displayEntries.length"
                class="flex h-full items-center justify-center text-muted-foreground/40"
              >
                {{ searchScope === "system" ? "No matching files or folders" : "Empty directory" }}
              </div>

              <div v-else-if="filesView === 'list'" class="flex-1 overflow-auto">
                <table class="w-full table-fixed text-xs">
                  <colgroup>
                    <col class="w-[52%]" />
                    <col class="w-[14%]" />
                    <col class="w-[24%]" />
                    <col class="w-[10%]" />
                  </colgroup>
                  <thead class="sticky top-0 z-10 bg-surface-2">
                    <tr>
                      <th class="px-4 py-2 text-left">Name</th>
                      <th class="px-4 py-2 text-right">Size</th>
                      <th class="px-4 py-2 text-left">Modified</th>
                      <th class="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    <ContextMenu v-for="entry in displayEntries" :key="entry.path">
                      <ContextMenuTrigger as-child>
                        <tr
                          :class="
                            selectedEntryKey === entry.path
                              ? 'bg-surface-3'
                              : 'hover:bg-surface-2/60'
                          "
                          @click="selectEntry(entry)"
                          @dblclick="void onDoubleClick(entry)"
                        >
                          <td class="min-w-0 px-4 py-2">
                            <div class="flex min-w-0 items-center gap-2">
                              <div v-if="isFolderEntry(entry)" class="relative h-4 w-5 shrink-0">
                                <div
                                  class="absolute left-0.5 top-0 h-1.5 w-2.5 rounded-t bg-amber-300/95"
                                />
                                <div
                                  class="absolute top-0.5 h-3.5 w-5 rounded-sm bg-amber-400 shadow-[inset_0_-2px_0_rgba(217,119,6,0.85)]"
                                />
                              </div>
                              <component
                                v-else
                                :is="fileIcon(entry)"
                                class="h-4 w-4 shrink-0"
                                :class="fileIconClass(entry)"
                              />
                              <span class="block min-w-0 truncate pr-2" :title="entry.name">{{
                                entry.name
                              }}</span>
                            </div>
                          </td>
                          <td class="px-4 py-2 text-right">
                            {{
                              entry.entryType === "dir" || entry.entryType === "symlink"
                                ? "—"
                                : formatSize(entry.size)
                            }}
                          </td>
                          <td class="truncate px-4 py-2" :title="entry.modified">
                            {{ entry.modified }}
                          </td>
                          <td class="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-6 w-6"
                              @click.stop="requestDelete(entry)"
                              ><Trash2 class="h-3 w-3"
                            /></Button>
                          </td>
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem @select="revealPreview(entry)">Preview</ContextMenuItem>
                        <ContextMenuItem
                          v-if="entry.entryType === 'dir' || entry.entryType === 'symlink'"
                          @select="openDir(entry)"
                          >Open Folder</ContextMenuItem
                        >
                        <ContextMenuItem v-else @select="void openInAppViewer(entry)"
                          >Open in App</ContextMenuItem
                        >
                        <ContextMenuItem
                          v-if="entry.entryType === 'file' || entry.entryType === 'other'"
                          @select="void openOnHost(entry)"
                          >Open Externally</ContextMenuItem
                        >
                        <ContextMenuItem
                          v-if="entry.entryType === 'file' || entry.entryType === 'other'"
                          @select="void pullEntry(entry)"
                          >Download</ContextMenuItem
                        >
                        <ContextMenuSeparator />
                        <ContextMenuItem variant="destructive" @select="requestDelete(entry)"
                          >Delete</ContextMenuItem
                        >
                      </ContextMenuContent>
                    </ContextMenu>
                  </tbody>
                </table>
              </div>

              <div v-else class="flex-1 overflow-auto p-3">
                <div
                  class="grid gap-2"
                  :style="{
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                  }"
                >
                  <ContextMenu v-for="entry in displayEntries" :key="entry.path">
                    <ContextMenuTrigger as-child>
                      <button
                        class="group flex min-w-0 flex-col items-center overflow-hidden rounded-md px-2 py-2 text-center transition-colors"
                        :class="
                          selectedEntryKey === entry.path
                            ? 'bg-surface-3 ring-1 ring-border/40'
                            : 'hover:bg-surface-2'
                        "
                        @click="selectEntry(entry)"
                        @dblclick="void onDoubleClick(entry)"
                      >
                        <div v-if="isFolderEntry(entry)" class="relative h-10 w-12 shrink-0">
                          <div class="absolute left top-0 h-3.5 w-5 rounded-t-md bg-amber-300/95" />
                          <div
                            class="absolute top-1.5 h-8 w-12 rounded-md bg-amber-400 shadow-[inset_0_-3px_0_rgba(217,119,6,0.85)]"
                          />
                        </div>
                        <component
                          v-else
                          :is="fileIcon(entry)"
                          class="h-10 w-10 shrink-0"
                          :class="fileIconClass(entry)"
                        />
                        <div
                          class="mt-2 line-clamp-2 w-full break-all px-1 text-xs font-medium leading-tight text-foreground/90"
                          :title="entry.name"
                        >
                          {{ entry.name }}
                        </div>
                        <div class="mt-0.5 text-[10px] text-muted-foreground/55">
                          {{ formatSizeLabel(entry) }}
                        </div>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem @select="revealPreview(entry)">Preview</ContextMenuItem>
                      <ContextMenuItem
                        v-if="entry.entryType === 'dir' || entry.entryType === 'symlink'"
                        @select="openDir(entry)"
                        >Open Folder</ContextMenuItem
                      >
                      <ContextMenuItem v-else @select="void openInAppViewer(entry)"
                        >Open in App</ContextMenuItem
                      >
                      <ContextMenuItem
                        v-if="entry.entryType === 'file' || entry.entryType === 'other'"
                        @select="void openOnHost(entry)"
                        >Open Externally</ContextMenuItem
                      >
                      <ContextMenuItem
                        v-if="entry.entryType === 'file' || entry.entryType === 'other'"
                        @select="void pullEntry(entry)"
                        >Download</ContextMenuItem
                      >
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" @select="requestDelete(entry)"
                        >Delete</ContextMenuItem
                      >
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            </div>

            <aside
              v-if="previewOpen && selectedEntry"
              class="w-[300px] shrink-0 overflow-y-auto border-l border-border/20 bg-surface-2 p-3"
            >
              <div class="text-xs text-muted-foreground/50">Preview</div>
              <div class="mt-2 flex items-center gap-2">
                <div v-if="isFolderEntry(selectedEntry)" class="relative h-5 w-6 shrink-0">
                  <div class="absolute left-0.5 top-0 h-2 w-2.5 rounded-t bg-amber-300/95" />
                  <div
                    class="absolute top-1 h-4 w-6 rounded-sm bg-amber-400 shadow-[inset_0_-2px_0_rgba(217,119,6,0.85)]"
                  />
                </div>
                <component
                  v-else
                  :is="fileIcon(selectedEntry)"
                  class="h-5 w-5 shrink-0"
                  :class="fileIconClass(selectedEntry)"
                />
                <div class="min-w-0 truncate text-sm font-medium" :title="selectedEntry.name">
                  {{ selectedEntry.name }}
                </div>
              </div>
              <div class="mt-1 break-all text-[11px] text-muted-foreground/55">
                {{ selectedEntryPath }}
              </div>
              <div class="mt-3 space-y-1 text-xs">
                <div>Type: {{ selectedEntry.entryType }}</div>
                <div>Size: {{ formatEntrySize(selectedEntry) }}</div>
                <div>Modified: {{ formatEntryModified(selectedEntry) }}</div>
              </div>
              <div class="mt-3 flex flex-col gap-1.5">
                <Button
                  v-if="selectedEntry.entryType === 'dir' || selectedEntry.entryType === 'symlink'"
                  variant="outline"
                  size="sm"
                  class="justify-start"
                  @click="openDir(selectedEntry)"
                  >Open Folder</Button
                >
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  class="justify-start"
                  @click="void openInAppViewer(selectedEntry)"
                  >Open in App</Button
                >
                <Button
                  v-if="selectedEntry.entryType === 'file' || selectedEntry.entryType === 'other'"
                  variant="outline"
                  size="sm"
                  class="justify-start"
                  @click="void openOnHost(selectedEntry)"
                  >Open Externally</Button
                >
                <Button
                  v-if="selectedEntry.entryType === 'file' || selectedEntry.entryType === 'other'"
                  variant="outline"
                  size="sm"
                  class="justify-start"
                  @click="void pullEntry(selectedEntry)"
                  >Download</Button
                >
                <Button
                  variant="destructive"
                  size="sm"
                  class="justify-start"
                  @click="requestDelete(selectedEntry)"
                  >Delete</Button
                >
              </div>
            </aside>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </template>

    <DeviceFileViewerDialog
      v-model:open="fileViewerOpen"
      :entry="fileViewerEntry"
      :content="fileViewerContent"
      :loading="fileViewerLoading"
      :error="fileViewerError"
      :gallery-index="fileViewerGalleryIndex"
      :gallery-total="fileViewerGalleryTotal"
      @open-external="openOnHost"
      @download="pullEntry"
      @navigate="navigateFileViewer"
    />

    <DeviceFileUnsupportedPopover
      v-model:open="unsupportedPopoverOpen"
      :entry="unsupportedEntry"
      @open-external="openUnsupportedOnHost"
      @choose-app="chooseUnsupportedApp"
      @download="downloadUnsupportedEntry"
    />
  </div>
</template>
