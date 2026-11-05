<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, ChevronUp, Lock, Trash2, X } from "lucide-vue-next";
import { Button, Segmented, SegmentedButton } from "@capubridge/cladd";
import JsonEditor from "@/shared/components/data/JsonEditor.vue";
import JsonDiff from "@/shared/code-viewer/JsonDiff.vue";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { readPersisted, writePersisted } from "@/lib/persisted";
import type { GridColumn } from "@/shared/components/data/grid";
import RecordFields from "./RecordFields.vue";

type PaneView = "fields" | "json" | "changes";

const VIEW_KEY = "capubridge:inspector-view";

/**
 * The record the grid points at, beside the grid instead of over it. Fields to read, JSON to
 * read and edit (Save writes to the source), Changes when the device changed it. While an
 * edit is unsaved the pane stays on its record (`dirty`), so moving in the grid never drops it.
 */
const props = defineProps<{
  title: string;
  subtitle?: string;
  stateText?: string | null;
  columns: readonly GridColumn[];
  cells: Readonly<Record<string, unknown>>;
  value: unknown;
  readOnlyReason: string | null;
  canDelete: boolean;
  /** The value before the device changed it, when it did. */
  before?: { value: unknown } | null;
  canPrev: boolean;
  canNext: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [value: unknown];
  delete: [];
  prev: [];
  next: [];
  close: [];
  dirty: [dirty: boolean];
}>();

const editor = ref<InstanceType<typeof JsonEditor> | null>(null);
const fieldsView = ref<InstanceType<typeof RecordFields> | null>(null);

const view = ref<PaneView>(
  readPersisted<PaneView>(VIEW_KEY, "fields", (v) => v === "fields" || v === "json"),
);
watch(view, (next) => {
  if (next !== "changes") writePersisted(VIEW_KEY, next);
});

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "undefined";
  } catch {
    return String(value);
  }
}

const original = computed(() => pretty(props.value));
const draft = ref(original.value);
const valid = ref(true);
const dirty = computed(() => draft.value !== original.value);
const editable = computed(() => props.readOnlyReason === null);

watch(original, (next, previous) => {
  if (draft.value === previous) draft.value = next;
});
watch(dirty, (next) => emit("dirty", next));
watch(
  () => props.before,
  (before) => {
    if (!before && view.value === "changes") view.value = "fields";
  },
);

function discard() {
  draft.value = original.value;
}

function save() {
  if (!dirty.value || !valid.value || !editable.value) return;
  try {
    emit("save", JSON.parse(draft.value));
  } catch {
    valid.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.altKey) return;
  if (event.key === "s" || event.key === "S") {
    event.preventDefault();
    save();
  } else if ((event.key === "f" || event.key === "F") && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    if (view.value === "json") editor.value?.focusFilter();
    else if (view.value === "fields") fieldsView.value?.focusFind();
  } else if (event.key === "ArrowUp" && props.canPrev && !dirty.value) {
    event.preventDefault();
    emit("prev");
  } else if (event.key === "ArrowDown" && props.canNext && !dirty.value) {
    event.preventDefault();
    emit("next");
  }
}

defineExpose({ discard });
</script>

<template>
  <section
    data-record-pane
    class="flex h-full min-h-0 flex-col"
    :aria-label="`Record ${title}`"
    @keydown="onKeydown"
  >
    <header class="flex shrink-0 items-start gap-2 border-b border-border-subtle py-2 pr-2 pl-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate font-mono text-xs text-foreground select-text">{{ title }}</span>
        <span class="flex min-w-0 items-center gap-2 text-2xs text-[var(--fg-subtle)]">
          <span v-if="subtitle" class="shrink-0 tabular-nums">{{ subtitle }}</span>
          <span v-if="stateText" class="truncate text-muted-foreground">{{ stateText }}</span>
          <span v-if="dirty" class="shrink-0 text-warning">Not saved</span>
        </span>
      </div>
      <IconAction
        label="Previous record"
        keys="mod+arrowup"
        size="sm"
        :disabled="!canPrev || dirty"
        @click="emit('prev')"
      >
        <ChevronUp :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Next record"
        keys="mod+arrowdown"
        size="sm"
        :disabled="!canNext || dirty"
        @click="emit('next')"
      >
        <ChevronDown :stroke-width="1.8" />
      </IconAction>
      <CopyAction :value="original" label="Copy as stored (JSON)" />
      <IconAction label="Close the record" keys="Escape" size="sm" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </header>

    <div class="flex shrink-0 items-center gap-2 px-3 py-1.5">
      <Segmented size="xs" active-variant="solid" aria-label="How to show the record">
        <SegmentedButton :active="view === 'fields'" @click="view = 'fields'"
          >Fields</SegmentedButton
        >
        <SegmentedButton :active="view === 'json'" @click="view = 'json'">
          {{ editable ? "Edit" : "JSON" }}
        </SegmentedButton>
        <SegmentedButton v-if="before" :active="view === 'changes'" @click="view = 'changes'">
          Changes
        </SegmentedButton>
      </Segmented>
    </div>

    <p
      v-if="readOnlyReason"
      class="mx-3 mb-1.5 flex shrink-0 items-start gap-1.5 rounded-inner bg-surface-cut px-2 py-1.5 text-2xs text-muted-foreground shadow-cut"
    >
      <Lock :size="11" class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{{ readOnlyReason }}</span>
    </p>

    <RecordFields v-if="view === 'fields'" ref="fieldsView" :columns="columns" :cells="cells" />
    <div v-else-if="view === 'json'" class="min-h-0 flex-1 px-2 pb-2">
      <JsonEditor
        ref="editor"
        v-model:value="draft"
        :readonly="!editable"
        @validity-change="valid = $event"
      />
    </div>
    <div v-else class="min-h-0 flex-1 px-2 pb-2">
      <JsonDiff :before-value="before?.value" :after-text="original" readonly />
    </div>

    <footer
      v-if="editable || canDelete"
      class="flex shrink-0 items-center gap-2 border-t border-border-subtle px-3 py-2"
    >
      <Button
        v-if="canDelete"
        size="sm"
        variant="transparent"
        color="red"
        content-class-name="gap-1.5"
        @click="emit('delete')"
      >
        <Trash2 :size="12" aria-hidden="true" />
        Delete
      </Button>
      <span class="flex-1" />
      <span v-if="dirty && !valid" class="text-2xs text-error">The JSON is not valid</span>
      <Button v-if="dirty" size="sm" variant="transparent" @click="discard">Discard</Button>
      <Button
        v-if="editable"
        size="sm"
        variant="solid-fill"
        :disabled="!dirty || !valid"
        :loading="saving"
        @click="save"
      >
        Save
      </Button>
    </footer>
  </section>
</template>
