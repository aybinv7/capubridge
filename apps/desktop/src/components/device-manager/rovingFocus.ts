export type RovingKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

const ROVING_KEYS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

export function isRovingKey(key: string): key is RovingKey {
  return ROVING_KEYS.has(key);
}

/** The index focus moves to; wraps at both ends. `current` -1 means nothing is focused yet. */
export function nextRovingIndex(current: number, length: number, key: RovingKey): number {
  if (length <= 0) return -1;
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return length - 1;
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % length;
    case "ArrowUp":
      return current < 0 ? length - 1 : (current - 1 + length) % length;
  }
}

export const ROVING_ITEM_SELECTOR = "[data-roving-item]:not([disabled])";

/**
 * Moves focus between the `[data-roving-item]` elements inside `container` for arrow, Home and
 * End keys. Returns true when it handled the key, so the caller can stop the event.
 */
export function moveRovingFocus(container: HTMLElement, key: string): boolean {
  if (!isRovingKey(key)) return false;
  const items = Array.from(container.querySelectorAll<HTMLElement>(ROVING_ITEM_SELECTOR));
  if (items.length === 0) return false;
  const active = document.activeElement;
  const current = items.findIndex((item) => item === active || item.contains(active));
  items[nextRovingIndex(current, items.length, key)]?.focus();
  return true;
}
