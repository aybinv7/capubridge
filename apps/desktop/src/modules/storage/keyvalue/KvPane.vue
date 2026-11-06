<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { ChevronDown, ChevronUp, Lock, Trash2, X } from "lucide-vue-next";
import { Button, Input, Segmented, SegmentedButton } from "@capubridge/cladd";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { formatBytes } from "@/shared/format/numbers";
import {
  draftProblem,
  initialDraft,
  initialMode,
  keyProblem,
  lineBreakNote,
  originalText,
  restoreLineBreaks,
  typeChange,
  type KvEditorMode,
} from "./kvEdit";
import type { KvEntry, KvSourceKind } from "./kvModel";
import KvValueEditor from "./KvValueEditor.vue";
import KvValueRead from "./KvValueRead.vue";

/**
 * One key beside the list: its value to read, or to edit and save (Ctrl+S). The key can be
 * renamed from Edit; a new key starts in Edit. While an edit is unsaved the pane stays on its
 * key (`dirty`) and never swaps the draft for what the phone holds now.
 */
const props = defineProps<{
  kind: KvSourceKind;
  /** The key as read; `null` while a new key is written. */
  entry: KvEntry | null;
  position: string | null;
  /** What happened on the phone since the edit began. */
  stateText: string | null;
  /** Why writes wait now (app away, list still being read). */
  blockedReason: string | null;
  saving: boolean;
  canPrev: boolean;
  canNext: boolean;
}>();

const emit = defineEmits<{
  save: [request: { key: string; value: string; mode: KvEditorMode }];
  delete: [];
  prev: [];
  next: [];
  close: [];
  dirty: [dirty: boolean];
}>();

const creating = computed(() => props.entry === null);
const readOnlyReason = computed(() => props.entry?.readOnlyReason ?? null);
const view = ref<"value" | "edit">(creating.value ? "edit" : "value");
const findSignal = ref(0);
const keyField = ref<HTMLElement | null>(null);
const editor = ref<InstanceType<typeof KvValueEditor> | null>(null);

const baseMode = computed(() => initialMode(props.kind, props.entry));
const baseDraft = computed(() => initialDraft(props.kind, props.entry, baseMode.value));
const original = computed(() => originalText(props.kind, props.entry, baseMode.value));
const lineNote = computed(() => lineBreakNote(original.value));
const baseKey = computed(() => props.entry?.key ?? "");

const mode = ref<KvEditorMode>(baseMode.value);
const draft = ref("");
const keyDraft = ref(baseKey.value);
/** The draft is built only when Edit opens: reading a value never formats it for editing. */
const drafted = ref(false);

function startDraft() {
  if (drafted.value) return;
  mode.value = baseMode.value;
  draft.value = baseDraft.value;
  keyDraft.value = baseKey.value;
  drafted.value = true;
}

const dirty = computed(() => {
  if (creating.value) return keyDraft.value !== "" || draft.value !== "";
  if (!drafted.value) return false;
  return (
    keyDraft.value !== baseKey.value ||
    draft.value !== baseDraft.value ||
    (props.kind === "forage" && mode.value !== baseMode.value)
  );
});
const settledDraft = refDebounced(draft, 200);
const problem = computed(() => {
  if (mode.value !== "json") return null;
  if (settledDraft.value.trim() === "") return "Type a JSON value, or switch to Text";
  return draftProblem(settledDraft.value, "json") ? "The JSON is not valid" : null;
});
const typeWarning = computed(() =>
  dirty.value && problem.value === null
    ? typeChange(props.kind, props.entry, mode.value, settledDraft.value)
    : null,
);
const renames = computed(() => !creating.value && keyDraft.value !== baseKey.value);
const keyIssue = computed(() => keyProblem(keyDraft.value));
const canSave = computed(
  () =>
    readOnlyReason.value === null &&
    props.blockedReason === null &&
    keyIssue.value === null &&
    problem.value === null &&
    (creating.value || dirty.value),
);

watch(
  () => (drafted.value ? [baseDraft.value, baseKey.value, baseMode.value] : null),
  () => {
    if (!drafted.value || dirty.value) return;
    mode.value = baseMode.value;
    draft.value = baseDraft.value;
    keyDraft.value = baseKey.value;
  },
);
watch(
  view,
  (next) => {
    if (next === "edit") startDraft();
  },
  { immediate: true },
);
watch(dirty, (next) => emit("dirty", next), { immediate: true });

const subtitle = computed(() => {
  if (!props.entry) return "New key";
  const parts = [props.entry.typeLabel, formatBytes(props.entry.size)];
  if (props.position) parts.unshift(props.position);
  return parts.join(" · ");
});

function discard() {
  mode.value = baseMode.value;
  draft.value = drafted.value ? baseDraft.value : "";
  keyDraft.value = baseKey.value;
}

function save() {
  if (!canSave.value) return;
  if (draftProblem(draft.value, mode.value)) {
    view.value = "edit";
    return;
  }
  emit("save", {
    key: keyDraft.value,
    value: restoreLineBreaks(original.value, draft.value),
    mode: mode.value,
  });
}

function focusKey() {
  keyField.value?.querySelector("input")?.focus();
}

/** Opens Edit with the key or the value in focus. */
async function edit(field: "key" | "value") {
  if (readOnlyReason.value) return;
  view.value = "edit";
  await nextTick();
  if (field === "key") focusKey();
  else editor.value?.focus();
}

onMounted(() => {
  if (creating.value) void edit("key");
});

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    save();
  } else if (key === "f" && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    if (view.value === "edit") editor.value?.focusFind();
    else findSignal.value += 1;
  } else if (event.key === "ArrowUp" && props.canPrev) {
    event.preventDefault();
    emit("prev");
  } else if (event.key === "ArrowDown" && props.canNext) {
    event.preventDefault();
    emit("next");
  }
}

defineExpose({ discard, edit });
</script>

<template>
  <section
    data-record-pane
    class="flex h-full min-h-0 flex-col"
    :aria-label="entry ? `Key ${entry.key}` : 'New key'"
    @keydown="onKeydown"
  >
    <header class="flex shrink-0 items-start gap-2 border-b border-border-subtle py-2 pr-2 pl-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate font-mono text-xs text-foreground select-text">
          {{ entry ? entry.key : "New key" }}
        </span>
        <span class="flex min-w-0 items-center gap-2 text-2xs text-[var(--fg-subtle)]">
          <span class="shrink-0 tabular-nums">{{ subtitle }}</span>
          <span v-if="stateText" class="truncate text-muted-foreground">{{ stateText }}</span>
          <span v-if="dirty && !creating" class="shrink-0 text-warning">Not saved</span>
        </span>
      </div>
      <template v-if="entry">
        <IconAction
          label="Previous key"
          keys="mod+arrowup"
          size="sm"
          :disabled="!canPrev"
          @click="emit('prev')"
        >
          <ChevronUp :stroke-width="1.8" />
        </IconAction>
        <IconAction
          label="Next key"
          keys="mod+arrowdown"
          size="sm"
          :disabled="!canNext"
          @click="emit('next')"
        >
          <ChevronDown :stroke-width="1.8" />
        </IconAction>
        <CopyAction :value="entry.stored" label="Copy the value as stored" />
      </template>
      <IconAction label="Close" keys="Escape" size="sm" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </header>

    <div v-if="entry" class="flex shrink-0 items-center gap-2 px-3 py-1.5">
      <Segmented size="xs" active-variant="solid" aria-label="How to show the key">
        <SegmentedButton :active="view === 'value'" @click="view = 'value'">Value</SegmentedButton>
        <SegmentedButton v-if="!readOnlyReason" :active="view === 'edit'" @click="view = 'edit'">
          Edit
        </SegmentedButton>
      </Segmented>
    </div>

    <p
      v-if="readOnlyReason"
      class="mx-3 mb-1.5 flex shrink-0 items-start gap-1.5 rounded-inner bg-surface-cut px-2 py-1.5 text-2xs text-muted-foreground shadow-cut"
    >
      <Lock :size="11" class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{{ readOnlyReason }} It can still be deleted.</span>
    </p>

    <KvValueRead v-if="view === 'value' && entry" :entry="entry" :find-signal="findSignal" />
    <div v-else class="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-1 pb-2">
      <div ref="keyField" class="flex shrink-0 flex-col gap-1">
        <label class="text-2xs text-muted-foreground">Key</label>
        <Input
          v-model="keyDraft"
          size="sm"
          input-class-name="font-mono"
          :disabled="entry !== null && !entry.keyIsText"
          :aria-label="entry ? `Key of ${entry.key}` : 'Key of the new value'"
          placeholder="Key"
        />
        <span v-if="entry && !entry.keyIsText" class="text-2xs text-[var(--fg-subtle)]">
          This key is not text, so it cannot be renamed here.
        </span>
        <span v-else-if="renames && !keyIssue" class="text-2xs text-muted-foreground">
          Saving renames “{{ entry?.key }}” to “{{ keyDraft }}”.
        </span>
        <span v-else-if="keyIssue && (renames || keyDraft !== '')" class="text-2xs text-error">
          {{ keyIssue }}
        </span>
      </div>
      <KvValueEditor
        ref="editor"
        v-model:mode="mode"
        v-model:draft="draft"
        :kind="kind"
        :key-label="keyDraft || 'the new key'"
        :line-note="lineNote"
      />
    </div>

    <p
      v-if="blockedReason && (view === 'edit' || creating)"
      class="mx-3 mb-1.5 flex shrink-0 items-start gap-1.5 text-2xs text-muted-foreground"
    >
      <Lock :size="11" class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{{ blockedReason }}</span>
    </p>

    <footer class="flex shrink-0 items-center gap-2 border-t border-border-subtle px-3 py-2">
      <Button
        v-if="entry"
        size="sm"
        variant="transparent"
        color="red"
        content-class-name="gap-1.5"
        :disabled="blockedReason !== null"
        @click="emit('delete')"
      >
        <Trash2 :size="12" aria-hidden="true" />
        Delete
      </Button>
      <span class="flex-1" />
      <span v-if="problem" class="truncate text-2xs text-error">{{ problem }}</span>
      <HintTooltip v-else-if="typeWarning" :text="typeWarning">
        <span class="truncate text-2xs text-warning" tabindex="0" role="status">
          {{ typeWarning }}
        </span>
      </HintTooltip>
      <Button v-if="dirty && !creating" size="sm" variant="transparent" @click="discard">
        Discard
      </Button>
      <Button
        v-if="!readOnlyReason"
        size="sm"
        variant="solid-fill"
        :disabled="!canSave"
        :loading="saving"
        @click="save"
      >
        {{ creating ? "Add key" : "Save" }}
      </Button>
    </footer>
  </section>
</template>
