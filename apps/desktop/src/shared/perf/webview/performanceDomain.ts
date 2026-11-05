import type { CDPClient } from "@capubridge/cdp-protocol";

/** A DevTools call that has not answered after this long is given up. */
export const PERFORMANCE_CALL_TIMEOUT_MS = 2000;

interface Holding {
  holders: number;
  /** Resolves with whether `Performance.enable` worked. */
  enabled: Promise<boolean>;
}

const holdings = new WeakMap<CDPClient, Holding>();

/**
 * Turns the page's Performance domain on for one more user of it. Several screens and a session
 * recording may read the same page; the domain is enabled once and stays on until the last of
 * them lets go, so leaving one screen never stops another's metrics.
 */
export function holdPerformance(client: CDPClient): Promise<boolean> {
  const existing = holdings.get(client);
  if (existing) {
    existing.holders += 1;
    return existing.enabled;
  }
  const enabled = client
    .send("Performance.enable", {}, undefined, { timeoutMs: PERFORMANCE_CALL_TIMEOUT_MS })
    .then(
      () => true,
      () => false,
    );
  holdings.set(client, { holders: 1, enabled });
  return enabled;
}

/** Lets go of the Performance domain; the last holder turns it off. */
export async function releasePerformance(client: CDPClient): Promise<void> {
  const holding = holdings.get(client);
  if (!holding) return;
  holding.holders -= 1;
  if (holding.holders > 0) return;
  holdings.delete(client);
  if (!(await holding.enabled) || holdings.has(client)) return;
  try {
    await client.send("Performance.disable", {}, undefined, {
      timeoutMs: PERFORMANCE_CALL_TIMEOUT_MS,
    });
  } catch (error) {
    console.warn("Could not turn the page's Performance domain off", error);
  }
}

/** How many users hold the domain on `client`, for tests. */
export function performanceHolders(client: CDPClient): number {
  return holdings.get(client)?.holders ?? 0;
}
