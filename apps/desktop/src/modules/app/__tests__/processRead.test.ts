import { describe, expect, test } from "vite-plus/test";
import { parseCpuInfo } from "../process/cpuinfo";
import { memoryComposition, parseMemInfo } from "../process/meminfo";
import { parseProcessRead, processReadCommand, sampleChannels } from "../process/processRead";
import { CPUINFO_LINE, MEMINFO_RUNNING, MEMINFO_STOPPED, PACKAGE } from "./fixtures";

describe("process readings", () => {
  test("meminfo gives the PID, total, parts and threads of a running app", () => {
    const memory = parseMemInfo(MEMINFO_RUNNING);
    expect(memory).toMatchObject({
      pid: 4321,
      isRunning: true,
      totalPssKb: 51200,
      nativeHeapKb: 20480,
      dalvikHeapKb: 10240,
      stackKb: 1024,
      graphicsKb: 3072,
      codeKb: 4096 + 2048 + 1024,
      threadCount: 42,
    });
    expect(memory.otherKb).toBe(51200 - (20480 + 10240 + 7168 + 1024 + 3072));
  });

  test("an app without a process reads as not running", () => {
    const memory = parseMemInfo(MEMINFO_STOPPED);
    expect(memory.isRunning).toBe(false);
    expect(memory.pid).toBeNull();
    expect(memoryComposition(memory)).toEqual([]);
  });

  test("the composition keeps a fixed order and adds up to the total", () => {
    const parts = memoryComposition(parseMemInfo(MEMINFO_RUNNING));
    expect(parts.map((part) => part.key)).toEqual([
      "native",
      "dalvik",
      "code",
      "graphics",
      "stack",
      "other",
    ]);
    expect(parts.reduce((sum, part) => sum + part.share, 0)).toBeCloseTo(100);
  });

  test("cpuinfo finds the app's line and reads an absent app as idle", () => {
    expect(parseCpuInfo(CPUINFO_LINE, PACKAGE)).toEqual({
      totalPct: 12,
      userPct: 8.5,
      kernelPct: 3.5,
    });
    expect(parseCpuInfo("  3% 99/com.other: 2% user + 1% kernel", PACKAGE).totalPct).toBe(0);
    expect(parseCpuInfo("  3% 99/com.sigXpresalio: 2% user + 1% kernel", PACKAGE).totalPct).toBe(0);
    expect(parseCpuInfo("  9% 77/com.sig.presalio2: 5% user + 4% kernel", PACKAGE).totalPct).toBe(
      0,
    );
    expect(
      parseCpuInfo("  4% 78/com.sig.presalio:remote: 3% user + 1% kernel", PACKAGE).totalPct,
    ).toBe(4);
  });

  test("one shell reads both, and only the app's processor lines", () => {
    expect(processReadCommand(PACKAGE)).toBe(
      `dumpsys meminfo ${PACKAGE}; echo __capubridge_cpu__; dumpsys cpuinfo | grep -F "/${PACKAGE}"`,
    );
  });

  test("the combined output splits into memory and processor", () => {
    const output = `${MEMINFO_RUNNING}__capubridge_cpu__\n${CPUINFO_LINE}`;
    const sample = parseProcessRead(output, PACKAGE, 1000);
    expect(sample).toMatchObject({ at: 1000, running: true, pid: 4321, threads: 42 });
    expect(sample.cpu?.totalPct).toBe(12);
    expect(sampleChannels(sample)).toEqual({ pss: 50, cpu: 12, threads: 42 });
  });

  test("a stopped app leaves a gap in every chart", () => {
    const sample = parseProcessRead(`${MEMINFO_STOPPED}__capubridge_cpu__\n`, PACKAGE, 1000);
    expect(sample.running).toBe(false);
    expect(sample.cpu).toBeNull();
    expect(sampleChannels(sample)).toEqual({ pss: null, cpu: null, threads: null });
  });
});
