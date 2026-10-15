import type { Observation } from "@/types/automation.types";

/**
 * Longest a settled observation may wait to be reused as the next decision's
 * before-snapshot. Between a settle and the next decision the loop only does
 * bookkeeping, so anything older means something slow ran in between and the
 * screen may have moved on.
 */
export const CARRY_MAX_AGE_MS = 1_000;

/**
 * Hands a quiescent settled observation to the next decision instead of
 * reading the device again. A fused observation costs a full UIAutomator
 * dump, which already waits for UI idle, so re-reading a screen that just
 * settled returns the same snapshot seconds later.
 *
 * A carry is consumed exactly once: any further read in the same decision,
 * and every settle or retry read, goes to the device.
 */
export interface ObservationCarry {
  observe(): Promise<Observation>;
  offer(observation: Observation): void;
  clear(): void;
}

export function createObservationCarry(
  read: () => Promise<Observation>,
  now: () => number,
): ObservationCarry {
  let carried: { observation: Observation; at: number } | null = null;
  return {
    observe: () => {
      const held = carried;
      carried = null;
      if (held !== null && now() - held.at <= CARRY_MAX_AGE_MS) {
        return Promise.resolve(held.observation);
      }
      return read();
    },
    offer: (observation) => {
      carried = { observation, at: now() };
    },
    clear: () => {
      carried = null;
    },
  };
}
