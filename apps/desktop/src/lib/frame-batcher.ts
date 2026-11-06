export interface FrameBatcher<T> {
  push(item: T): void;
  last(): T | undefined;
  flushNow(): void;
  clear(): void;
}

const hiddenFlushDelayMs = 250;

/**
 * Coalesces high-frequency items into one flush per animation frame, falling back to a
 * timer while the document is hidden (rAF is paused there). `maxPending` bounds what one
 * flush receives; the oldest items are dropped first. Overflow is trimmed in amortised
 * chunks, never by copying the queue on every push.
 */
export function createFrameBatcher<T>(
  flush: (batch: T[]) => void,
  maxPending: number,
): FrameBatcher<T> {
  let pending: T[] = [];
  let frameHandle: number | null = null;
  let timerHandle: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (frameHandle !== null) {
      cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    if (timerHandle !== null) {
      clearTimeout(timerHandle);
      timerHandle = null;
    }
  }

  function run() {
    frameHandle = null;
    timerHandle = null;
    if (pending.length === 0) {
      return;
    }
    const batch =
      pending.length > maxPending ? pending.slice(pending.length - maxPending) : pending;
    pending = [];
    flush(batch);
  }

  function schedule() {
    if (frameHandle !== null || timerHandle !== null) {
      return;
    }
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden || typeof requestAnimationFrame === "undefined") {
      timerHandle = setTimeout(run, hiddenFlushDelayMs);
      return;
    }
    frameHandle = requestAnimationFrame(run);
  }

  return {
    push(item) {
      pending.push(item);
      if (pending.length >= maxPending * 2) {
        pending.splice(0, pending.length - maxPending);
      }
      schedule();
    },
    last() {
      return pending.at(-1);
    },
    flushNow() {
      cancel();
      run();
    },
    clear() {
      cancel();
      pending = [];
    },
  };
}
