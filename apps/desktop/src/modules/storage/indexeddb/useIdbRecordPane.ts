import { computed, nextTick, ref, watch, type Ref } from "vue";
import type { GridRow } from "@/shared/components/data/grid";
import { readPersisted, writePersisted } from "@/lib/persisted";

const PANE_KEY = "capubridge:data-record-pane";

const paneOpen = ref(readPersisted<boolean>(PANE_KEY, true, (value) => typeof value === "boolean"));
watch(paneOpen, (value) => writePersisted(PANE_KEY, value));

/** Shows or hides the record pane wherever it is mounted (palette command). */
export function toggleRecordPane() {
  paneOpen.value = !paneOpen.value;
}

interface GridHandle {
  focusRow: (rowId: string) => void;
  focus: () => void;
}

/**
 * Which record the pane shows: the grid's focused row, or — while an edit is unsaved — the
 * record being edited. Prev/next move the grid's focus, and cross into the next or previous
 * page at the edges.
 */
export function useIdbRecordPane(options: {
  rows: Ref<readonly GridRow[]>;
  grid: Ref<GridHandle | null>;
  page: Ref<number>;
  hasMore: Ref<boolean>;
  pagingEnabled: Ref<boolean>;
  setPage: (page: number) => void;
}) {
  const open = paneOpen;

  const activeRowId = ref<string | null>(null);
  const pinnedRowId = ref<string | null>(null);
  const pendingFocus = ref<"first" | "last" | null>(null);

  const rowId = computed(() => pinnedRowId.value ?? activeRowId.value);
  const index = computed(() => options.rows.value.findIndex((row) => row.id === rowId.value));
  const visible = computed(() => open.value && rowId.value !== null);

  watch(options.rows, (rows) => {
    if (pendingFocus.value && rows.length > 0) {
      const target = pendingFocus.value === "first" ? rows[0] : rows[rows.length - 1];
      pendingFocus.value = null;
      if (target) {
        activeRowId.value = target.id;
        void nextTick(() => options.grid.value?.focusRow(target.id));
      }
      return;
    }
    if (pinnedRowId.value && !rows.some((row) => row.id === pinnedRowId.value)) {
      pinnedRowId.value = null;
    }
  });

  const canPrev = computed(
    () =>
      index.value > 0 ||
      (index.value === 0 && options.pagingEnabled.value && options.page.value > 0),
  );
  const canNext = computed(
    () =>
      (index.value >= 0 && index.value < options.rows.value.length - 1) ||
      (index.value === options.rows.value.length - 1 &&
        options.pagingEnabled.value &&
        options.hasMore.value),
  );

  function step(direction: 1 | -1) {
    const rows = options.rows.value;
    const target = rows[index.value + direction];
    if (target) {
      activeRowId.value = target.id;
      options.grid.value?.focusRow(target.id);
      return;
    }
    if (!options.pagingEnabled.value) return;
    if (direction === 1 && options.hasMore.value) {
      pendingFocus.value = "first";
      options.setPage(options.page.value + 1);
    } else if (direction === -1 && options.page.value > 0) {
      pendingFocus.value = "last";
      options.setPage(options.page.value - 1);
    }
  }

  function setDirty(dirty: boolean) {
    pinnedRowId.value = dirty ? rowId.value : null;
  }

  function show(id: string) {
    activeRowId.value = id;
    open.value = true;
  }

  function close() {
    pinnedRowId.value = null;
    open.value = false;
    void nextTick(() => options.grid.value?.focus());
  }

  return {
    open,
    visible,
    rowId,
    activeRowId,
    index,
    canPrev,
    canNext,
    step,
    setDirty,
    show,
    close,
  };
}
