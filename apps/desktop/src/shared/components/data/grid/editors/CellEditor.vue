<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { editorText, parseCellEdit, type CellEditorKind } from "./cellEdit";

/**
 * The inline editor a grid cell opens with. Enter or leaving the field commits, Escape
 * cancels; nothing is emitted when the value did not change, so a stray click never writes.
 */
const props = defineProps<{
  value: unknown;
  kind: CellEditorKind;
  label: string;
  /** Another value of the column, so an empty cell is filled in the column's form. */
  like?: unknown;
}>();

const emit = defineEmits<{ commit: [value: unknown]; cancel: [] }>();

const field = ref<HTMLInputElement | HTMLSelectElement | null>(null);
const text = ref(editorText(props.value, props.kind));
const error = ref<string | null>(null);
let settled = false;

const inputType = computed(() => (props.kind === "date" ? "date" : "text"));

onMounted(async () => {
  await nextTick();
  field.value?.focus();
  if (field.value instanceof HTMLInputElement && props.kind !== "date") field.value.select();
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
  if (event.key === "Enter") {
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
