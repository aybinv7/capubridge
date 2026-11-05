import { describe, expect, test } from "vite-plus/test";
import { captureWord, emptyCopy } from "../requests/captureState";
import {
  formatBytes,
  formatMs,
  initiatorWord,
  requestName,
  sizeCell,
  statusCell,
  timeCell,
} from "../requests/requestCells";
import { requestsSummary } from "../requests/requestFilters";
import { nextSort, sortRequests } from "../requests/requestSort";
import { waterfallBar, waterfallRange } from "../requests/waterfall";
import { networkEntry } from "./fixtures";

describe("request cells", () => {
  test("bytes and durations read like DevTools", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024)).toBe("20 KB");
    expect(formatMs(0.4)).toBe("<1 ms");
    expect(formatMs(240.4)).toBe("240 ms");
    expect(formatMs(1240)).toBe("1.24 s");
  });

  test("status says what happened when there is no code", () => {
    expect(statusCell(networkEntry({ httpStatus: 204 }))).toEqual({ text: "204", tone: "default" });
    expect(statusCell(networkEntry({ httpStatus: 404 })).tone).toBe("warning");
    expect(statusCell(networkEntry({ httpStatus: 503 })).tone).toBe("error");
    expect(statusCell(networkEntry({ httpStatus: null, state: "pending" })).text).toBe("Pending");
    expect(statusCell(networkEntry({ state: "failed", canceled: true })).text).toBe("Cancelled");
    expect(statusCell(networkEntry({ state: "failed", blocked: true })).text).toBe("Blocked");
  });

  test("size names caches and counts WebSocket frames", () => {
    expect(sizeCell(networkEntry({ fromDiskCache: true })).text).toBe("Disk cache");
    expect(sizeCell(networkEntry({ isWebSocket: true, wsFrameCount: 1 })).text).toBe("1 frame");
    expect(sizeCell(networkEntry({ state: "pending" })).text).toBe("…");
    expect(sizeCell(networkEntry({ state: "failed" })).text).toBe("—");
  });

  test("time flags slow requests", () => {
    expect(timeCell(networkEntry({ startTimestamp: 0, finishedTimestamp: 0.2 })).tone).toBe(
      "muted",
    );
    expect(timeCell(networkEntry({ startTimestamp: 0, finishedTimestamp: 1.5 })).tone).toBe(
      "warning",
    );
    expect(timeCell(networkEntry({ startTimestamp: 0, finishedTimestamp: 4 })).tone).toBe("error");
    expect(timeCell(networkEntry({ finishedTimestamp: null, state: "pending" })).text).toBe(
      "Pending",
    );
  });

  test("names show the path, initiators the file and line", () => {
    expect(requestName("https://api.test/v1/orders?page=2")).toBe("/v1/orders?page=2");
    expect(requestName("data:image/png;base64,AAAA")).toBe("data:image/png");
    expect(
      initiatorWord(
        networkEntry({ initiatorUrl: "https://app.test/assets/main.js", initiatorLine: 41 }),
      ),
    ).toBe("main.js:42");
    expect(initiatorWord(networkEntry({ initiatorType: "parser" }))).toBe("Page");
  });

  test("the summary mentions how many are shown only while filtering", () => {
    expect(requestsSummary({ total: 3, shown: 3, transferred: 2048, filtering: false })).toBe(
      "3 requests · 2.0 KB transferred",
    );
    expect(requestsSummary({ total: 1, shown: 0, transferred: 0, filtering: true })).toBe(
      "1 request · 0 B transferred · 0 shown",
    );
  });
});

describe("waterfall", () => {
  const first = networkEntry({
    requestId: "1",
    startTimestamp: 0,
    responseTimestamp: 1,
    finishedTimestamp: 2,
  });
  const second = networkEntry({
    requestId: "2",
    startTimestamp: 2,
    responseTimestamp: 3,
    finishedTimestamp: 4,
  });

  test("the range spans the earliest start and latest end", () => {
    expect(waterfallRange([second, first])).toEqual({ start: 0, end: 4 });
    expect(waterfallRange([])).toBeNull();
  });

  test("bars split waiting from receiving on a shared axis", () => {
    const range = { start: 0, end: 4 };
    expect(waterfallBar(first, range)).toEqual({
      left: 0,
      waiting: 25,
      receiving: 25,
      open: false,
    });
    expect(waterfallBar(second, range)).toMatchObject({ left: 50, waiting: 25, receiving: 25 });
  });

  test("an open request runs to the end of the range", () => {
    const open = networkEntry({
      startTimestamp: 1,
      responseTimestamp: null,
      finishedTimestamp: null,
      state: "pending",
    });
    const bar = waterfallBar(open, { start: 0, end: 4 });
    expect(bar.open).toBe(true);
    expect(bar.left + bar.waiting + bar.receiving).toBeCloseTo(100);
  });

  test("an instant request keeps a visible sliver", () => {
    const instant = networkEntry({ startTimestamp: 4, responseTimestamp: 4, finishedTimestamp: 4 });
    const bar = waterfallBar(instant, { start: 0, end: 4 });
    expect(bar.receiving).toBeGreaterThan(0);
    expect(bar.left + bar.receiving).toBeLessThanOrEqual(100);
  });
});

describe("sorting", () => {
  const slow = networkEntry({
    requestId: "slow",
    startTimestamp: 0,
    finishedTimestamp: 3,
    httpStatus: 500,
  });
  const fast = networkEntry({
    requestId: "fast",
    startTimestamp: 1,
    finishedTimestamp: 1.1,
    httpStatus: 200,
  });
  const open = networkEntry({
    requestId: "open",
    startTimestamp: 2,
    finishedTimestamp: null,
    httpStatus: null,
  });

  test("no sort keeps capture order", () => {
    const entries = [slow, fast, open];
    expect(sortRequests(entries, null)).toBe(entries);
  });

  test("time and status sort with unknowns last", () => {
    const ids = (sorted: readonly { requestId: string }[]) =>
      sorted.map((entry) => entry.requestId);
    expect(ids(sortRequests([slow, fast, open], { key: "time", desc: false }))).toEqual([
      "fast",
      "slow",
      "open",
    ]);
    expect(ids(sortRequests([slow, fast, open], { key: "status", desc: true }))).toEqual([
      "slow",
      "fast",
      "open",
    ]);
  });

  test("header clicks cycle ascending, descending, then capture order", () => {
    expect(nextSort(null, "size")).toEqual({ key: "size", desc: false });
    expect(nextSort({ key: "size", desc: false }, "size")).toEqual({ key: "size", desc: true });
    expect(nextSort({ key: "size", desc: true }, "size")).toBeNull();
    expect(nextSort({ key: "size", desc: true }, "time")).toEqual({ key: "time", desc: false });
  });
});

describe("capture state", () => {
  const base = {
    status: "live" as const,
    recording: true,
    presence: "foreground" as const,
    error: null,
  };

  test("paused is said before anything else", () => {
    expect(captureWord({ ...base, recording: false, status: "error" }).label).toBe("Paused");
  });

  test("an app in the background is not called live", () => {
    expect(captureWord({ ...base, presence: "background" })).toMatchObject({
      label: "Waiting",
      solid: false,
    });
    expect(captureWord(base)).toMatchObject({ label: "Live", solid: true });
  });

  test("an empty list says why it is empty", () => {
    expect(emptyCopy({ ...base, captured: 4, filtering: true }).action).toBe("clear-filters");
    expect(emptyCopy({ ...base, captured: 0, filtering: false, recording: false }).action).toBe(
      "resume",
    );
    expect(
      emptyCopy({ ...base, captured: 0, filtering: false, presence: "background" }),
    ).toMatchObject({ title: "No requests while the app is away", action: null });
    expect(emptyCopy({ ...base, captured: 0, filtering: false, status: "connecting" }).title).toBe(
      "Connecting to the app",
    );
    expect(emptyCopy({ ...base, captured: 0, filtering: false }).action).toBe("reload");
  });
});
