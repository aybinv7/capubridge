import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { useResizeObserver } from "@vueuse/core";
import { readPersisted, writePersisted } from "@/lib/persisted";
import {
  columnWidth,
  fitColumns,
  gridTemplate,
  isColumnLayout,
  isHiddenByChoice,
  resizeEdge,
  resizeLimit,
  type ColumnLayoutState,
  type ListColumn,
} from "./listColumns";

const STORAGE_PREFIX = "capubridge:network:columns:";

export interface ListColumnsOptions<Id extends string> {
  /** Names the list in storage (`requests`, `mock-rules`, `mock-log`). */
  key: string;
  columns: readonly ListColumn<Id>[];
  /** The header row: its content box is the width every row lays its columns out in. */
  measure: Readonly<Ref<HTMLElement | null>>;
  /** Columns the context hides for now, with the reason the Columns menu gives. */
  blocked?: MaybeRefOrGetter<Partial<Record<Id, string>>>;
}

/**
 * Column layout for a Network list: widths people drag and columns they hide (persisted per
 * list), columns that step aside when the list is narrow, and the one grid template the header
 * and rows share. Dragging only changes the template, so rows do not re-render while it moves.
 */
export function useListColumns<Id extends string>(options: ListColumnsOptions<Id>) {
  const storageKey = `${STORAGE_PREFIX}${options.key}:v1`;
  const state = shallowRef<ColumnLayoutState>(
    readPersisted<ColumnLayoutState>(storageKey, { widths: {}, hidden: {} }, isColumnLayout),
  );
  const available = ref(0);
  const resizing = ref<Id | null>(null);

  useResizeObserver(options.measure, (entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    if (Math.abs(width - available.value) >= 1) available.value = width;
  });

  const reasons = computed<Partial<Record<Id, string>>>(() => toValue(options.blocked) ?? {});
  const blockedIds = computed(() => new Set(Object.keys(reasons.value) as Id[]));
  const fitted = computed(() =>
    fitColumns(options.columns, state.value, available.value, blockedIds.value),
  );
  const shown = computed(() => fitted.value.shown);
  const dropped = computed(() => fitted.value.dropped);
  const template = computed(() => gridTemplate(shown.value, state.value));

  function commit(next: ColumnLayoutState) {
    state.value = next;
    writePersisted(storageKey, next);
  }

  function isHidden(id: Id): boolean {
    const column = options.columns.find((candidate) => candidate.id === id);
    return column ? isHiddenByChoice(column, state.value) : false;
  }

  function setHidden(id: Id, hidden: boolean) {
    commit({ ...state.value, hidden: { ...state.value.hidden, [id]: hidden } });
  }

  function showAll() {
    const hidden: Record<string, boolean> = {};
    for (const column of options.columns) if (column.defaultHidden) hidden[column.id] = false;
    commit({ ...state.value, hidden });
  }

  function edgeOf(id: Id): "start" | "end" | null {
    return resizeEdge(shown.value, id);
  }

  function setWidth(id: Id, width: number) {
    state.value = { ...state.value, widths: { ...state.value.widths, [id]: Math.round(width) } };
  }

  function resetWidth(id: Id) {
    const widths = { ...state.value.widths };
    delete widths[id];
    commit({ ...state.value, widths });
  }

  let stopResize: (() => void) | null = null;

  /** Follows the pointer from a header handle until it is released, then keeps the width. */
  function startResize(id: Id, event: PointerEvent) {
    const edge = edgeOf(id);
    const column = shown.value.find((candidate) => candidate.id === id);
    if (!edge || !column) return;
    stopResize?.();
    const startX = event.clientX;
    const startWidth = columnWidth(column, state.value);
    const limit = resizeLimit(shown.value, state.value, id, available.value);
    const direction = edge === "end" ? 1 : -1;
    let frame = 0;
    let pending = startWidth;
    const onMove = (move: PointerEvent) => {
      pending = Math.min(
        limit,
        Math.max(column.minWidth, startWidth + (move.clientX - startX) * direction),
      );
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setWidth(id, pending);
      });
    };
    const onUp = () => stopResize?.();
    stopResize = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setWidth(id, pending);
      document.body.style.cursor = "";
      resizing.value = null;
      stopResize = null;
      writePersisted(storageKey, state.value);
    };
    resizing.value = id;
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  onBeforeUnmount(() => stopResize?.());

  return {
    shown,
    dropped,
    reasons,
    template,
    resizing,
    isHidden,
    setHidden,
    showAll,
    edgeOf,
    widthOf: (column: ListColumn<Id>) => columnWidth(column, state.value),
    startResize,
    resetWidth,
  };
}

export type ListColumnsLayout<Id extends string> = ReturnType<typeof useListColumns<Id>>;
