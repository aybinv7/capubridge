/** A run of identical consecutive items shown as one row: `count` items from `first` to `last`. */
export interface RepeatRow<T> {
  key: string;
  first: T;
  last: T;
  count: number;
}

export interface RepeatRule<T> {
  keyOf(item: T): string;
  /** Whether `next` repeats `previous` closely enough to join its row. */
  same(previous: T, next: T): boolean;
}

/**
 * Builds and keeps rows of repeats over an append-only stream. Appending joins the last row or
 * starts a new one; dropping the oldest item shrinks the first row. Rows are replaced, never
 * mutated, so a view keyed on them re-renders exactly the rows that changed.
 */
export class RepeatRows<T> {
  rows: RepeatRow<T>[] = [];

  constructor(private readonly rule: RepeatRule<T>) {}

  reset(): void {
    this.rows = [];
  }

  push(item: T): void {
    const rows = this.rows;
    const tail = rows[rows.length - 1];
    if (tail && this.rule.same(tail.last, item)) {
      rows[rows.length - 1] = { ...tail, last: item, count: tail.count + 1 };
      return;
    }
    rows.push({ key: this.rule.keyOf(item), first: item, last: item, count: 1 });
  }

  /** Removes the oldest `count` kept items, shrinking or dropping rows from the front. */
  evict(count: number): void {
    let remaining = count;
    let gone = 0;
    while (remaining > 0 && gone < this.rows.length) {
      const head = this.rows[gone];
      if (!head) break;
      if (head.count > remaining) {
        this.rows[gone] = { ...head, count: head.count - remaining };
        remaining = 0;
        break;
      }
      remaining -= head.count;
      gone += 1;
    }
    if (gone > 0) this.rows.splice(0, gone);
  }
}
