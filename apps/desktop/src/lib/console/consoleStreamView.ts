import {
  buildConsoleStream,
  entryItem,
  exceptionItem,
  pushStreamRow,
  type ConsoleStreamInput,
  type ConsoleStreamItem,
  type ConsoleStreamRow,
} from "@/lib/console/consoleStream";
import type { StreamChange } from "@/lib/stream-feed";
import type { ConsoleEntry, ConsoleExceptionEntry } from "@/types/console.types";

/** How far from the front an evicted item's row is looked for before giving up and rebuilding. */
const EVICT_SCAN = 64;

/**
 * The Console view's rows, kept up to date per flush. Appends of top-level messages and
 * exceptions are applied in O(batch) and evictions shrink the first rows; anything that touches
 * a group tree falls back to one full rebuild.
 */
export class ConsoleStreamView {
  rows: ConsoleStreamRow[] = [];

  constructor(private readonly input: () => ConsoleStreamInput) {}

  rebuild(): void {
    this.rows = buildConsoleStream(this.input());
  }

  private evict(item: ConsoleStreamItem): boolean {
    const rows = this.rows;
    const limit = Math.min(rows.length, EVICT_SCAN);
    for (let index = 0; index < limit; index += 1) {
      const row = rows[index];
      if (!row) break;
      const covers = row.firstSeq <= item.seq && item.seq <= row.item.seq;
      if (covers && row.item.kind === item.kind) {
        if (row.count > 1) rows[index] = { ...row, count: row.count - 1, firstSeq: item.seq + 1 };
        else rows.splice(index, 1);
        return true;
      }
      if (row.firstSeq > item.seq) return true;
    }
    return rows.length === 0;
  }

  private apply<T>(
    change: StreamChange<T>,
    toItem: (value: T) => ConsoleStreamItem,
    isFlat: (value: T) => boolean,
  ): boolean {
    if (change.kind === "clear") return false;
    const { test } = this.input();
    for (const value of change.evicted) {
      if (!isFlat(value)) return false;
      const item = toItem(value);
      if ((!test || test(item)) && !this.evict(item)) return false;
    }
    const tail = this.rows[this.rows.length - 1];
    for (const value of change.items) {
      if (!isFlat(value)) return false;
      const item = toItem(value);
      if (tail && item.seq < tail.item.seq) return false;
      if (!test || test(item)) pushStreamRow(this.rows, item, 0);
    }
    return true;
  }

  /** Applies a console flush; returns false when it rebuilt instead. */
  applyEntries(change: StreamChange<ConsoleEntry>): boolean {
    if (this.apply(change, entryItem, (entry) => !entry.isGroup && entry.parentId === null)) {
      return true;
    }
    this.rebuild();
    return false;
  }

  /** Applies an exceptions flush; returns false when it rebuilt instead. */
  applyExceptions(change: StreamChange<ConsoleExceptionEntry>): boolean {
    if (this.apply(change, exceptionItem, () => true)) return true;
    this.rebuild();
    return false;
  }
}
