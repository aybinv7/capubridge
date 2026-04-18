<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Database,
  Diff,
  Eye,
  Layers3,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIDB } from "@/composables/useIDB";
import { useTargetsStore } from "@/stores/targets.store";
import type {
  IndexedDBChangeEntry,
  IndexedDBRecordChangeEntry,
} from "@/types/storageChanges.types";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import JsonViewer from "@/modules/storage/localstorage/JsonViewer.vue";

const targetsStore = useTargetsStore();
const storageContextStore = useStorageContextStore();
const changesStore = useIndexedDBChangesStore();
const { useDatabases } = useIDB();

const { data: databases } = useDatabases();

const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");
const selectedOrigin = computed({
  get: () => storageContextStore.getSelectedOrigin(targetId.value),
  set: (value: string) => storageContextStore.setSelectedOrigin(targetId.value, value),
});

const availableOrigins = computed(() => {
  const origins = new Set<string>();

  for (const database of databases.value ?? []) {
    origins.add(database.origin);
  }

  return Array.from(origins).sort((left, right) => left.localeCompare(right));
});

const search = ref("");
const operationFilter = ref("all");
const databaseFilter = ref("all");

const {
  session,
  status,
  error,
  changes,
  selectedChangeId,
  selectedChange,
  trackedStoreCount,
  untrackedStoreCount,
  totalTrackedRecords,
  recordChangeCount,
  lastEventAt,
  catalogEntries,
} = storeToRefs(changesStore);

const { selectChange, clearChanges } = changesStore;

const databaseOptions = computed(() =>
  Array.from(new Set(catalogEntries.value.map((entry) => entry.databaseName))).sort((left, right) =>
    left.localeCompare(right),
  ),
);

function isRecordChange(change: IndexedDBChangeEntry): change is IndexedDBRecordChangeEntry {
  return change.kind === "record";
}

const filteredChanges = computed(() => {
  const query = search.value.trim().toLowerCase();

  return changes.value.filter((change) => {
    if (operationFilter.value !== "all") {
      if (!isRecordChange(change) || change.operation !== operationFilter.value) {
        return false;
      }
    }

    if (databaseFilter.value !== "all" && change.databaseName !== databaseFilter.value) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      change.databaseName ?? "",
      change.objectStoreName ?? "",
      change.kind,
      isRecordChange(change) ? change.operation : "",
      isRecordChange(change) ? change.keyLabel : "",
      isRecordChange(change)
        ? change.fieldDiffs.map((entry) => entry.path).join(" ")
        : change.message,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

watch(
  availableOrigins,
  (origins) => {
    if (!selectedOrigin.value && origins.length > 0) {
      selectedOrigin.value = origins[0] ?? "";
    }
  },
  { immediate: true },
);

watch(filteredChanges, (entries) => {
  if (entries.length === 0) {
    return;
  }

  if (!entries.some((entry) => entry.id === selectedChangeId.value)) {
    selectChange(entries[0]!.id);
  }
});

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatChangeTitle(change: IndexedDBChangeEntry): string {
  if (!change.databaseName || !change.objectStoreName) {
    return "IndexedDB";
  }

  return `${change.databaseName}.${change.objectStoreName}`;
}

function getOperationLabel(change: IndexedDBChangeEntry): string {
  if (!isRecordChange(change)) return "System";
  return change.operation[0]!.toUpperCase() + change.operation.slice(1);
}

function getOperationClasses(change: IndexedDBChangeEntry): string {
  if (!isRecordChange(change)) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-400";
  }

  if (change.operation === "add") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  }

  if (change.operation === "delete") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-400";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-400";
}

function getOperationIcon(change: IndexedDBChangeEntry) {
  if (!isRecordChange(change)) return Activity;
  if (change.operation === "add") return ArrowUpRight;
  if (change.operation === "delete") return Trash2;
  return Diff;
}

const activeTargetTitle = computed(
  () => targetsStore.selectedTarget?.title ?? "No target selected",
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="shrink-0 border-b border-border/30 bg-surface-0 px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[18rem] items-center gap-2 rounded-xl border border-border/30 bg-surface-2 px-3 py-2"
        >
          <Database :size="14" class="text-muted-foreground/50" />
          <NativeSelect
            v-model="selectedOrigin"
            class="h-8 min-w-[14rem] border-0 bg-transparent px-0 py-0 text-xs font-mono shadow-none focus-visible:ring-0"
          >
            <option value="" disabled>Select origin</option>
            <option
              v-for="originOption in availableOrigins"
              :key="originOption"
              :value="originOption"
            >
              {{ originOption }}
            </option>
          </NativeSelect>
        </div>

        <Badge
          variant="outline"
          :class="status === 'tracking' ? 'border-emerald-500/20 text-emerald-400' : ''"
        >
          <RefreshCw v-if="status === 'priming'" class="animate-spin" />
          <Eye v-else-if="status === 'tracking'" />
          <AlertCircle v-else-if="status === 'error'" />
          <Layers3 v-else />
          {{ status }}
        </Badge>

        <div
          class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2 text-xs text-muted-foreground/60"
        >
          <span class="font-medium text-foreground/80">{{ trackedStoreCount }}</span>
          tracked stores
        </div>

        <div
          class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2 text-xs text-muted-foreground/60"
        >
          <span class="font-medium text-foreground/80">{{ untrackedStoreCount }}</span>
          oversized stores
        </div>

        <div
          class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2 text-xs text-muted-foreground/60"
        >
          <span class="font-medium text-foreground/80">{{ totalTrackedRecords }}</span>
          tracked rows
        </div>

        <div
          class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2 text-xs text-muted-foreground/60"
        >
          <span class="font-medium text-foreground/80">{{ recordChangeCount }}</span>
          detected row changes
        </div>

        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-muted-foreground/40">
            {{ session ? activeTargetTitle : "Waiting for target" }}
          </span>
          <Button variant="ghost" size="sm" class="h-8 text-xs" @click="clearChanges()">
            Clear feed
          </Button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[18rem] flex-1 items-center gap-2 rounded-xl border border-border/30 bg-surface-2 px-3 py-2"
        >
          <Search :size="14" class="text-muted-foreground/40" />
          <Input
            v-model="search"
            class="h-5 border-0 bg-transparent px-0 text-xs font-mono focus-visible:ring-0"
            placeholder="Search database, store, key, operation, or diff path…"
          />
        </div>

        <NativeSelect
          v-model="operationFilter"
          class="h-9 min-w-[9rem] rounded-xl border-border/30 bg-surface-2 text-xs"
        >
          <option value="all">All operations</option>
          <option value="add">Adds</option>
          <option value="update">Updates</option>
          <option value="delete">Deletes</option>
        </NativeSelect>

        <NativeSelect
          v-model="databaseFilter"
          class="h-9 min-w-[11rem] rounded-xl border-border/30 bg-surface-2 text-xs"
        >
          <option value="all">All databases</option>
          <option v-for="databaseName in databaseOptions" :key="databaseName" :value="databaseName">
            {{ databaseName }}
          </option>
        </NativeSelect>

        <span v-if="lastEventAt" class="text-xs text-muted-foreground/40">
          Last event {{ formatTimestamp(lastEventAt) }}
        </span>
      </div>

      <div
        v-if="error"
        class="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        {{ error }}
      </div>
    </div>

    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <ResizablePanel :default-size="46" :min-size="30" class="min-h-0">
        <ScrollArea class="h-full">
          <div
            v-if="status === 'priming' && filteredChanges.length === 0"
            class="flex h-full min-h-[18rem] items-center justify-center px-6 text-sm text-muted-foreground/40"
          >
            Capturing IndexedDB baselines for {{ selectedOrigin || "the active origin" }}…
          </div>

          <div
            v-else-if="filteredChanges.length === 0"
            class="flex h-full min-h-[18rem] items-center justify-center px-6 text-sm text-muted-foreground/35"
          >
            No IndexedDB changes captured yet.
          </div>

          <div v-else class="divide-y divide-border/20">
            <button
              v-for="change in filteredChanges"
              :key="change.id"
              class="w-full px-4 py-3 text-left transition-colors"
              :class="
                selectedChangeId === change.id
                  ? 'bg-surface-3'
                  : 'bg-transparent hover:bg-surface-2/70'
              "
              @click="selectChange(change.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" :class="getOperationClasses(change)">
                      <component :is="getOperationIcon(change)" />
                      {{ getOperationLabel(change) }}
                    </Badge>

                    <span class="truncate font-mono text-xs text-foreground/80">
                      {{ formatChangeTitle(change) }}
                    </span>
                  </div>

                  <p
                    v-if="isRecordChange(change)"
                    class="mt-2 truncate font-mono text-sm text-foreground/90"
                  >
                    {{ change.keyLabel }}
                  </p>

                  <p v-else class="mt-2 text-sm text-foreground/75">
                    {{ change.message }}
                  </p>

                  <div
                    class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/45"
                  >
                    <span>{{ formatTimestamp(change.observedAt) }}</span>
                    <span v-if="isRecordChange(change)"
                      >{{ change.fieldDiffs.length }} field diffs</span
                    >
                    <span
                      v-if="isRecordChange(change) && change.fieldDiffs.length > 0"
                      class="truncate font-mono"
                    >
                      {{ change.fieldDiffs[0]?.path }}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <ResizablePanel :default-size="54" :min-size="30" class="min-h-0">
        <div
          v-if="!selectedChange"
          class="flex h-full items-center justify-center px-6 text-sm text-muted-foreground/35"
        >
          Select a change to inspect its payload and field-level diff.
        </div>

        <div v-else class="flex h-full flex-col overflow-hidden">
          <div class="shrink-0 border-b border-border/30 bg-surface-0 px-5 py-4">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline" :class="getOperationClasses(selectedChange)">
                <component :is="getOperationIcon(selectedChange)" />
                {{ getOperationLabel(selectedChange) }}
              </Badge>

              <span class="font-mono text-xs text-muted-foreground/50">
                {{ formatChangeTitle(selectedChange) }}
              </span>

              <span class="text-xs text-muted-foreground/40">
                {{ formatTimestamp(selectedChange.observedAt) }}
              </span>
            </div>

            <div
              v-if="isRecordChange(selectedChange)"
              class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
            >
              <div class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2">
                <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35">Key</p>
                <p class="mt-1 truncate font-mono text-sm text-foreground/85">
                  {{ selectedChange.keyLabel }}
                </p>
              </div>

              <div class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2">
                <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35">
                  Operation
                </p>
                <p class="mt-1 text-sm text-foreground/85">{{ selectedChange.operation }}</p>
              </div>

              <div class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2">
                <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35">
                  Field Diffs
                </p>
                <p class="mt-1 text-sm text-foreground/85">
                  {{ selectedChange.fieldDiffs.length }}
                </p>
              </div>

              <div class="rounded-xl border border-border/30 bg-surface-2 px-3 py-2">
                <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35">
                  Source
                </p>
                <p class="mt-1 text-sm text-foreground/85">{{ selectedChange.source }}</p>
              </div>
            </div>

            <p v-else class="mt-3 text-sm text-foreground/75">
              {{ selectedChange.message }}
            </p>
          </div>

          <template v-if="isRecordChange(selectedChange)">
            <div class="shrink-0 border-b border-border/20 px-5 py-3">
              <div class="overflow-hidden rounded-xl border border-border/30 bg-surface-2">
                <div
                  class="grid grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
                >
                  <div class="border-r border-border/20 px-4 py-2">Before</div>
                  <div class="border-r border-border/20 px-4 py-2 text-center">Field</div>
                  <div class="px-4 py-2">After</div>
                </div>

                <div
                  v-if="selectedChange.fieldDiffs.length === 0"
                  class="px-4 py-3 text-sm text-muted-foreground/45"
                >
                  No nested field diff was needed for this change.
                </div>

                <div v-else class="max-h-48 overflow-auto">
                  <div
                    v-for="fieldDiff in selectedChange.fieldDiffs"
                    :key="`${fieldDiff.path}-${fieldDiff.type}`"
                    class="grid grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] border-t border-border/20 text-xs"
                  >
                    <div
                      class="border-r border-border/20 px-4 py-2 font-mono text-muted-foreground/60"
                    >
                      {{ fieldDiff.before === undefined ? "—" : JSON.stringify(fieldDiff.before) }}
                    </div>
                    <div
                      class="border-r border-border/20 px-4 py-2 text-center font-mono text-foreground/75"
                    >
                      {{ fieldDiff.path }}
                    </div>
                    <div class="px-4 py-2 font-mono text-foreground/75">
                      {{ fieldDiff.after === undefined ? "—" : JSON.stringify(fieldDiff.after) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
              <ResizablePanel :default-size="50" class="min-h-0">
                <div class="flex h-full flex-col overflow-hidden border-r border-border/20">
                  <div
                    class="shrink-0 px-5 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground/35"
                  >
                    Before Value
                  </div>
                  <div class="min-h-0 flex-1 overflow-hidden px-4 pb-4">
                    <div
                      v-if="selectedChange.beforeValue === undefined"
                      class="flex h-full items-center justify-center rounded-xl border border-dashed border-border/30 text-sm text-muted-foreground/35"
                    >
                      No previous value
                    </div>
                    <div
                      v-else
                      class="h-full overflow-hidden rounded-xl border border-border/30 bg-surface-2"
                    >
                      <JsonViewer :value="selectedChange.beforeValue" />
                    </div>
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle with-handle />

              <ResizablePanel :default-size="50" class="min-h-0">
                <div class="flex h-full flex-col overflow-hidden">
                  <div
                    class="shrink-0 px-5 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground/35"
                  >
                    After Value
                  </div>
                  <div class="min-h-0 flex-1 overflow-hidden px-4 pb-4">
                    <div
                      v-if="selectedChange.afterValue === undefined"
                      class="flex h-full items-center justify-center rounded-xl border border-dashed border-border/30 text-sm text-muted-foreground/35"
                    >
                      No current value
                    </div>
                    <div
                      v-else
                      class="h-full overflow-hidden rounded-xl border border-border/30 bg-surface-2"
                    >
                      <JsonViewer :value="selectedChange.afterValue" />
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </template>

          <div
            v-else
            class="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground/45"
          >
            System events describe tracker state changes such as new stores, removed stores, or
            stores that exceeded tracking limits.
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
