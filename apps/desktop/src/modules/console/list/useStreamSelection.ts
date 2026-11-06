import { shallowRef, type Ref } from "vue";

export interface PointerModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Row selection over keys: a click selects one row, Shift extends from the anchor, Ctrl or Cmd
 * adds or removes one. The cursor is the row keyboard keys act on. Keys survive rows being
 * appended or evicted; a key that is gone simply matches nothing.
 */
export function useStreamSelection<R>(rows: Ref<readonly R[]>, keyOf: (row: R) => string) {
  const selected = shallowRef<ReadonlySet<string>>(new Set());
  const cursor = shallowRef<string | null>(null);
  let anchor: string | null = null;

  function indexOf(key: string | null): number {
    if (key === null) return -1;
    return rows.value.findIndex((row) => keyOf(row) === key);
  }

  function rangeKeys(from: number, to: number): Set<string> {
    const keys = new Set<string>();
    const list = rows.value;
    for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1) {
      const row = list[index];
      if (row !== undefined) keys.add(keyOf(row));
    }
    return keys;
  }

  function select(key: string, modifiers: PointerModifiers = noModifiers) {
    if (modifiers.shiftKey && anchor !== null) {
      const from = indexOf(anchor);
      const to = indexOf(key);
      if (from >= 0 && to >= 0) {
        selected.value = rangeKeys(from, to);
        cursor.value = key;
        return;
      }
    }
    if (modifiers.ctrlKey || modifiers.metaKey) {
      const next = new Set(selected.value);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selected.value = next;
    } else {
      selected.value = new Set([key]);
    }
    anchor = key;
    cursor.value = key;
  }

  /** Moves the cursor by `delta` rows; with `extend`, the selection follows from the anchor. */
  function move(delta: number, extend: boolean): string | null {
    const list = rows.value;
    if (list.length === 0) return null;
    const current = indexOf(cursor.value);
    const start = current < 0 ? (delta > 0 ? -1 : list.length) : current;
    const nextIndex = Math.min(list.length - 1, Math.max(0, start + delta));
    const row = list[nextIndex];
    if (row === undefined) return null;
    const key = keyOf(row);
    select(key, { shiftKey: extend, ctrlKey: false, metaKey: false });
    return key;
  }

  function selectAll() {
    const list = rows.value;
    selected.value = rangeKeys(0, list.length - 1);
  }

  function clear(): boolean {
    if (selected.value.size === 0) return false;
    selected.value = new Set();
    anchor = null;
    return true;
  }

  /** The selected rows in list order. */
  function selectedRows(): R[] {
    const keys = selected.value;
    if (keys.size === 0) return [];
    return rows.value.filter((row) => keys.has(keyOf(row)));
  }

  return { selected, cursor, select, move, selectAll, clear, selectedRows };
}

const noModifiers: PointerModifiers = { shiftKey: false, ctrlKey: false, metaKey: false };
