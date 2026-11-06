<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from "vue";
import { refDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { Lock, PanelRight, Trash2 } from "lucide-vue-next";
import { Button, SearchField } from "@capubridge/cladd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  DataGrid,
  DataGridStatus,
  type GridContextAction,
  type GridContextTarget,
  type GridSort,
  type GridSummary,
} from "@/shared/components/data/grid";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { valueToWrite, type KvEditorMode } from "./kvEdit";
import { KEY_COLUMN, KV_COLUMNS, rowOf, shownEntries } from "./kvGrid";
import { entryIdFor, type KvEntry, type KvSource } from "./kvModel";
import { sourceLabel } from "./kvSources";
import KvPane from "./KvPane.vue";
import { useKvPane } from "./useKvPane";
import type { useKvWrites } from "./useKvWrites";

const NOTE_MS = 5000;

/**
 * Find, the keys of one list in the grid, the pane beside it and the status bar. Every delete
 * asks first; an unsaved edit is never dropped without asking.
 */
const props = defineProps<{
  source: KvSource;
  entries: readonly KvEntry[];
  loading: boolean;
  /** More keys exist than were read (LocalForage stores are read up to a limit). */
  more: boolean;
  total: number | null;
  writes: ReturnType<typeof useKvWrites>;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}>();

const find = ref("");
const findText = refDebounced(find, 150);
const searchBox = ref<HTMLElement | null>(null);
const grid = ref<InstanceType<typeof DataGrid> | null>(null);
const paneView = ref<InstanceType<typeof KvPane> | null>(null);
const sort = ref<GridSort | null>(null);
const editNote = ref<string | null>(null);
let noteTimer: ReturnType<typeof setTimeout> | undefined;
const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedRowIds: [],
  selectedCells: 0,
  aggregate: null,
});

const shown = computed(() => shownEntries(props.entries, findText.value, sort.value));
const rows = computed(() => shown.value.map(rowOf));
const order = computed(() => shown.value.map((entry) => entry.id));
const byId = computed(() => new Map(props.entries.map((entry) => [entry.id, entry])));
const listName = computed(() => sourceLabel(props.source));
const narrowed = computed(() => findText.value.trim() !== "");

const pane = useKvPane({ entries: computed(() => props.entries), order, grid });

const paneKey = computed(() =>
  pane.creating.value ? `${props.source.id}::new` : `${props.source.id}::${pane.base.value?.id}`,
);
const panePosition = computed(() => {
  if (pane.index.value < 0) return narrowed.value ? "Not in the rows shown" : null;
  return `${pane.index.value + 1} of ${shown.value.length}`;
});
const paneState = computed(() => {
  if (pane.goneFromPhone.value) return "Deleted on the phone after you began editing";
  if (pane.changedOnPhone.value) return "Changed on the phone after you began editing";
  return null;
});

function note(text: string) {
  editNote.value = text;
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(() => (editNote.value = null), NOTE_MS);
}

onBeforeUnmount(() => {
  if (noteTimer) clearTimeout(noteTimer);
});

/** Asks before an unsaved edit in the pane is dropped; `true` when it may go. */
async function guardDiscard(): Promise<boolean> {
  if (!pane.dirty.value) return true;
  const base = pane.base.value;
  const discard = await props.confirm({
    title: base ? `Discard changes to “${base.key}”?` : "Discard the new key?",
    text: "Your edit was not saved to the phone. Discarding drops it.",
    confirmLabel: "Discard changes",
    danger: true,
  });
  if (discard) {
    paneView.value?.discard();
    pane.settle(null);
  }
  return discard;
}

async function startEdit(rowId: string, columnId: string) {
  const entry = byId.value.get(rowId);
  if (!entry) return;
  if (props.writes.blockedReason.value) {
    note(props.writes.blockedReason.value);
    return;
  }
  if (pane.dirty.value && pane.base.value?.id !== rowId && !(await guardDiscard())) return;
  pane.show(rowId);
  if (entry.readOnlyReason) {
    note(entry.readOnlyReason);
    return;
  }
  await nextTick();
  void paneView.value?.edit(columnId === KEY_COLUMN ? "key" : "value");
}

async function startCreate() {
  if (!(await guardDiscard())) return;
  pane.startCreate();
}

function inspect(rowId: string) {
  if (!pane.dirty.value) pane.show(rowId);
}

function requestDelete(ids: readonly string[]) {
  const list = ids
    .map((id) => byId.value.get(id))
    .filter((entry): entry is KvEntry => entry !== undefined);
  void props.writes.confirmAndRemove(list, listName.value).then((removed) => {
    if (removed === 0) return;
    if (pane.base.value && list.some((entry) => entry.id === pane.base.value?.id)) {
      pane.settle(null);
    }
    grid.value?.clearSelection();
  });
}

async function savePane(request: { key: string; value: string; mode: KvEditorMode }) {
  const outcome = await props.writes.save({
    entry: pane.creating.value ? null : pane.base.value,
    key: request.key,
    value: valueToWrite(props.source.kind, request.mode, request.value),
  });
  if (outcome === "saved") pane.settle(entryIdFor(request.key));
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied the ${what}`);
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function contextActions(target: GridContextTarget): GridContextAction[] {
  const entry = target.rowId ? byId.value.get(target.rowId) : undefined;
  if (!entry) return [];
  const canWrite = props.writes.blockedReason.value === null;
  const actions: GridContextAction[] = [
    { id: "open", label: "Show in the pane", binding: "space", separatorBefore: true },
  ];
  if (canWrite && !entry.readOnlyReason) {
    actions.push({ id: "edit", label: "Edit the value", binding: "enter" });
    if (entry.keyIsText) actions.push({ id: "rename", label: "Rename the key" });
  }
  actions.push(
    { id: "copy-key", label: "Copy the key", separatorBefore: true },
    { id: "copy-value", label: "Copy the value as stored" },
  );
  if (canWrite) {
    const count = target.rowIds.length;
    actions.push({
      id: "delete",
      label: count > 1 ? `Delete ${count} keys…` : "Delete the key…",
      binding: "delete",
      danger: true,
      separatorBefore: true,
    });
  }
  return actions;
}

function runContextAction(actionId: string, target: GridContextTarget) {
  const entry = target.rowId ? byId.value.get(target.rowId) : undefined;
  if (!entry) return;
  if (actionId === "open") inspect(entry.id);
  else if (actionId === "edit") void startEdit(entry.id, "value");
  else if (actionId === "rename") void startEdit(entry.id, KEY_COLUMN);
  else if (actionId === "copy-key") void copyText(entry.key, "key");
  else if (actionId === "copy-value") void copyText(entry.stored, "value");
  else if (actionId === "delete") requestDelete(target.rowIds);
}

async function closePane() {
  if (await guardDiscard()) pane.close();
}

async function togglePane() {
  if (!pane.open.value) pane.open.value = true;
  else if (await guardDiscard()) pane.open.value = false;
}

function onPaneKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  event.stopPropagation();
  void closePane();
}

function focusFind() {
  const input = searchBox.value?.querySelector("input");
  input?.focus();
  input?.select();
}

defineExpose({ guardDiscard, startCreate, focusFind });
</script>

<template>
  <div class="flex shrink-0 items-center gap-1.5 px-3 py-2">
    <span ref="searchBox" class="contents">
      <SearchField
        v-model="find"
        size="sm"
        class="w-60 min-w-36 shrink"
        placeholder="Find a key or value"
        aria-label="Find a key or value"
      />
    </span>
    <span class="flex-1" />
    <IconAction
      v-if="writes.blockedReason.value === null && summary.selectedRows > 1"
      :label="`Delete ${summary.selectedRows} selected`"
      hint="Asks first"
      color="red"
      @click="requestDelete(summary.selectedRowIds)"
    >
      <Trash2 :stroke-width="1.8" />
    </IconAction>
  </div>

  <ResizablePanelGroup
    direction="horizontal"
    auto-save-id="capubridge:data-record-pane-size:v2"
    class="min-h-0 flex-1"
  >
    <ResizablePanel id="kv-rows-grid" :order="1" :min-size="35" class="min-h-0">
      <div class="h-full min-h-0 px-2 pb-2">
        <DataGrid
          ref="grid"
          :label="listName"
          :columns="KV_COLUMNS"
          :rows="rows"
          :loading="loading"
          :read-only="writes.blockedReason.value !== null"
          :sort="sort"
          :column-features="{ filter: false, group: false, showAs: false }"
          :context-actions="contextActions"
          :layout-key="`kv:${source.kind}`"
          @update:sort="sort = $event"
          @active-row="$event && pane.follow($event)"
          @inspect="inspect"
          @edit="startEdit"
          @delete="requestDelete"
          @summary="summary = $event"
          @context-action="runContextAction"
        >
          <template #empty>
            <div v-if="narrowed" class="flex flex-col items-start gap-2">
              <span>No key or value matches “{{ findText.trim() }}”.</span>
              <Button size="sm" variant="transparent" @click="find = ''">Clear find</Button>
            </div>
            <div v-else class="flex flex-col items-start gap-2">
              <span>{{ listName }} of this page is empty.</span>
              <Button
                v-if="writes.blockedReason.value === null"
                size="sm"
                variant="transparent"
                @click="startCreate"
              >
                Add a key
              </Button>
            </div>
          </template>
        </DataGrid>
      </div>
    </ResizablePanel>
    <template v-if="pane.visible.value">
      <ResizableHandle
        class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
      />
      <ResizablePanel
        id="kv-rows-pane"
        :order="2"
        size-unit="px"
        :default-size="380"
        :min-size="280"
        :max-size="560"
        class="min-h-0"
      >
        <div class="h-full min-h-0 pr-2 pb-2" @keydown="onPaneKeydown">
          <div
            class="h-full min-h-0 overflow-hidden rounded-cladd-md border border-cladd-outline bg-cladd-bg"
          >
            <KvPane
              ref="paneView"
              :key="paneKey"
              :kind="source.kind"
              :entry="pane.creating.value ? null : pane.base.value"
              :position="panePosition"
              :state-text="paneState"
              :blocked-reason="writes.blockedReason.value"
              :saving="writes.saving.value"
              :can-prev="pane.canPrev.value"
              :can-next="pane.canNext.value"
              @save="savePane"
              @delete="pane.base.value && requestDelete([pane.base.value.id])"
              @prev="pane.step(-1)"
              @next="pane.step(1)"
              @close="closePane"
              @dirty="pane.setDirty"
            />
          </div>
        </div>
      </ResizablePanel>
    </template>
  </ResizablePanelGroup>

  <DataGridStatus :summary="summary" :total="narrowed ? entries.length : null">
    <span v-if="editNote" class="flex min-w-0 items-center gap-1 text-foreground" role="status">
      <Lock :size="11" aria-hidden="true" class="shrink-0" />
      <span class="truncate">{{ editNote }}</span>
    </span>
    <span
      v-if="writes.progress.value"
      class="truncate text-foreground tabular-nums"
      role="status"
      aria-live="polite"
    >
      Deleting {{ writes.progress.value.done.toLocaleString("en-US") }} of
      {{ writes.progress.value.total.toLocaleString("en-US") }} keys
    </span>
    <span v-if="more && total !== null" class="truncate text-[var(--fg-subtle)]">
      First {{ entries.length.toLocaleString("en-US") }} of {{ total.toLocaleString("en-US") }} keys
      read
    </span>
    <HintTooltip v-if="writes.blockedReason.value" :text="writes.blockedReason.value">
      <span class="flex items-center gap-1" tabindex="0">
        <Lock :size="11" aria-hidden="true" />
        read-only
      </span>
    </HintTooltip>
    <IconAction
      :label="pane.open.value ? 'Hide the pane' : 'Show the pane'"
      size="sm"
      toggle
      :pressed="pane.open.value"
      @click="togglePane"
    >
      <PanelRight :stroke-width="1.8" />
    </IconAction>
  </DataGridStatus>
</template>
