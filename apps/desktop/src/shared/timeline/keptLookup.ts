/** The read side of a ring buffer that a lookup needs. */
export interface KeptRing<T> {
  readonly size: number;
  first(): T | undefined;
  last(): T | undefined;
  forEach(visit: (item: T, index: number) => void): void;
}

/**
 * Answers "is this id still in the ring?" for a burst of questions (a moment preview asks up
 * to 20 at once) with one pass over the ring. The index lives until the end of the current
 * task, so a busy ring is never indexed twice for one preview and never held in memory after.
 */
export function keptLookup<T>(ring: KeptRing<T>, idOf: (item: T) => string) {
  let ids: Set<string> | null = null;
  let builtFor = "";

  function signature(): string {
    const first = ring.first();
    const last = ring.last();
    return `${ring.size}|${first ? idOf(first) : ""}|${last ? idOf(last) : ""}`;
  }

  return (id: string): boolean => {
    const current = signature();
    if (!ids || builtFor !== current) {
      const next = new Set<string>();
      ring.forEach((item) => next.add(idOf(item)));
      ids = next;
      builtFor = current;
      setTimeout(() => {
        ids = null;
      }, 0);
    }
    return ids.has(id);
  };
}
