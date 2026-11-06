export interface EventFeed<E> {
  /** Calls `listener` for every later event; returns the unsubscribe function. */
  subscribe(listener: (event: E) => void): () => void;
  emit(event: E): void;
}

/**
 * A synchronous typed event fan-out. A listener that throws is reported and skipped, so one
 * broken consumer never stops the others or the emitter.
 */
export function createEventFeed<E>(name: string): EventFeed<E> {
  const listeners = new Set<(event: E) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`[${name}] a listener failed`, error);
        }
      }
    },
  };
}
