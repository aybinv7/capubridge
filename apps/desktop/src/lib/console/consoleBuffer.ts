import { RingBuffer } from "@/lib/ring-buffer";
import { STREAM_CAPS } from "@/lib/stream-caps";
import { createStreamFeed, type StreamFeed } from "@/lib/stream-feed";
import type { ConsoleEntry, ConsoleExceptionEntry } from "@/types/console.types";

export interface ConsoleLevelCounts {
  all: number;
  error: number;
  warn: number;
  info: number;
  verbose: number;
}

function emptyCounts(): ConsoleLevelCounts {
  return { all: 0, error: 0, warn: 0, info: 0, verbose: 0 };
}

function countKey(entry: ConsoleEntry): keyof ConsoleLevelCounts {
  return entry.level === "log" || entry.level === "debug" ? "verbose" : entry.level;
}

export interface ConsoleBuffer {
  readonly entries: RingBuffer<ConsoleEntry>;
  readonly exceptions: RingBuffer<ConsoleExceptionEntry>;
  readonly entryFeed: StreamFeed<ConsoleEntry>;
  readonly exceptionFeed: StreamFeed<ConsoleExceptionEntry>;
  appendEntries(batch: readonly ConsoleEntry[]): void;
  appendExceptions(batch: readonly ConsoleExceptionEntry[]): void;
  clearEntries(): void;
  clearExceptions(): void;
  /** A kept console group by id, without scanning the buffer. */
  findGroup(id: string): ConsoleEntry | undefined;
  counts(): ConsoleLevelCounts;
}

/**
 * Console and exception entries in rings of {@link STREAM_CAPS}. Level counts and the group
 * index follow what each append adds and evicts, and every change is published on a feed.
 */
export function createConsoleBuffer(): ConsoleBuffer {
  const entries = new RingBuffer<ConsoleEntry>(STREAM_CAPS.console);
  const exceptions = new RingBuffer<ConsoleExceptionEntry>(STREAM_CAPS.exceptions);
  const entryFeed = createStreamFeed<ConsoleEntry>("console");
  const exceptionFeed = createStreamFeed<ConsoleExceptionEntry>("exceptions");
  const groups = new Map<string, ConsoleEntry>();
  let counts = emptyCounts();

  return {
    entries,
    exceptions,
    entryFeed,
    exceptionFeed,
    appendEntries(batch) {
      if (batch.length === 0) {
        return;
      }
      const evicted = entries.pushAll(batch);
      for (const entry of batch) {
        counts.all += 1;
        counts[countKey(entry)] += 1;
        if (entry.isGroup) {
          groups.set(entry.id, entry);
        }
      }
      for (const entry of evicted) {
        counts.all -= 1;
        counts[countKey(entry)] -= 1;
        if (entry.isGroup) {
          groups.delete(entry.id);
        }
      }
      entryFeed.emit({ kind: "append", items: batch, evicted });
    },
    appendExceptions(batch) {
      if (batch.length === 0) {
        return;
      }
      const evicted = exceptions.pushAll(batch);
      exceptionFeed.emit({ kind: "append", items: batch, evicted });
    },
    clearEntries() {
      entries.clear();
      groups.clear();
      counts = emptyCounts();
      entryFeed.emit({ kind: "clear" });
    },
    clearExceptions() {
      exceptions.clear();
      exceptionFeed.emit({ kind: "clear" });
    },
    findGroup(id) {
      return groups.get(id);
    },
    counts() {
      return { ...counts };
    },
  };
}
