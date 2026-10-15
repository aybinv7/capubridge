/**
 * Deep-link seek helpers for the replay lane.
 *
 * Automation links a failing step as `/replay?file=X&t=NNN`. These are the
 * pure parts of honouring that link, kept out of `ReplayView.vue` so they can
 * be tested without mounting the view.
 */

/**
 * Reads a `?t=` query value. Anything that is not a non-negative finite
 * number is rejected rather than coerced, so `?t=abc` opens the session at
 * the start instead of at `NaN`.
 */
export function parseSeekMs(value: unknown): number | null {
  if (typeof value !== "string" || value === "") return null;
  const ms = Number(value);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/**
 * Resolves the offset to seek to, clamped to the session. A null target is
 * the start, and a target past the end lands on the end rather than leaving
 * the clock beyond its own duration.
 */
export function resolveSeekMs(target: number | null, durationMs: number): number {
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  if (target === null) return 0;
  return Math.min(target, duration);
}
