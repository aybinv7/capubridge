import { nextTick, onScopeDispose, shallowRef, watch, type Ref } from "vue";

/** Sections whose rows the timeline can scroll to and flash. */
export type RevealFocusKind = "console" | "exception" | "logcat";

interface FocusRequest {
  kind: RevealFocusKind;
  id: string;
  at: number;
}

/** A request older than this is dropped, so a later visit never jumps on its own. */
const REQUEST_TTL_MS = 4000;
/** How long a revealed row stays highlighted. */
export const FLASH_MS = 1600;

const pending = shallowRef<FocusRequest | null>(null);

/**
 * Asks the view of `kind` to bring row `id` into view and flash it. The view may not be
 * mounted yet (the dock is opening); it picks the request up when it mounts.
 */
export function requestRevealFocus(kind: RevealFocusKind, id: string) {
  pending.value = { kind, id, at: Date.now() };
}

export interface RevealFocusOptions<T> {
  /** The rows the view shows now, after its own filters. */
  rows: Ref<readonly T[]>;
  idOf: (row: T) => string;
  scrollToIndex: (index: number) => void;
  /** Clears the view's own filters, when they hide the row. */
  showAll?: () => void;
}

/**
 * Lets a list view answer the timeline's "Go to": it scrolls to the requested row and returns
 * the id to flash, cleared after {@link FLASH_MS}. Rows hidden by the view's filters are shown
 * by clearing them once.
 */
export function useRevealFocus<T>(kind: RevealFocusKind, options: RevealFocusOptions<T>) {
  const flashId = shallowRef<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let clearedFilters = false;

  function indexOf(id: string): number {
    return options.rows.value.findIndex((row) => options.idOf(row) === id);
  }

  function flash(id: string, index: number) {
    pending.value = null;
    void nextTick(() => {
      requestAnimationFrame(() => options.scrollToIndex(index));
    });
    flashId.value = id;
    if (flashTimer !== undefined) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashId.value = null;
    }, FLASH_MS);
  }

  function attempt() {
    const request = pending.value;
    if (!request || request.kind !== kind) return;
    if (Date.now() - request.at > REQUEST_TTL_MS) {
      pending.value = null;
      return;
    }
    const index = indexOf(request.id);
    if (index >= 0) {
      clearedFilters = false;
      flash(request.id, index);
      return;
    }
    if (options.showAll && !clearedFilters) {
      clearedFilters = true;
      options.showAll();
    }
  }

  watch(pending, attempt, { immediate: true });
  watch(options.rows, attempt);

  onScopeDispose(() => {
    if (flashTimer !== undefined) clearTimeout(flashTimer);
  });

  return flashId;
}
