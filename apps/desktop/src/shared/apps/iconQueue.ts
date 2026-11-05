const MAX_IN_FLIGHT = 3;

interface Waiting {
  start: () => void;
  cancel: () => void;
  signal: AbortSignal | undefined;
}

let inFlight = 0;
const waiting: Waiting[] = [];

function abortError(): DOMException {
  return new DOMException("Icon request dropped", "AbortError");
}

function drain() {
  while (inFlight < MAX_IN_FLIGHT) {
    const next = waiting.pop();
    if (!next) return;
    if (next.signal?.aborted) {
      next.cancel();
      continue;
    }
    next.start();
  }
}

/**
 * Runs icon reads a few at a time, newest request first, so the rows on screen get theirs
 * before rows scrolled past. A request whose row went away (`signal` aborted) is dropped.
 */
export function queueIconRead<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entry: Waiting = {
      signal,
      cancel: () => reject(abortError()),
      start: () => {
        inFlight += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            inFlight -= 1;
            drain();
          });
      },
    };
    signal?.addEventListener(
      "abort",
      () => {
        const index = waiting.indexOf(entry);
        if (index < 0) return;
        waiting.splice(index, 1);
        entry.cancel();
      },
      { once: true },
    );
    waiting.push(entry);
    drain();
  });
}
