import { computed, nextTick, ref, type Ref } from "vue";
import { recordPaneOpen } from "@/modules/storage/frame/recordPaneOpen";
import type { OpfsRow } from "./opfsModel";

interface GridHandle {
  focusRow: (rowId: string) => void;
  focus: () => void;
}

/**
 * Which file the pane shows: the grid's focused row, by path, never by position. When that file
 * leaves the folder (deleted, or gone after a read) the pane closes on it instead of sliding to
 * a neighbour.
 */
export function useOpfsPane(options: {
  rows: Ref<readonly OpfsRow[]>;
  /** Row ids in the order the grid shows them. */
  order: Ref<readonly string[]>;
  grid: Ref<GridHandle | null>;
}) {
  const open = recordPaneOpen;
  const activeId = ref<string | null>(null);

  const byId = computed(() => new Map(options.rows.value.map((row) => [row.id, row])));
  const row = computed(() => (activeId.value ? (byId.value.get(activeId.value) ?? null) : null));
  const index = computed(() => (row.value ? options.order.value.indexOf(row.value.id) : -1));
  const visible = computed(() => open.value && row.value !== null);
  const canPrev = computed(() => index.value > 0);
  const canNext = computed(() => index.value >= 0 && index.value < options.order.value.length - 1);

  function show(id: string) {
    activeId.value = id;
    open.value = true;
  }

  function follow(id: string) {
    activeId.value = id;
  }

  function step(direction: 1 | -1) {
    const target = options.order.value[index.value + direction];
    if (!target) return;
    activeId.value = target;
    options.grid.value?.focusRow(target);
  }

  function close() {
    open.value = false;
    void nextTick(() => options.grid.value?.focus());
  }

  return { open, activeId, row, index, visible, canPrev, canNext, show, follow, step, close };
}
