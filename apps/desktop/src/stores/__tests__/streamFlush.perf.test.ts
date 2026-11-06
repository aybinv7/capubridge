import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { effectScope, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useRepeatRingView } from "@/composables/useRepeatRingView";
import { compileConsoleQuery } from "@/lib/console/consoleQuery";
import { ConsoleStreamView } from "@/lib/console/consoleStreamView";
import { compileLogcatQuery } from "@/lib/logcat/logcatQuery";
import { toLogcatEntry } from "@/lib/logcat/logcatEntry";
import { STREAM_CAPS } from "@/lib/stream-caps";
import type { ConsoleEntry } from "@/types/console.types";
import type { LogcatEntry, LogcatLevel } from "@/types/logcat.types";

vi.mock("@/stores/drawer.store", () => ({
  useDrawerStore: () => ({ noteArrivals: () => undefined }),
}));

vi.mock("@/stores/connection.store", () => ({
  useConnectionStore: () => ({ activeConnection: null, getClient: () => null }),
}));

vi.mock("@/stores/targets.store", () => ({
  useTargetsStore: () => ({ selectedTarget: null, targets: [] }),
}));

import { useConsoleStore } from "../console.store";
import { useLogcatStore } from "../logcat.store";

const FLUSH_BUDGET_MS = 4;
const LEVELS: LogcatLevel[] = ["V", "D", "I", "W", "E", "F"];
let seq = 0;

function logcatLines(count: number): LogcatEntry[] {
  const lines: LogcatEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    seq += 1;
    lines.push(
      toLogcatEntry("emulator-5554", {
        seq,
        tsMs: 1_730_000_000_000 + seq,
        uid: 10_000 + (seq % 40),
        pid: 1_000 + (seq % 40),
        tid: 1_000 + (seq % 7),
        level: LEVELS[seq % LEVELS.length] ?? "I",
        tag: `Tag${seq % 30}`,
        message: `request ${seq} finished in ${seq % 300} ms with status 200 and a typical payload`,
        processName: `com.example.app${seq % 40}`,
        packageName: `com.example.app${seq % 40}`,
      }),
    );
  }
  return lines;
}

function consoleEntries(count: number): ConsoleEntry[] {
  const entries: ConsoleEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    seq += 1;
    entries.push({
      seq,
      id: `t:runtime:${seq}`,
      targetId: "t",
      timestamp: seq,
      timestampLabel: "10:00:00",
      level: seq % 9 === 0 ? "error" : "log",
      source: "app.js:12",
      message: `render ${seq} took ${seq % 50} ms`,
      args: [],
      parentId: null,
      isGroup: false,
      groupCollapsed: false,
      origin: "runtime",
      type: "log",
      url: null,
      lineNumber: null,
      columnNumber: null,
    });
  }
  return entries;
}

function measure(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
    max: sorted.at(-1) ?? 0,
  };
}

/**
 * At 200 lines a second, Rust sends a batch every 50 ms (about 10 lines) and the frame batcher
 * flushes at most once a frame. These tests flush into full buffers, with a filtered view
 * mounted. The budget is 4 ms per flush; the assertion uses the 95th percentile because a
 * shared test runner adds garbage-collection and scheduling pauses that are not flush work. The
 * measured median, p99 and max are printed for the record.
 */
describe("stream flush cost", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("a logcat flush into a full 50,000-line ring stays under 4 ms", () => {
    const store = useLogcatStore();
    for (let filled = 0; filled < STREAM_CAPS.logcat; filled += 500) {
      store.flush(logcatLines(500));
    }
    const scope = effectScope();
    const predicate = ref(
      compileLogcatQuery("status 200 package:com.example.app7 level:I -tag:Tag3", {
        myPackage: "com.example.app7",
        hostTime: (entry) => entry.tsMs,
      }).predicate,
    );
    const rule = {
      keyOf: (entry: LogcatEntry) => entry.id,
      same: (a: LogcatEntry, b: LogcatEntry) => a.tag === b.tag && a.message === b.message,
    };
    const view = scope.run(() => useRepeatRingView(store, predicate, { rule }));
    if (!view) throw new Error("view not created");

    const steady: number[] = [];
    for (let round = 0; round < 400; round += 1) {
      const batch = logcatLines(10);
      steady.push(measure(() => store.flush(batch)));
    }
    const bursts: number[] = [];
    for (let round = 0; round < 120; round += 1) {
      const batch = logcatLines(500);
      bursts.push(measure(() => store.flush(batch)));
    }
    scope.stop();

    const steadyStats = summarize(steady.slice(20));
    const burstStats = summarize(bursts.slice(10));
    console.info("[perf] logcat flush, 10 lines into 50k ring (ms)", steadyStats);
    console.info("[perf] logcat flush, 500 lines into 50k ring (ms)", burstStats);
    expect(store.size).toBe(STREAM_CAPS.logcat);
    expect(steadyStats.p95).toBeLessThan(FLUSH_BUDGET_MS);
    expect(burstStats.p95).toBeLessThan(FLUSH_BUDGET_MS);
  });

  test("a console flush into a full 10,000-entry ring, with stream rows, stays under 4 ms", () => {
    const store = useConsoleStore();
    const query = compileConsoleQuery("level:verbose -url:cdn.test", {
      hostTime: (item) => item.time,
    });
    for (let filled = 0; filled < STREAM_CAPS.console; filled += 500) {
      store.flushEntries(consoleEntries(500));
    }

    const view = new ConsoleStreamView(() => ({
      entries: store.consoleSource.ring,
      exceptions: store.exceptionSource.ring,
      repl: store.replHistory,
      test: query.predicate,
      isExpanded: () => true,
    }));
    view.rebuild();
    const unsubscribe = store.consoleSource.feed.subscribe((change) => view.applyEntries(change));

    const samples: number[] = [];
    for (let round = 0; round < 200; round += 1) {
      const batch = consoleEntries(4);
      samples.push(measure(() => store.flushEntries(batch)));
    }
    const incremental = view.rows.map((row) => `${row.item.key}:${row.count}`).join();
    view.rebuild();
    expect(view.rows.map((row) => `${row.item.key}:${row.count}`).join()).toBe(incremental);
    const rebuilds: number[] = [];
    for (let round = 0; round < 30; round += 1) rebuilds.push(measure(() => view.rebuild()));
    unsubscribe();
    console.info("[perf] console full rebuild, 10k ring with a query (ms)", summarize(rebuilds));
    const stats = summarize(samples.slice(20));
    console.info("[perf] console flush + stream rows, 4 entries into 10k ring (ms)", stats);
    expect(store.levelCounts.all).toBe(STREAM_CAPS.console);
    expect(stats.p95).toBeLessThan(FLUSH_BUDGET_MS);
  });
});
