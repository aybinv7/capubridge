import { describe, expect, test } from "vite-plus/test";
import { captureWord, emptyCopy } from "../requests/captureState";
import {
  formatBytes,
  formatMs,
  initiatorWord,
  isAppFile,
  sizeCell,
  statusCell,
  timeCell,
} from "../requests/requestCells";
import { requestName, requestNameParts } from "../requests/requestNames";
import { rowCells } from "../requests/requestRowCells";
import { requestsSummary } from "../requests/requestFilters";
import { nextSort, sortRequests } from "../requests/requestSort";
import { waterfallBar, waterfallRange, waterfallTicks } from "../requests/waterfall";
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
    expect(statusCell(networkEntry({ httpStatus: 204 }))).toEqual({ text: "204", tone: "muted" });
    expect(
      statusCell(networkEntry({ state: "failed", interrupted: true, errorText: "restarted" })),
    ).toMatchObject({ text: "Unknown", tone: "subtle" });
    expect(statusCell(networkEntry({ httpStatus: 404 })).tone).toBe("warning");
    expect(statusCell(networkEntry({ httpStatus: 503 })).tone).toBe("error");
    expect(statusCell(networkEntry({ httpStatus: null, state: "pending" })).text).toBe("Pending");
    expect(statusCell(networkEntry({ state: "failed", canceled: true })).text).toBe("Cancelled");
    expect(statusCell(networkEntry({ state: "failed", blocked: true })).text).toBe("Blocked");
  });

  test("size names caches and counts WebSocket frames", () => {
    expect(sizeCell(networkEntry({ fromDiskCache: true })).text).toBe("Disk cache");
    expect(sizeCell(networkEntry({ isWebSocket: true, wsFrameCount: 1 })).text).toBe("1 frame");
    expect(sizeCell(networkEntry({ state: "pending" })).text).toBe("—");
    expect(sizeCell(networkEntry({ state: "failed" })).text).toBe("—");
  });

  test("size reads transferred / size, and files the app serves itself say so", () => {
    expect(sizeCell(networkEntry({ transferSize: 1024, resourceSize: 4096 })).text).toBe(
      "1.0 KB / 4.0 KB",
    );
    expect(sizeCell(networkEntry({ transferSize: 2048, resourceSize: 2048 })).text).toBe("2.0 KB");
    const local = networkEntry({
      url: "https://localhost/assets/app.js",
      transferSize: 0,
      resourceSize: 12288,
    });
    expect(isAppFile(local)).toBe(true);
    expect(sizeCell(local).text).toBe("App · 12 KB");
    expect(isAppFile(networkEntry({ url: "https://api.test/a", transferSize: 0 }))).toBe(false);
  });

  test("a slow request stands out in ink, a very slow one warns; neither reads as failed", () => {
    expect(timeCell(networkEntry({ startTimestamp: 0, finishedTimestamp: 0.2 })).tone).toBe(
      "muted",
    );
    expect(timeCell(networkEntry({ startTimestamp: 0, finishedTimestamp: 1.5 })).tone).toBe(
      "default",
    );
    expect(timeCell(networkEntry({ startTimestamp: 0, finishedTimestamp: 4 })).tone).toBe(
      "warning",
    );
  });

  test("an open request says Pending once, in Status; its time counts up and has no size", () => {
    const open = networkEntry({
      finishedTimestamp: null,
      httpStatus: null,
      state: "pending",
      startedAt: 1000,
    });
    expect(statusCell(open).text).toBe("Pending");
    expect(timeCell(open).text).toBe("");
    expect(sizeCell(open).text).toBe("—");
    expect(rowCells(open).pendingSince).toBe(1000);
    expect(
      rowCells(networkEntry({ state: "finished", finishedTimestamp: 1 })).pendingSince,
    ).toBeNull();
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
    expect(
      initiatorWord(networkEntry({ initiatorUrl: "https://localhost/", initiatorLine: 9 })),
    ).toBe("index.html:10");
  });

  test("a row is named by what tells it apart, the host and folder quiet", () => {
    expect(requestNameParts("https://api.test/v1/orders?page=2")).toEqual({
      main: "orders?page=2",
      detail: "api.test/v1/",
    });
    expect(requestNameParts("https://api.test/")).toEqual({ main: "api.test", detail: "" });
    expect(
      requestNameParts(
        "https://localhost/_capacitor_http_interceptor_?u=https%3A%2F%2Fodoo.test%2Fweb%2Fdataset%2Fcall_kw",
      ),
    ).toEqual({ main: "call_kw", detail: "odoo.test/web/dataset/" });
  });

  test("a path ending in an id is named by what it fetches and a short id", () => {
    expect(
      requestNameParts("https://api.test/v1/snapshot/3f2a9c4e-1b7d-4e8a-9f00-5c6d7e8f0001"),
    ).toEqual({ main: "snapshot/…0001", detail: "api.test/v1/" });
    expect(requestNameParts("https://api.test/orders/42?full=1")).toEqual({
      main: "orders/42?full=1",
      detail: "api.test/",
    });
    expect(requestNameParts("https://api.test/v1/orders/1234567890")).toEqual({
      main: "orders/…7890",
      detail: "api.test/v1/",
    });
    expect(requestNameParts("https://cdn.test/assets/0123456789abcdef0123")).toEqual({
      main: "assets/…0123",
      detail: "cdn.test/",
    });
    expect(requestNameParts("https://api.test/42")).toEqual({ main: "42", detail: "api.test/" });
  });

  test("the summary mentions how many are shown only while filtering", () => {
    expect(
      requestsSummary({ total: 3, shown: 3, transferred: 2048, resources: 0, filtering: false }),
    ).toBe("3 requests · 2.0 KB transferred");
    expect(
      requestsSummary({ total: 1, shown: 0, transferred: 0, resources: 4096, filtering: true }),
    ).toBe("1 request · 0 B transferred · 4.0 KB resources · 0 shown");
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

  test("the range starts at the last page load, and earlier requests have no bar", () => {
    const load = networkEntry({
      requestId: "doc",
      resourceType: "Document",
      startTimestamp: 100,
      responseTimestamp: 100.2,
      finishedTimestamp: 100.5,
    });
    const range = waterfallRange([first, second, load]);
    expect(range).toEqual({ start: 100, end: 100.5 });
    expect(waterfallBar(first, range!)).toBeNull();
    expect(waterfallTicks(range!).map((tick) => tick.label)).toEqual(["200 ms", "400 ms"]);
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
    expect(bar?.open).toBe(true);
    expect((bar?.left ?? 0) + (bar?.waiting ?? 0) + (bar?.receiving ?? 0)).toBeCloseTo(100);
  });

  test("an instant request still gets a bar (drawn at least 3 px wide)", () => {
    const instant = networkEntry({ startTimestamp: 4, responseTimestamp: 4, finishedTimestamp: 4 });
    const bar = waterfallBar(instant, { start: 0, end: 4 });
    expect(bar).not.toBeNull();
    expect(bar?.left).toBeLessThanOrEqual(100);
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
      label: "In the background",
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
    ).toMatchObject({ title: "No requests while the app is in the background", action: null });
    expect(emptyCopy({ ...base, captured: 0, filtering: false, status: "connecting" }).title).toBe(
      "Connecting to the app",
    );
    expect(emptyCopy({ ...base, captured: 0, filtering: false }).action).toBe("reload");
  });
});
