<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  Search,
  Copy,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Globe,
  ChevronUp,
  ChevronDown,
  Check,
  Plus,
  AlertTriangle,
  FileCode,
  Info,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLocalForage } from "@/composables/useLocalForage";
import JsonEditor from "../localstorage/JsonEditor.vue";

// ─── State ─────────────────────────────────────────────────────────────────────

const filter = ref("");
const selectedOrigin = ref("");
const showExpandedDialog = ref(false);
const copiedRaw = ref(false);
const dialogEntryIdx = ref(-1);
const jsonEditorRef = ref<InstanceType<typeof JsonEditor> | null>(null);

const isCreate = ref(false);
const editKey = ref("");
const editValue = ref("");
const editOriginalKey = ref("");
const editOriginalValue = ref("");
const editError = ref("");
const editSaving = ref(false);

const showDeleteConfirm = ref(false);
const deleteTargetKey = ref("");

const { useOrigins, useEntries, getDomain } = useLocalForage();

const { data: origins, isLoading: isLoadingOrigins, refetch: refetchOrigins } = useOrigins();

const {
  data: entries,
  isLoading: isLoadingEntries,
  isError,
  refetch: refetchEntries,
} = useEntries(selectedOrigin);

// ─── Type inference ────────────────────────────────────────────────────────────

type ValueType = "json" | "number" | "date" | "boolean" | "string";

function inferType(raw: string): ValueType {
  const v = raw.trim();
  if (!v) return "string";
  if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))) {
    try {
      JSON.parse(v);
      return "json";
    } catch {
      return "json";
    }
  }
  if (!isNaN(Number(v)) && v !== "") return "number";
  if (v === "true" || v === "false") return "boolean";
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(v)) return "date";
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      JSON.parse(v);
      return "json";
    } catch {
      /* fall through */
    }
  }
  return "string";
}

const originalType = computed<ValueType>(() => inferType(editOriginalValue.value));

// ─── Validation ────────────────────────────────────────────────────────────────

type ValidationResult = { valid: true } | { valid: false; reason: string };

const validation = computed<ValidationResult>(() => {
  const v = editValue.value.trim();
  if (!v) return { valid: true };

  const type = isCreate.value ? inferType(v) : originalType.value;

  switch (type) {
    case "json": {
      try {
        JSON.parse(v);
        return { valid: true };
      } catch (e) {
        return { valid: false, reason: (e as SyntaxError).message };
      }
    }
    case "number": {
      if (isNaN(Number(v))) return { valid: false, reason: `Expected a number, got "${v}"` };
      return { valid: true };
    }
    case "boolean": {
      if (v !== "true" && v !== "false")
        return { valid: false, reason: `Expected "true" or "false"` };
      return { valid: true };
    }
    case "date": {
      if (isNaN(Date.parse(v))) return { valid: false, reason: `Invalid date format` };
      return { valid: true };
    }
    default:
      return { valid: true };
  }
});

const isEditValueValid = computed(() => validation.value.valid);

const isDirty = computed(() => {
  if (isCreate.value) return editValue.value.length > 0;
  return editValue.value !== editOriginalValue.value;
});

const editFormValid = computed(() => {
  if (isCreate.value && editKey.value.trim().length === 0) return false;
  return isEditValueValid.value;
});

const badge = computed<null | "unsaved" | "invalid">(() => {
  if (!isEditValueValid.value) return "invalid";
  if (isDirty.value) return "unsaved";
  return null;
});

// ─── Filtered entries ──────────────────────────────────────────────────────────

const filtered = computed(() => {
  if (!entries.value) return [];
  if (!filter.value) return entries.value;
  const q = filter.value.toLowerCase();
  return entries.value.filter(
    (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
  );
});

const dialogEntry = computed(() =>
  dialogEntryIdx.value >= 0 ? filtered.value[dialogEntryIdx.value] : null,
);

const dialogEntrySize = computed(() => {
  const val = dialogEntry.value?.value ?? editValue.value;
  if (!val) return "0 B";
  const bytes = new Blob([val]).size;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
});

// ─── Actions ───────────────────────────────────────────────────────────────────

function selectOrigin(origin: string) {
  selectedOrigin.value = origin;
}

async function confirmDelete(key: string) {
  deleteTargetKey.value = key;
  showDeleteConfirm.value = true;
}

async function executeDelete() {
  if (!selectedOrigin.value || !deleteTargetKey.value) return;
  try {
    await getDomain().deleteItem(selectedOrigin.value, deleteTargetKey.value);
    void refetchEntries();
  } catch (err) {
    console.error("Failed to delete:", err);
  }
  showDeleteConfirm.value = false;
  deleteTargetKey.value = "";
}

function refetchAll() {
  void refetchOrigins();
  if (selectedOrigin.value) void refetchEntries();
}

async function copyValue() {
  if (!editValue.value) return;
  await navigator.clipboard.writeText(editValue.value);
  copiedRaw.value = true;
  setTimeout(() => (copiedRaw.value = false), 2000);
}

function openDialog(idx: number) {
  const entry = filtered.value[idx];
  if (!entry) return;
  dialogEntryIdx.value = idx;
  isCreate.value = false;
  editKey.value = entry.key;
  editOriginalKey.value = entry.key;
  editOriginalValue.value = entry.value;
  try {
    editValue.value = JSON.stringify(JSON.parse(entry.value), null, 2);
  } catch {
    editValue.value = entry.value;
  }
  editError.value = "";
  showExpandedDialog.value = true;
}

function navigateDialog(direction: "prev" | "next") {
  if (!filtered.value.length) return;
  if (direction === "prev") {
    dialogEntryIdx.value =
      dialogEntryIdx.value <= 0 ? filtered.value.length - 1 : dialogEntryIdx.value - 1;
  } else {
    dialogEntryIdx.value =
      dialogEntryIdx.value >= filtered.value.length - 1 ? 0 : dialogEntryIdx.value + 1;
  }
  const entry = filtered.value[dialogEntryIdx.value];
  if (entry) {
    isCreate.value = false;
    editKey.value = entry.key;
    editOriginalKey.value = entry.key;
    editOriginalValue.value = entry.value;
    try {
      editValue.value = JSON.stringify(JSON.parse(entry.value), null, 2);
    } catch {
      editValue.value = entry.value;
    }
  }
  copiedRaw.value = false;
  editError.value = "";
}

function openCreateDialog() {
  isCreate.value = true;
  dialogEntryIdx.value = -1;
  editKey.value = "";
  editValue.value = "";
  editOriginalKey.value = "";
  editOriginalValue.value = "";
  editError.value = "";
  showExpandedDialog.value = true;
}

async function saveEdit() {
  if (!editFormValid.value || !selectedOrigin.value) return;
  if (originalType.value === "json" || (isCreate.value && inferType(editValue.value) === "json")) {
    try {
      editValue.value = JSON.stringify(JSON.parse(editValue.value), null, 2);
    } catch {
      /* save raw */
    }
  }
  editSaving.value = true;
  editError.value = "";
  try {
    if (isCreate.value) {
      await getDomain().setItem(selectedOrigin.value, editKey.value.trim(), editValue.value);
    } else {
      if (editKey.value !== editOriginalKey.value) {
        await getDomain().deleteItem(selectedOrigin.value, editOriginalKey.value);
      }
      await getDomain().setItem(selectedOrigin.value, editKey.value.trim(), editValue.value);
    }
    editOriginalValue.value = editValue.value;
    void refetchEntries();
    if (isCreate.value) showExpandedDialog.value = false;
  } catch (err) {
    editError.value = `Failed to save: ${err}`;
  } finally {
    editSaving.value = false;
  }
}

function formatSize(value: string): string {
  const bytes = new Blob([value]).size;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
  if (!showExpandedDialog.value) return;
  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    setTimeout(() => {
      const je = jsonEditorRef.value;
      je?.filterInputRef?.focus();
      je?.filterInputRef?.select();
    }, 100);
  }
  if (e.ctrlKey && e.key === "ArrowUp") {
    e.preventDefault();
    navigateDialog("prev");
  }
  if (e.ctrlKey && e.key === "ArrowDown") {
    e.preventDefault();
    navigateDialog("next");
  }
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    void saveEdit();
  }
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));

watch(showExpandedDialog, (open) => {
  if (!open) {
    isCreate.value = false;
    dialogEntryIdx.value = -1;
  }
});

watch(origins, (newOrigins) => {
  if (newOrigins && newOrigins.length > 0 && !selectedOrigin.value) {
    selectedOrigin.value = newOrigins[0]!;
  }
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col">
          <ScrollArea class="flex-1">
            <div v-if="isLoadingOrigins" class="flex items-center justify-center py-8">
              <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
            </div>
            <div
              v-else-if="!origins?.length"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <AlertCircle :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-muted-foreground/40">No origins found</p>
            </div>
            <div v-else>
              <button
                v-for="origin in origins"
                :key="origin"
                class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                :class="
                  selectedOrigin === origin
                    ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground'
                    : 'text-muted-foreground/50 hover:bg-surface-3/50 hover:text-muted-foreground border-l-2 border-transparent'
                "
                @click="selectOrigin(origin)"
              >
                <Globe :size="13" class="shrink-0 opacity-40" />
                <span class="truncate text-left font-mono text-xs">{{ origin }}</span>
              </button>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />

      <ResizablePanel :default-size="85">
        <div class="flex flex-col h-full">
          <div
            v-if="!selectedOrigin"
            class="flex flex-1 items-center justify-center text-sm text-muted-foreground/30"
          >
            Select an origin from the sidebar
          </div>

          <template v-else>
            <div class="flex items-center gap-2 border-b border-border/30">
              <div
                class="flex items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
              >
                <Search class="w-3 h-3 text-muted-foreground/50" />
                <Input
                  v-model="filter"
                  class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
                  placeholder="Filter keys or values…"
                />
              </div>
              <span class="text-xs text-muted-foreground/40"
                >({{ filtered.length ?? 0 }} entries)</span
              >
              <div class="flex-1" />
              <Button variant="ghost" size="sm" class="h-5 text-xs" @click="openCreateDialog()">
                <Plus :size="12" class="mr-1" />New Key
              </Button>
              <Button variant="ghost" size="sm" class="h-5 text-xs" @click="refetchAll()">
                <RefreshCw :size="12" class="mr-1" />Refresh
              </Button>
            </div>

            <div class="flex-1 overflow-auto">
              <div v-if="isLoadingEntries" class="flex items-center justify-center py-8">
                <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
              </div>
              <div
                v-else-if="isError || !filtered?.length"
                class="flex flex-col items-center justify-center py-8 px-3 text-center"
              >
                <AlertCircle :size="16" class="text-muted-foreground/30 mb-2" />
                <p class="text-[11px] text-muted-foreground/40">
                  {{ isError ? "Failed to load" : "No LocalForage entries" }}
                </p>
              </div>

              <table v-else class="w-full text-xs">
                <thead class="sticky top-0 z-10">
                  <tr
                    class="bg-surface-2 text-left text-muted-foreground/50 uppercase tracking-wider border-b border-border/30"
                  >
                    <th class="px-4 py-2.5 font-medium">Key</th>
                    <th class="px-4 py-2.5 font-medium">Value</th>
                    <th class="px-4 py-2.5 font-medium w-20">Size</th>
                    <th class="px-4 py-2.5 font-medium w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(entry, idx) in filtered"
                    :key="entry.key"
                    class="border-b border-border/20 cursor-pointer transition-colors data-row group"
                    @dblclick="openDialog(idx)"
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
                    <td class="px-4 py-2.5 font-mono text-xs text-muted-foreground/40">
                      {{ formatSize(entry.value) }}
                    </td>
                    <td class="px-4 py-2.5">
                      <div
                        class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          class="text-muted-foreground/40 hover:text-muted-foreground h-7 w-7"
                          @click.stop="openDialog(idx)"
                        >
                          <FileCode class="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="text-muted-foreground/40 hover:text-muted-foreground h-7 w-7"
                          @click.stop="copyValue()"
                        >
                          <Copy class="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="text-muted-foreground/40 hover:text-muted-foreground h-7 w-7"
                          @click.stop="openDialog(idx)"
                        >
                          <Pencil class="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="text-muted-foreground/40 hover:text-error h-7 w-7"
                          @click.stop="confirmDelete(entry.key)"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </Button>
                      </div>
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

  <!-- ── Edit / Create Dialog ──────────────────────────────────────────────── -->
  <Dialog v-model:open="showExpandedDialog">
    <DialogContent class="max-w-[90vw] min-w-[70vw] w-[90vw] h-[85vh] p-0 gap-0 flex flex-col">
      <DialogHeader class="px-6 py-1.5 border-b border-border/30 shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              v-if="!isCreate"
              class="text-muted-foreground/40 hover:text-foreground transition-colors"
              @click="navigateDialog('prev')"
            >
              <ChevronUp :size="16" />
            </button>
            <button
              v-if="!isCreate"
              class="text-muted-foreground/40 hover:text-foreground transition-colors"
              @click="navigateDialog('next')"
            >
              <ChevronDown :size="16" />
            </button>
            <DialogTitle class="text-base font-medium">
              {{ isCreate ? "New Entry" : editKey }}
            </DialogTitle>
            <span class="text-xs text-muted-foreground/40">{{ dialogEntrySize }}</span>

            <!-- type chip -->
            <span
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-muted-foreground/50 font-mono"
            >
              {{ isCreate ? inferType(editValue) : originalType }}
            </span>

            <!-- status badge: invalid > unsaved -->
            <span
              v-if="badge === 'invalid'"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium flex items-center gap-1"
              :title="!validation.valid ? validation.reason : ''"
            >
              <AlertTriangle :size="10" />
              Invalid
            </span>
            <span
              v-else-if="badge === 'unsaved'"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium"
            >
              Unsaved
            </span>
          </div>

          <div class="flex items-center">
            <Button
              variant="ghost"
              class="text-muted-foreground/40 hover:text-foreground transition-colors p-1"
              @click="copyValue()"
            >
              <Check v-if="copiedRaw" :size="13" class="text-green-500" />
              <Copy v-else :size="13" />
            </Button>
            <!-- Save button -->
            <!-- <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs mr-1"
              :disabled="!editFormValid || editSaving"
              @click="saveEdit()"
            >
              <RefreshCw
                v-if="editSaving"
                :size="12"
                class="animate-spin mr-1"
              />
              Save
            </Button> -->
            <div class="relative group">
              <Button
                variant="ghost"
                class="text-muted-foreground/40 hover:text-foreground transition-colors p-1 mr-4"
              >
                <Info :size="13" />
              </Button>
              <div
                class="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border/30 bg-surface-1 px-3 py-2 text-[11px] text-muted-foreground/60 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto"
              >
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span>Save</span><kbd class="font-mono text-foreground/50">Ctrl+S</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span>Search</span><kbd class="font-mono text-foreground/50">Ctrl+F</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span>Prev/Next</span><kbd class="font-mono text-foreground/50">Ctrl+↑↓</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-hidden flex flex-col">
        <div
          v-if="isCreate"
          class="flex items-center gap-3 px-6 py-3 border-b border-border/20 shrink-0"
        >
          <label class="text-xs text-muted-foreground/60 shrink-0 w-8">Key</label>
          <Input v-model="editKey" class="font-mono text-sm flex-1" placeholder="myKey" />
        </div>
        <div class="flex-1 overflow-hidden p-4">
          <JsonEditor ref="jsonEditorRef" v-model:value="editValue" />
        </div>
      </div>

      <div v-if="editError" class="px-6 py-2 border-t border-border/20 shrink-0">
        <div class="flex items-center gap-2 text-xs text-red-500">
          <AlertTriangle :size="14" />{{ editError }}
        </div>
      </div>

      <!-- Validation error bar -->
      <div
        v-if="!validation.valid"
        class="px-6 py-1.5 border-t border-red-500/20 bg-red-500/5 shrink-0 flex items-center gap-2 text-xs text-red-400"
      >
        <AlertTriangle :size="12" />
        <span class="font-mono">{{ !validation.valid ? validation.reason : "" }}</span>
      </div>
    </DialogContent>
  </Dialog>

  <!-- ── Delete Confirm ────────────────────────────────────────────────────── -->
  <Dialog v-model:open="showDeleteConfirm">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-red-500">
          <AlertTriangle :size="18" />Delete Entry
        </DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">
        Are you sure you want to delete
        <code class="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">{{
          deleteTargetKey
        }}</code
        >? This cannot be undone.
      </p>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="showDeleteConfirm = false">Cancel</Button>
        <Button variant="destructive" size="sm" @click="executeDelete()">Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
