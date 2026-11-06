<script setup lang="ts" generic="R">
import { computed, toRef, useId } from "vue";
import NewLinesPill from "./NewLinesPill.vue";
import { ROW_HEIGHT, useStreamList } from "./useStreamList";
import { useStreamSelection } from "./useStreamSelection";

/**
 * The drawer's virtual stream list: 22 px rows that open into detail, follow-the-end with an
 * "N new" pill, row selection (click, Shift, Ctrl), a keyboard cursor, Ctrl+C and Ctrl+A.
 * Rows and what they look like come from the view through slots.
 */
const props = withDefaults(
  defineProps<{
    rows: readonly R[];
    /** Moves whenever `rows` changed in place; lists rebuilt as new arrays may leave it at 0. */
    revision?: number;
    keyOf: (row: R) => string;
    following: boolean;
    expanded: ReadonlySet<string>;
    label: string;
    pending?: number;
    pendingLabel?: string;
    flashKey?: string | null;
    /** False for lists that do not grow at the end (grouped errors): no following, no pill. */
    tail?: boolean;
  }>(),
  { revision: 0, pending: 0, pendingLabel: "new lines", flashKey: null, tail: true },
);

const emit = defineEmits<{
  leaveTail: [];
  reachTail: [];
  toggle: [key: string];
  copy: [rows: R[]];
  menu: [row: R];
}>();

defineSlots<{
  row(props: { row: R; selected: boolean; active: boolean; expanded: boolean }): unknown;
  detail(props: { row: R }): unknown;
}>();

const listId = useId();
const rows = toRef(props, "rows");
const following = computed(() => props.tail && props.following);
const list = useStreamList({
  rows,
  revision: toRef(props, "revision"),
  keyOf: props.keyOf,
  following,
  onLeaveTail: () => emit("leaveTail"),
  onReachTail: () => emit("reachTail"),
});
const selection = useStreamSelection(rows, props.keyOf);
const { scroller, items, totalSize, measure } = list;

const activeId = computed(() =>
  selection.cursor.value ? `${listId}-${selection.cursor.value}` : undefined,
);

function rowAt(key: string): R | undefined {
  return props.rows.find((row) => props.keyOf(row) === key);
}

function reveal(key: string) {
  const index = props.rows.findIndex((row) => props.keyOf(row) === key);
  if (index >= 0) list.virtualizer.value.scrollToIndex(index, { align: "auto" });
}

function onClick(row: R, event: MouseEvent) {
  const key = props.keyOf(row);
  const plain = !event.shiftKey && !event.ctrlKey && !event.metaKey;
  if (plain && window.getSelection()?.toString()) return;
  selection.select(key, event);
  if (plain) emit("toggle", key);
}

function onContextMenu(row: R) {
  const key = props.keyOf(row);
  if (!selection.selected.value.has(key)) selection.select(key);
  emit("menu", row);
}

function copySelection() {
  const chosen = selection.selectedRows();
  const cursorRow = selection.cursor.value ? rowAt(selection.cursor.value) : undefined;
  const picked = chosen.length > 0 ? chosen : cursorRow !== undefined ? [cursorRow] : [];
  if (picked.length > 0) emit("copy", picked);
}

function visibleRowCount(): number {
  const element = scroller.value;
  return element ? Math.max(1, Math.floor(element.clientHeight / ROW_HEIGHT) - 1) : 10;
}

function step(delta: number, extend: boolean) {
  const key = selection.move(delta, extend);
  if (key) reveal(key);
}

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === "c") {
    if (window.getSelection()?.toString()) return;
    event.preventDefault();
    copySelection();
    return;
  }
  if (mod && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selection.selectAll();
    return;
  }
  switch (event.key) {
    case "ArrowDown":
    case "ArrowUp":
      event.preventDefault();
      step(event.key === "ArrowDown" ? 1 : -1, event.shiftKey);
      return;
    case "PageDown":
    case "PageUp":
      event.preventDefault();
      step((event.key === "PageDown" ? 1 : -1) * visibleRowCount(), event.shiftKey);
      return;
    case "Home":
      event.preventDefault();
      step(-props.rows.length, event.shiftKey);
      return;
    case "End":
      event.preventDefault();
      emit("reachTail");
      list.scrollToEnd();
      return;
    case "Enter":
    case " ": {
      const key = selection.cursor.value;
      if (!key) return;
      event.preventDefault();
      emit("toggle", key);
      return;
    }
    case "Escape":
      if (selection.clear()) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    default:
      return;
  }
}

function resume() {
  emit("reachTail");
  list.scrollToEnd();
}

defineExpose({
  scrollToKey(key: string) {
    const index = props.rows.findIndex((row) => props.keyOf(row) === key);
    if (index >= 0) list.scrollToIndex(index);
  },
  focus() {
    scroller.value?.focus({ preventScroll: true });
  },
  clearSelection: () => selection.clear(),
});
</script>

<template>
  <div class="relative min-h-0 flex-1">
    <div
      ref="scroller"
      class="absolute inset-0 overflow-auto outline-none [contain:strict] focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-inset"
      tabindex="0"
      role="listbox"
      aria-multiselectable="true"
      :aria-label="props.label"
      :aria-activedescendant="activeId"
      @keydown="onKeydown"
    >
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <div
          v-for="item in items"
          :id="`${listId}-${item.key}`"
          :key="item.key"
          :ref="(element) => measure(element as Element | null)"
          :data-index="item.index"
          role="option"
          :aria-selected="selection.selected.value.has(item.key)"
          :aria-expanded="props.expanded.has(item.key)"
          class="absolute top-0 left-0 w-full"
          :class="props.flashKey === item.key ? 'reveal-flash' : ''"
          :style="{ transform: `translateY(${item.start}px)` }"
          @click="onClick(item.row, $event)"
          @dblclick="emit('copy', [item.row])"
          @contextmenu.capture="onContextMenu(item.row)"
        >
          <slot
            name="row"
            :row="item.row"
            :selected="selection.selected.value.has(item.key)"
            :active="selection.cursor.value === item.key"
            :expanded="props.expanded.has(item.key)"
          />
          <div v-if="props.expanded.has(item.key)" @click.stop>
            <slot name="detail" :row="item.row" />
          </div>
        </div>
      </div>
    </div>
    <NewLinesPill
      v-if="props.tail && !props.following"
      :count="props.pending"
      :label="props.pendingLabel"
      @resume="resume"
    />
  </div>
</template>
