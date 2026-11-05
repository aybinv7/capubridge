import { describe, expect, test } from "vite-plus/test";
import { cpuBetween, cpuMark } from "../process/cpuMeter";
import { cpuDomain, formatCpu } from "../process/cpuFormat";
import { memoryComposition, parseMemInfo } from "../process/meminfo";
import { parseProcStat } from "../process/procStat";
import { parseProcessRead, processOfUser, processReadCommand } from "../process/processRead";
import { nextReadDelay, sampleChannels } from "../process/processSample";
import {
  APP,
  MEMINFO_LOCAL,
  MEMINFO_TWO_USERS,
  NOT_RUNNING_OUTPUT,
  PROC_23882,
  PROC_31000,
  processReadOutput,
} from "./android16.fixtures";
import { MEMINFO_RUNNING } from "./fixtures";

describe("memory report", () => {
  test("Android 16's App Summary adds up to the total, with swap as its own part", () => {
    const memory = parseMemInfo(MEMINFO_LOCAL).get(23882);
    expect(memory?.totalPssKb).toBe(109_599);
    expect(memory?.parts).toEqual({
      java: 5528,
      native: 7280,
      code: 1244,
      graphics: 16_588,
      stack: 532,
      other: 8484,
      shared: 69_943 - 48_288,
      swapped: 48_288,
    });
    const sum = Object.values(memory?.parts ?? {}).reduce((total, kb) => total + kb, 0);
    expect(sum).toBe(109_599);
  });

  test("the composition keeps a fixed order, adds up to 100 and leaves out empty parts", () => {
    const parts = memoryComposition(parseMemInfo(MEMINFO_LOCAL).get(23882) ?? null);
    expect(parts.map((part) => part.key)).toEqual([
      "java",
      "native",
      "graphics",
      "code",
      "stack",
      "other",
      "shared",
      "swapped",
    ]);
    expect(parts.reduce((sum, part) => sum + part.share, 0)).toBeCloseTo(100);
    expect(parts.find((part) => part.key === "other")?.share).toBeLessThan(10);
  });

  test("each user's process is its own section, keyed by PID", () => {
    const sections = parseMemInfo(MEMINFO_TWO_USERS);
    expect([...sections.keys()]).toEqual([23882, 31000]);
    expect(sections.get(31000)?.totalPssKb).toBe(40_000);
    expect(sections.get(31000)?.parts.swapped).toBe(0);
  });

  test("an older report without an App Summary falls back to its rows", () => {
    const memory = parseMemInfo(MEMINFO_RUNNING).get(4321);
    expect(memory?.totalPssKb).toBe(51_200);
    expect(memory?.parts.native).toBe(20_480);
    expect(memory?.parts.code).toBe(4096 + 2048 + 1024);
  });

  test("no process prints no section", () => {
    expect(parseMemInfo("No process found for: com.example.retail\n").size).toBe(0);
  });
});

describe("/proc readings", () => {
  test("stat and status give processor ticks, start time, uid and threads", () => {
    expect(parseProcStat(23882, PROC_23882)).toEqual({
      pid: 23882,
      userTicks: 55_230,
      systemTicks: 30_975,
      startTicks: 61_229_489,
      uid: 10_406,
      threads: 106,
    });
  });

  test("a process name with spaces and parentheses does not shift the fields", () => {
    const odd = PROC_23882.replace("(presalio.retail)", "(odd) name)");
    expect(parseProcStat(23882, odd)?.userTicks).toBe(55_230);
  });

  test("the process of the inspected user is picked when two users run the app", () => {
    const processes = [parseProcStat(31000, PROC_31000), parseProcStat(23882, PROC_23882)].filter(
      (process) => process !== null,
    );
    expect(processOfUser(processes, 0)?.pid).toBe(23882);
    expect(processOfUser(processes, 10)?.pid).toBe(31000);
    expect(processOfUser(processes, 11)).toBeNull();
    expect(processOfUser(processes, null)?.pid).toBe(31000);
  });
});

describe("one reading", () => {
  test("the command is bounded in time and reads memory and cores only when asked", () => {
    const light = processReadCommand(APP, { memory: false, cores: false });
    expect(light.startsWith("timeout 5 sh -c '")).toBe(true);
    expect(light).toContain(`$(pidof ${APP})`);
    expect(light).not.toContain("dumpsys");
    const full = processReadCommand(APP, { memory: true, cores: true });
    expect(full).toContain(`dumpsys meminfo --local ${APP}`);
    expect(full).toContain("nproc");
  });

  test("the output splits into uptime, processes, cores and memory", () => {
    const read = parseProcessRead(processReadOutput({ memory: true, cores: true }));
    expect(read.uptimeS).toBeCloseTo(594_454.36);
    expect(read.cores).toBe(8);
    expect(read.processes.map((process) => process.pid)).toEqual([23882]);
    expect(read.memories?.get(23882)?.totalPssKb).toBe(109_599);
    expect(parseProcessRead(processReadOutput()).memories).toBeNull();
  });

  test("an app without a process reads as no process at all", () => {
    const read = parseProcessRead(NOT_RUNNING_OUTPUT);
    expect(read.processes).toEqual([]);
    expect(read.uptimeS).toBeCloseTo(594_454.36);
  });
});

describe("processor share", () => {
  const first = parseProcStat(23882, PROC_23882);
  if (!first) throw new Error("fixture did not parse");

  test("ticks over uptime, divided by the cores, like Device reads the phone", () => {
    const later = {
      ...first,
      userTicks: first.userTicks + 200,
      systemTicks: first.systemTicks + 40,
    };
    const cpu = cpuBetween(cpuMark(first, 1000), cpuMark(later, 1002.5), 8);
    expect(cpu?.userPct).toBeCloseTo(10);
    expect(cpu?.systemPct).toBeCloseTo(2);
    expect(cpu?.totalPct).toBeCloseTo(12);
  });

  test("no value from a first reading, a restarted process or a clock that did not move", () => {
    expect(cpuBetween(null, cpuMark(first, 1000), 8)).toBeNull();
    const restarted = { ...first, startTicks: first.startTicks + 1 };
    expect(cpuBetween(cpuMark(first, 1000), cpuMark(restarted, 1002), 8)).toBeNull();
    expect(cpuBetween(cpuMark(first, 1000), cpuMark(first, 1000), 8)).toBeNull();
  });

  test("a quiet app keeps a decimal and a readable scale", () => {
    expect(formatCpu(0.4)).toBe("0.4%");
    expect(formatCpu(23.6)).toBe("24%");
    expect(formatCpu(null)).toBe("—");
    expect(cpuDomain([0.5, null, 2])).toEqual([0, 10]);
    expect(cpuDomain([47])).toEqual([0, 60]);
    expect(cpuDomain([99])).toEqual([0, 100]);
  });
});

describe("pace of readings", () => {
  test("2.5 s while running, 10 s without a process, backing off after failures", () => {
    expect(nextReadDelay(0, true)).toBe(2500);
    expect(nextReadDelay(0, null)).toBe(2500);
    expect(nextReadDelay(0, false)).toBe(10_000);
    expect([1, 2, 3, 4, 9].map((failures) => nextReadDelay(failures, true))).toEqual([
      5000, 10_000, 20_000, 20_000, 20_000,
    ]);
  });

  test("a reading without a process leaves a gap", () => {
    const base = { at: 1, pid: null, cpu: null, threads: null, memory: null };
    expect(sampleChannels({ ...base, running: false })).toEqual({ cpu: null, threads: null });
    expect(
      sampleChannels({
        ...base,
        running: true,
        threads: 106,
        cpu: { totalPct: 3, userPct: 2, systemPct: 1 },
      }),
    ).toEqual({ cpu: 3, threads: 106 });
  });
});
