import { describe, expect, it } from "vite-plus/test";
import { describeClockOffset, deviceToHostMs } from "@/lib/timeline/hostClock";
import { logcatMarkers, networkMarker } from "@/lib/timeline/markerMappers";
import { toLogcatEntry } from "@/lib/logcat/logcatEntry";
import type { NetworkEntry } from "@/types/network.types";

describe("host clock", () => {
  it("moves device times onto the host clock with the measured offset", () => {
    const ahead = { offsetMs: 4_000, rttMs: 20, measuredAtMs: 0 };
    const behind = { offsetMs: -90_000, rttMs: 20, measuredAtMs: 0 };
    expect(deviceToHostMs(1_730_000_004_000, ahead)).toBe(1_730_000_000_000);
    expect(deviceToHostMs(1_730_000_000_000, behind)).toBe(1_730_000_090_000);
    expect(deviceToHostMs(1_730_000_000_000, null)).toBe(1_730_000_000_000);
  });

  it("describes an offset only when it is over a second", () => {
    expect(describeClockOffset({ offsetMs: 400, rttMs: 1, measuredAtMs: 0 })).toBeNull();
    expect(describeClockOffset({ offsetMs: 2_500, rttMs: 1, measuredAtMs: 0 })).toBe(
      "Device clock is 2.5 s ahead of this computer",
    );
    expect(describeClockOffset({ offsetMs: -125_000, rttMs: 1, measuredAtMs: 0 })).toBe(
      "Device clock is 125 s behind this computer",
    );
  });
});

describe("marker mappers", () => {
  it("puts logcat errors on both the Logcat and the Errors lane", () => {
    const entry = toLogcatEntry("emulator-5554", {
      seq: 1,
      tsMs: 1_730_000_004_000,
      uid: 10145,
      pid: 1,
      tid: 1,
      level: "E",
      tag: "AndroidRuntime",
      message: "FATAL EXCEPTION: main\n\tat x",
      processName: null,
      packageName: "com.example.shop",
    });
    const markers = logcatMarkers(entry, 1_730_000_000_000);
    expect(markers.map((marker) => marker.lane)).toEqual(["logcat", "errors"]);
    expect(markers[0]).toMatchObject({
      t: 1_730_000_000_000,
      severity: "error",
      label: "AndroidRuntime: FATAL EXCEPTION: main",
      ref: { kind: "logcat", id: "emulator-5554:1" },
    });
  });

  it("marks failed requests with error severity", () => {
    const base = {
      requestId: "r1",
      url: "https://api.example.com/cart",
      method: "POST",
      httpStatus: 500,
      state: "finished",
    } as NetworkEntry;
    expect(networkMarker(base, 5)).toMatchObject({
      lane: "network",
      severity: "error",
      label: "POST 500 https://api.example.com/cart",
    });
    expect(networkMarker({ ...base, httpStatus: 200 }, 5).severity).toBe("info");
  });
});
