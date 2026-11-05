import { describe, expect, test } from "vite-plus/test";
import {
  PROCESS_STALE_AFTER_MS,
  appRunCopy,
  appRunState,
  processPhase,
  processPhaseCopy,
  processPhaseMark,
  type ProcessPhaseInput,
} from "../process/processPhase";

const live: ProcessPhaseInput = {
  error: null,
  paused: false,
  sampledSinceStart: true,
  running: true,
  sinceLastSampleMs: 100,
};

describe("process phase", () => {
  test("a fresh reading of a running app on screen is live", () => {
    expect(processPhase(live)).toBe("live");
    expect(processPhaseMark("live")).toEqual({ color: "lime", variant: "solid" });
  });

  test("a pause wins over everything, so it is never mistaken for trouble", () => {
    expect(processPhase({ ...live, paused: true, error: "adb gone" })).toBe("paused");
  });

  test("an error says stopped with a red mark", () => {
    expect(processPhase({ ...live, error: "device offline" })).toBe("error");
    expect(processPhaseMark("error").color).toBe("red");
  });

  test("an old reading from before a restart is not live", () => {
    expect(processPhase({ ...live, sampledSinceStart: false })).toBe("starting");
  });

  test("an app with no process is not running", () => {
    expect(processPhase({ ...live, running: false })).toBe("not-running");
    expect(processPhaseCopy("not-running", null).label).toBe("Not running");
  });

  test("an app in the background is still read live, and the status says it may freeze", () => {
    expect(processPhase(live)).toBe("live");
    expect(appRunCopy(appRunState(true, "background")).label).toBe("In the background");
    expect(processPhaseCopy("live", null, true)).toEqual({
      label: "Live",
      detail: "In the background, Android may freeze it.",
    });
    expect(processPhaseCopy("live", null).detail).toBe("Read from the phone every 2.5 seconds.");
  });

  test("a phone that stopped answering is stale, with the age in words", () => {
    const age = PROCESS_STALE_AFTER_MS + 2000;
    expect(processPhase({ ...live, sinceLastSampleMs: age })).toBe("stale");
    expect(processPhaseCopy("stale", age).detail).toBe(
      `No reading for ${Math.round(age / 1000)} s. The phone may be busy or asleep.`,
    );
  });

  test("the run state reads the process first, then the presence probe", () => {
    expect(appRunState(true, "foreground")).toBe("running");
    expect(appRunState(true, "view-hidden")).toBe("running");
    expect(appRunState(true, "background")).toBe("background");
    expect(appRunState(false, "foreground")).toBe("stopped");
    expect(appRunState(null, "unknown")).toBe("unknown");
    expect(appRunState(null, "background")).toBe("background");
    expect(appRunCopy("running").mark).toEqual({ color: undefined, variant: "solid" });
    expect(appRunCopy("stopped").label).toBe("Not running");
  });
});
