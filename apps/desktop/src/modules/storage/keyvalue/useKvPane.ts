import { computed, nextTick, ref, shallowRef, type Ref } from "vue";
import { recordPaneOpen } from "@/modules/storage/frame/recordPaneOpen";
import type { KvEntry } from "./kvModel";

interface GridHandle {
  focusRow: (rowId: string) => void;
  focus: () => void;
}

/**
 * Which key the pane shows: the grid's focused row, a new key being written, or — while an
 * edit is unsaved — the key as it was when the edit began. A held edit stays on screen when
 * the app changes or deletes that key, and says so, instead of being swapped or dropped.
 */
export function useKvPane(options: {
  entries: Ref<readonly KvEntry[]>;
  /** Row ids in the order the grid shows them. */
  order: Ref<readonly string[]>;
  grid: Ref<GridHandle | null>;
}) {
  const open = recordPaneOpen;
  const activeId = ref<string | null>(null);
  const creating = ref(false);
  const held = shallowRef<KvEntry | null>(null);
  const dirty = ref(false);

  const byId = computed(() => new Map(options.entries.value.map((entry) => [entry.id, entry])));
  const shownId = computed(() => held.value?.id ?? activeId.value);
  /** The key as the phone holds it now (`null` when it is gone). */
  const current = computed(() => (shownId.value ? (byId.value.get(shownId.value) ?? null) : null));
  /** The key the pane edits: as read when the edit began, else as read now. */
  const base = computed(() => (creating.value ? null : (held.value ?? current.value)));
  const index = computed(() => (base.value ? options.order.value.indexOf(base.value.id) : -1));
  const visible = computed(() => open.value && (creating.value || base.value !== null));
  const changedOnPhone = computed(
    () =>
      held.value !== null && current.value !== null && current.value.stored !== held.value.stored,
  );
  const goneFromPhone = computed(() => held.value !== null && current.value === null);
  const canPrev = computed(() => !dirty.value && index.value > 0);
  const canNext = computed(
    () => !dirty.value && index.value >= 0 && index.value < options.order.value.length - 1,
  );

  function setDirty(next: boolean) {
    dirty.value = next;
    held.value = next && !creating.value ? (held.value ?? current.value) : null;
  }

  function show(id: string) {
    if (dirty.value) return;
    creating.value = false;
    activeId.value = id;
    open.value = true;
  }

  function startCreate() {
    if (dirty.value) return;
    creating.value = true;
    open.value = true;
  }

  function step(direction: 1 | -1) {
    if (dirty.value) return;
    const target = options.order.value[index.value + direction];
    if (!target) return;
    activeId.value = target;
    options.grid.value?.focusRow(target);
  }

  /** Forgets the held edit (saved or discarded) and points the pane at `id`. */
  function settle(id: string | null) {
    dirty.value = false;
    held.value = null;
    creating.value = false;
    if (id) {
      activeId.value = id;
      void nextTick(() => options.grid.value?.focusRow(id));
    }
  }

  function close() {
    settle(null);
    open.value = false;
    void nextTick(() => options.grid.value?.focus());
  }

  return {
    open,
    activeId,
    creating,
    dirty,
    current,
    base,
    index,
    visible,
    changedOnPhone,
    goneFromPhone,
    canPrev,
    canNext,
    setDirty,
    show,
    startCreate,
    step,
    settle,
    close,
  };
}
