export interface SerialQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * Runs async tasks one after another in call order, so overlapping requests (fast device
 * switching, mount and unmount racing) never interleave. A failed task does not block the next.
 */
export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.then(task, task);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}
