/** What changed in a ring-backed stream in one flush. */
export type StreamChange<T> =
  | { kind: "append"; items: readonly T[]; evicted: readonly T[] }
  | { kind: "clear" };

export type StreamListener<T> = (change: StreamChange<T>) => void;

export interface StreamFeed<T> {
  /** Calls `listener` for every later change; returns the unsubscribe function. */
  subscribe(listener: StreamListener<T>): () => void;
  emit(change: StreamChange<T>): void;
}

/**
 * A small synchronous fan-out for stream changes. A listener that throws is reported and
 * skipped, so one broken consumer never stops the others or the stream.
 */
export function createStreamFeed<T>(name: string): StreamFeed<T> {
  const listeners = new Set<StreamListener<T>>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(change) {
      for (const listener of listeners) {
        try {
          listener(change);
        } catch (error) {
          console.error(`[${name}] a stream listener failed`, error);
        }
      }
    },
  };
}
