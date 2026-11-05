/** How often the request list may change on screen while events stream in (8 per second). */
export const NETWORK_FLUSH_MS = 125;

type Scheduler = (flush: () => void) => void;

function throttled(): Scheduler {
  let pending = false;
  return (flush) => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      flush();
    }, NETWORK_FLUSH_MS);
  };
}

let createScheduler: () => Scheduler = throttled;

/** Replaces the flush throttle for stores created afterwards (tests flush at once). */
export function setNetworkFlushScheduler(factory: () => Scheduler) {
  createScheduler = factory;
}

/** A scheduler that batches every change made within one throttle window into one flush. */
export function networkFlushScheduler(): Scheduler {
  return createScheduler();
}
