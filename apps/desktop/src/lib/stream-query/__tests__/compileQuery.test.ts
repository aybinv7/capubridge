import { describe, expect, it } from "vite-plus/test";
import { compileLogcatQuery, type LogcatQueryContext } from "@/lib/logcat/logcatQuery";
import { parseDuration } from "@/lib/stream-query/compileQuery";
import type { LogcatEntry, LogcatLevel } from "@/types/logcat.types";

const NOW = 1_730_000_000_000;
let seq = 0;

function line(
  tag: string,
  message: string,
  level: LogcatLevel = "I",
  extra: Partial<LogcatEntry> = {},
): LogcatEntry {
  seq += 1;
  return {
    id: `s:${seq}`,
    seq,
    serial: "s",
    tsMs: NOW,
    date: "01-01",
    time: "00:00:00.000",
    uid: null,
    pid: 100,
    tid: 100,
    level,
    tag,
    processName: "com.shop.app",
    packageName: "com.shop.app",
    message,
    ...extra,
  };
}

const context: LogcatQueryContext = {
  myPackage: "com.shop.app",
  hostTime: (entry) => entry.tsMs,
};

function keep(query: string, entries: LogcatEntry[], ctx = context): string[] {
  const { predicate } = compileLogcatQuery(query, ctx);
  return entries.filter((entry) => !predicate || predicate(entry)).map((entry) => entry.message);
}

describe("compileQuery (logcat)", () => {
  const entries = [
    line("Net", "GET /orders 200"),
    line("Net", "GET /cart 500", "E"),
    line("Chatty", "tick", "V"),
    line("Ui", "frame drop", "W"),
    line("AndroidRuntime", "FATAL EXCEPTION: main\n\tat com.shop.App.run(App.java:3)", "E"),
    line("Other", "from another app", "I", { packageName: "com.other", processName: "com.other" }),
  ];

  it("lets everything through for an empty query", () => {
    expect(compileLogcatQuery("   ", context).predicate).toBeNull();
  });

  it("ORs the same key and ANDs different keys", () => {
    expect(keep("tag:Net tag:Ui", entries)).toEqual([
      "GET /orders 200",
      "GET /cart 500",
      "frame drop",
    ]);
    expect(keep("tag:Net level:E", entries)).toEqual(["GET /cart 500"]);
  });

  it("treats level:W as W and above, and mirrors the floor", () => {
    const query = compileLogcatQuery("level:warn", context);
    expect(query.levelFloor).toBe(3);
    expect(keep("level:W", entries)).toEqual([
      "GET /cart 500",
      "frame drop",
      "FATAL EXCEPTION: main\n\tat com.shop.App.run(App.java:3)",
    ]);
  });

  it("excludes negated terms and matches regex and exact values", () => {
    expect(keep("-tag:Net -tag:Chatty package:mine", entries)).toEqual([
      "frame drop",
      "FATAL EXCEPTION: main\n\tat com.shop.App.run(App.java:3)",
    ]);
    expect(keep("tag~:^(Net|Ui)$ -message:orders", entries)).toEqual([
      "GET /cart 500",
      "frame drop",
    ]);
    expect(keep("tag=:net", entries)).toEqual([]);
  });

  it("knows crashes and stack traces", () => {
    expect(keep("is:crash", entries)).toHaveLength(1);
    expect(keep("is:stacktrace", entries)).toHaveLength(1);
  });

  it("searches free text and /regex/ across tag, package and message", () => {
    expect(keep("cart 500", entries)).toEqual(["GET /cart 500"]);
    expect(keep("/\\/(cart|orders) [25]00/", entries)).toHaveLength(2);
    expect(keep("other", entries)).toEqual(["from another app"]);
  });

  it("keeps recent lines for age: and says the result changes with time", () => {
    const old = line("Net", "old", "I", { tsMs: Date.now() - 10 * 60_000 });
    const fresh = line("Net", "fresh", "I", { tsMs: Date.now() });
    const query = compileLogcatQuery("age:5m", context);
    expect(query.timeSensitive).toBe(true);
    expect(keep("age:5m", [old, fresh])).toEqual(["fresh"]);
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("2h")).toBe(7_200_000);
    expect(parseDuration("soon")).toBeNull();
  });

  it("reports what it cannot apply instead of emptying the view", () => {
    const query = compileLogcatQuery("level:loud tag~:( is:boom tag:Net", context);
    expect(query.problems.map((problem) => problem.message)).toEqual([
      '"loud" is not a level here',
      expect.stringContaining("This pattern is not valid"),
      "is: takes crash, stacktrace",
    ]);
    expect(keep("level:loud tag~:( is:boom tag:Net", entries)).toHaveLength(2);
  });

  it("says package:mine needs an app when none is chosen", () => {
    const query = compileLogcatQuery("package:mine", { ...context, myPackage: null });
    expect(query.problems[0]?.message).toContain("choose a WebView");
    expect(keep("package:mine", entries, { ...context, myPackage: null })).toEqual([]);
  });
});
