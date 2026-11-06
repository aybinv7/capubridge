import { buildConsoleRows } from "@/lib/console/consoleRows";
import type { RingBuffer } from "@/lib/ring-buffer";
import type { ConsoleEntry, ConsoleExceptionEntry, ReplHistoryEntry } from "@/types/console.types";

/** One thing the Console view lists: a message, an uncaught exception, or a prompt line. */
export type ConsoleStreamItem =
  | { kind: "entry"; key: string; seq: number; time: number; entry: ConsoleEntry }
  | { kind: "exception"; key: string; seq: number; time: number; exception: ConsoleExceptionEntry }
  | { kind: "input"; key: string; seq: number; time: number; repl: ReplHistoryEntry }
  | { kind: "result"; key: string; seq: number; time: number; repl: ReplHistoryEntry };

/** A row of the Console view: an item, its group depth, and how many repeats it stands for. */
export interface ConsoleStreamRow {
  key: string;
  item: ConsoleStreamItem;
  depth: number;
  count: number;
  firstTime: number;
  /** Lowest sequence the row still stands for; repeats it lost to eviction are below it. */
  firstSeq: number;
}

const entryItems = new WeakMap<ConsoleEntry, ConsoleStreamItem>();
const exceptionItems = new WeakMap<ConsoleExceptionEntry, ConsoleStreamItem>();
const replItems = new WeakMap<ReplHistoryEntry, [ConsoleStreamItem, ConsoleStreamItem]>();

/** The stream item of a console entry, built once per entry. */
export function entryItem(entry: ConsoleEntry): ConsoleStreamItem {
  let item = entryItems.get(entry);
  if (!item) {
    item = { kind: "entry", key: entry.id, seq: entry.seq, time: entry.timestamp, entry };
    entryItems.set(entry, item);
  }
  return item;
}

export function exceptionItem(exception: ConsoleExceptionEntry): ConsoleStreamItem {
  let item = exceptionItems.get(exception);
  if (!item) {
    item = {
      kind: "exception",
      key: exception.id,
      seq: exception.seq,
      time: exception.timestamp,
      exception,
    };
    exceptionItems.set(exception, item);
  }
  return item;
}

/** The input and result rows of one prompt evaluation. */
export function replStreamItems(repl: ReplHistoryEntry): [ConsoleStreamItem, ConsoleStreamItem] {
  let items = replItems.get(repl);
  if (!items) {
    items = [
      { kind: "input", key: `${repl.id}:in`, seq: repl.seq, time: repl.timestamp, repl },
      { kind: "result", key: `${repl.id}:out`, seq: repl.resultSeq, time: repl.timestamp, repl },
    ];
    replItems.set(repl, items);
  }
  return items;
}

/** Whether `item` at `depth` repeats the row before it (same level, source and message). */
function repeats(tail: ConsoleStreamRow, item: ConsoleStreamItem, depth: number): boolean {
  const previous = tail.item;
  if (tail.depth !== depth || previous.kind !== item.kind) return false;
  if (previous.kind === "entry" && item.kind === "entry") {
    const a = previous.entry;
    const b = item.entry;
    return (
      !a.isGroup &&
      !b.isGroup &&
      a.level === b.level &&
      a.parentId === b.parentId &&
      a.source === b.source &&
      a.message === b.message
    );
  }
  if (previous.kind === "exception" && item.kind === "exception") {
    return (
      previous.exception.source === item.exception.source &&
      previous.exception.message === item.exception.message
    );
  }
  return false;
}

/** Appends `item` to `rows`, folding it into the last row when it repeats it. */
export function pushStreamRow(rows: ConsoleStreamRow[], item: ConsoleStreamItem, depth: number) {
  const last = rows.length - 1;
  const tail = rows[last];
  if (tail && repeats(tail, item, depth)) {
    rows[last] = { ...tail, item, count: tail.count + 1 };
    return;
  }
  rows.push({ key: item.key, item, depth, count: 1, firstTime: item.time, firstSeq: item.seq });
}

export interface ConsoleStreamInput {
  entries: RingBuffer<ConsoleEntry>;
  exceptions: RingBuffer<ConsoleExceptionEntry>;
  repl: readonly ReplHistoryEntry[];
  /** Keeps an item; null keeps everything. */
  test: ((item: ConsoleStreamItem) => boolean) | null;
  isExpanded: (entry: ConsoleEntry) => boolean;
}

/**
 * The Console view's rows: messages (with their group tree), uncaught exceptions and prompt
 * lines, merged in the order they happened, with consecutive repeats folded into one row that
 * keeps the first time and the latest item. One pass over each source.
 */
export function buildConsoleStream(input: ConsoleStreamInput): ConsoleStreamRow[] {
  const test = input.test;
  const messages = buildConsoleRows(input.entries, {
    test: test ? (entry) => test(entryItem(entry)) : null,
    isExpanded: input.isExpanded,
  });

  const others: ConsoleStreamItem[] = [];
  input.exceptions.forEach((exception) => {
    const item = exceptionItem(exception);
    if (!test || test(item)) others.push(item);
  });
  for (const repl of input.repl) {
    for (const item of replStreamItems(repl)) {
      if (!test || test(item)) others.push(item);
    }
  }
  others.sort((a, b) => a.seq - b.seq);

  const rows: ConsoleStreamRow[] = [];
  let next = 0;
  for (const message of messages) {
    const item = entryItem(message.entry);
    while (next < others.length && (others[next]?.seq ?? Infinity) < item.seq) {
      const other = others[next];
      if (other) pushStreamRow(rows, other, 0);
      next += 1;
    }
    pushStreamRow(rows, item, message.depth);
  }
  for (; next < others.length; next += 1) {
    const other = others[next];
    if (other) pushStreamRow(rows, other, 0);
  }
  return rows;
}
