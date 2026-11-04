import { onMounted, onUnmounted } from "vue";
import type { Router } from "vue-router";

export const GO_SEQUENCE_TIMEOUT_MS = 1200;

export interface GoDestination {
  goKey?: string;
  path: string;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) {
    return true;
  }
  return target.closest(".monaco-editor, .xterm") !== null;
}

/**
 * Resolves Linear-style "G then key" navigation. Returns the next pending timestamp and,
 * when the sequence completes, the destination path.
 */
export function resolveGoKey(
  key: string,
  pendingSince: number | null,
  now: number,
  destinations: readonly GoDestination[],
): { pendingSince: number | null; path: string | null } {
  const normalized = key.toLowerCase();
  if (pendingSince !== null && now - pendingSince <= GO_SEQUENCE_TIMEOUT_MS) {
    const match = destinations.find((destination) => destination.goKey === normalized);
    return { pendingSince: null, path: match?.path ?? null };
  }
  if (normalized === "g") {
    return { pendingSince: now, path: null };
  }
  return { pendingSince: null, path: null };
}

export function useGoShortcuts(router: Router, destinations: readonly GoDestination[]): void {
  let pendingSince: number | null = null;

  function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isEditableTarget(event.target)) return;
    if (event.key.length !== 1) return;
    const result = resolveGoKey(event.key, pendingSince, performance.now(), destinations);
    pendingSince = result.pendingSince;
    if (result.path) {
      event.preventDefault();
      void router.push(result.path);
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onUnmounted(() => window.removeEventListener("keydown", onKeydown));
}
