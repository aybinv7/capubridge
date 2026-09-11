import { nextTick } from "vue";

/**
 * Runs a DOM-mutating callback inside the View Transition API when the
 * browser and the user's motion preference both allow it, so the change
 * animates instead of popping. Falls back to a plain call everywhere else.
 *
 * document.startViewTransition() snapshots the "after" state as soon as its
 * callback returns (or the promise it returns resolves) - but a synchronous
 * Vue ref assignment only *schedules* the DOM patch, it does not apply it
 * before returning. Without awaiting nextTick() here, the API captures its
 * "after" screenshot on the still-unpatched DOM, so it animates between two
 * identical frames and the real change pops in a moment later once Vue
 * actually flushes - a flicker with no visible transition. Wrapping the
 * mutation as an async callback that awaits nextTick() closes that gap.
 *
 * The spec also allows a new transition to supersede one still in flight
 * (e.g. stepping through the gallery faster than the animation finishes) -
 * the superseded transition's promises then reject with an InvalidStateError
 * that is expected, not a bug, so it is swallowed rather than left uncaught.
 */
export function withViewTransition(mutate: () => void): void {
  const supported =
    typeof document !== "undefined" && typeof document.startViewTransition === "function";
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supported || reducedMotion) {
    mutate();
    return;
  }

  const transition = document.startViewTransition!(async () => {
    mutate();
    await nextTick();
  });
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch(() => {});
  transition.finished.catch(() => {});
}
