<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { bindingTokens } from "@/lib/commands/keymap";
import { editorText, parseCellEdit, type CellEditorKind } from "./cellEdit";

/**
 * The inline editor a grid cell opens with. Enter or leaving the field commits, Escape
 * cancels; nothing is emitted when the value did not change, so a stray click never writes.
 * Text with line breaks opens a text area over the cell instead (a one-line field would drop
 * them): Enter adds a line there, and Ctrl+Enter commits.
 */
const props = defineProps<{
  value: unknown;
  kind: CellEditorKind;
  label: string;
  /** Another value of the column, so an empty cell is filled in the column's form. */
  like?: unknown;
}>();

const emit = defineEmits<{ commit: [value: unknown]; cancel: [] }>();

const PANEL_MIN_WIDTH = 360;
const PANEL_MARGIN = 8;

const anchor = ref<HTMLElement | null>(null);
const field = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
const text = ref(editorText(props.value, props.kind));
const error = ref<string | null>(null);
const panelBox = ref<{ left: number; top: number; width: number } | null>(null);
let settled = false;

const inputType = computed(() => (props.kind === "date" ? "date" : "text"));
const multiline = computed(() => props.kind === "multiline");
const panelStyle = computed(() =>
  panelBox.value
    ? {
        left: `${panelBox.value.left}px`,
        top: `${panelBox.value.top}px`,
        width: `${panelBox.value.width}px`,
      }
    : { visibility: "hidden" as const },
);

function placePanel() {
  const box = anchor.value?.getBoundingClientRect();
  if (!box) return;
  const width = Math.min(
    Math.max(box.width, PANEL_MIN_WIDTH),
    window.innerWidth - PANEL_MARGIN * 2,
  );
  const left = Math.min(Math.max(box.left, PANEL_MARGIN), window.innerWidth - width - PANEL_MARGIN);
  panelBox.value = { left, top: Math.max(box.top, PANEL_MARGIN), width };
}

onMounted(async () => {
  if (multiline.value) {
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
  }
  await nextTick();
  field.value?.focus();
  if (field.value instanceof HTMLInputElement && props.kind !== "date") field.value.select();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", placePanel);
  window.removeEventListener("scroll", placePanel, true);
});

function finish(commitChange: boolean) {
  if (settled) return;
  if (!commitChange) {
    settled = true;
    emit("cancel");
    return;
  }
  const parsed = parseCellEdit(props.value, props.kind, text.value, props.like);
  if (!parsed.ok) {
    error.value = parsed.error;
    return;
  }
  settled = true;
  if (parsed.changed) emit("commit", parsed.value);
  else emit("cancel");
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation();
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === "Enter" && (!multiline.value || mod)) {
    event.preventDefault();
    finish(true);
  } else if (event.key === "Escape") {
    event.preventDefault();
    finish(false);
  } else if (props.kind === "number" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    const current = Number(text.value);
    const step = Number.isInteger(current) ? 1 : 0.1;
    const next =
      (Number.isFinite(current) ? current : 0) + (event.key === "ArrowUp" ? step : -step);
    text.value = step < 1 ? next.toFixed(1) : String(next);
  }
}

function onBlur() {
  if (error.value) {
    finish(false);
    return;
  }
  finish(true);
}
</script>

<template>
  <span
    ref="anchor"
    data-grid-editor
    class="relative flex h-full w-full items-center"
    @pointerdown.stop
    @dblclick.stop
    @contextmenu.stop
  >
    <select
      v-if="kind === 'boolean'"
      ref="field"
      v-model="text"
      :aria-label="label"
      class="h-full w-full rounded-cladd-3xs bg-cladd-surface-cut px-1.5 font-mono text-cladd-xs text-cladd-fg outline-none shadow-[inset_0_0_0_1.5px_var(--cladd-primary)]"
      @keydown="onKeydown"
      @blur="onBlur"
    >
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
    <template v-else-if="multiline">
      <span class="truncate text-cladd-xs text-cladd-fg-soft">Editing several lines…</span>
      <Teleport to="body">
        <div
          data-grid-editor
          class="fixed z-50 flex flex-col gap-1 rounded-cladd-xs bg-popover p-1 shadow-float"
          :style="panelStyle"
          @pointerdown.stop
          @contextmenu.stop
        >
          <textarea
            ref="field"
            v-model="text"
            rows="8"
            :aria-label="label"
            spellcheck="false"
            class="block max-h-[60vh] min-h-24 w-full resize-y rounded-cladd-3xs bg-cladd-surface-cut px-1.5 py-1 text-cladd-xs text-cladd-fg outline-none shadow-[inset_0_0_0_1.5px_var(--cladd-primary)]"
            @keydown="onKeydown"
            @blur="onBlur"
          />
          <div
            class="flex items-center gap-1.5 px-1 text-2xs text-muted-foreground"
            @pointerdown.prevent
          >
            <KeyCaps :keys="bindingTokens('mod+enter')" quiet />
            <span>keeps the change,</span>
            <KeyCaps :keys="bindingTokens('escape')" quiet />
            <span>drops it. Line breaks are kept as they were.</span>
          </div>
        </div>
      </Teleport>
    </template>
    <input
      v-else
      ref="field"
      v-model="text"
      :type="inputType"
      :inputmode="kind === 'number' ? 'decimal' : undefined"
      :aria-label="label"
      :aria-invalid="error ? 'true' : undefined"
      class="h-full w-full min-w-0 rounded-cladd-3xs bg-cladd-surface-cut px-1.5 text-cladd-xs text-cladd-fg outline-none"
      :class="[
        kind === 'text' ? '' : 'font-mono tabular-nums',
        error
          ? 'shadow-[inset_0_0_0_1.5px_var(--state-danger)]'
          : 'shadow-[inset_0_0_0_1.5px_var(--cladd-primary)]',
      ]"
      @keydown="onKeydown"
      @blur="onBlur"
      @input="error = null"
    />
    <span
      v-if="error"
      role="alert"
      class="absolute top-full left-0 z-50 mt-0.5 rounded-cladd-3xs bg-popover px-1.5 py-0.5 text-2xs whitespace-nowrap text-error shadow-float"
    >
      {{ error }}
    </span>
  </span>
</template>
