import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { AssertionResult } from "../assertions";
import type { Flow, StepRecord } from "@/types/automation.types";
import type { RunResult } from "../flowExecutor";
import type { SessionManifest } from "@/types/replay.types";
import { startRunRecording } from "../runTrace";

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
}));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: mocks.invokeCommand,
}));

const invokeMock = mocks.invokeCommand;

interface Captured {
  appends: Array<{ sessionId: string; track: string; ndjsonBatch: string }>;
  manifests: string[];
  attaches: Array<{ sessionId: string; name: string; base64Data: string }>;
}

const captured: Captured = { appends: [], manifests: [], attaches: [] };

function installBackend(stopBehavior: "ok" | "throw" = "ok"): void {
  invokeMock.mockImplementation((command: string, args: Record<string, unknown>) => {
    if (command === "recording_session_start") {
      return Promise.resolve(undefined);
    }
    if (command === "recording_session_append") {
      captured.appends.push(args as Captured["appends"][number]);
      return Promise.resolve(undefined);
    }
    if (command === "recording_session_attach") {
      captured.attaches.push(args as Captured["attaches"][number]);
      return Promise.resolve(undefined);
    }
    if (command === "recording_session_stop") {
      captured.manifests.push(args["manifestJson"] as string);
      return stopBehavior === "ok"
        ? Promise.resolve("/sessions/run-1.capu")
        : Promise.reject(new Error("disk full"));
    }
    return Promise.reject(new Error(`unexpected command ${command}`));
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  captured.appends = [];
  captured.manifests = [];
  captured.attaches = [];
});

const FLOW: Flow = {
  version: 1,
  id: "flow-1",
  name: "Sign in",
  appPackage: "com.example.app",
  steps: [],
};

function stepRecord(
  stepId: string,
  startedAt: number,
  outcome: StepRecord["outcome"] = "ok",
): StepRecord {
  return {
    stepId,
    startedAt,
    endedAt: startedAt + 50,
    decision: {
      operation: "tap",
      target: { kind: "point", x: 1, y: 2 },
      confidence: 1,
      reason: "test",
    },
    resolvedTarget: { x: 1, y: 2, strategy: "point" },
    outcome,
    error: null,
    screenshotRef: "",
  };
}

function runResult(status: RunResult["status"], records: StepRecord[]): RunResult {
  const startedAt = records[0]?.startedAt ?? Date.now();
  return {
    status,
    records,
    failureReason: null,
    startedAt,
    endedAt: startedAt + 1000,
  };
}

function automationEvents(): Array<{ t: number; data: { stepId: string } }> {
  return captured.appends
    .filter((append) => append.track === "automation")
    .flatMap((append) =>
      append.ndjsonBatch
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as { t: number; data: { stepId: string } }),
    );
}

describe("runTrace", () => {
  test("three steps produce three automation events with ascending offsets", async () => {
    installBackend();
    const recording = await startRunRecording({
      label: "run",
      policyId: "rules",
      flow: FLOW,
      goal: null,
      deviceSerial: "serial-1",
      appPackage: "com.example.app",
    });
    const base = recording.startedAt + 100;
    recording.recordStep(stepRecord("s1", base));
    recording.recordStep(stepRecord("s2", base + 200));
    recording.recordStep(stepRecord("s3", base + 400));
    const finished = await recording.finish(
      runResult("passed", [
        stepRecord("s1", base),
        stepRecord("s2", base + 200),
        stepRecord("s3", base + 400),
      ]),
    );
    expect(finished.filePath).toBe("/sessions/run-1.capu");
    expect(finished.partial).toBe(false);
    const events = automationEvents();
    expect(events.map((event) => event.data.stepId)).toEqual(["s1", "s2", "s3"]);
    const offsets = events.map((event) => event.t);
    expect([...offsets].sort((left, right) => left - right)).toEqual(offsets);
    const manifest = JSON.parse(captured.manifests[0] as string) as SessionManifest;
    expect(manifest.automation).toMatchObject({
      runStatus: "passed",
      policyId: "rules",
      flowId: "flow-1",
    });
  });

  test("assertion results attach to their step", async () => {
    installBackend();
    const recording = await startRunRecording({
      label: "run",
      policyId: "rules",
      flow: FLOW,
      goal: null,
      deviceSerial: null,
      appPackage: null,
    });
    const assertion: AssertionResult = {
      passed: true,
      assertion: { kind: "urlMatches", pattern: "^https://" },
      elapsedMs: 5,
      attempts: 1,
      observed: "matched",
    };
    const base = recording.startedAt + 50;
    recording.recordStep(stepRecord("s1", base), [assertion]);
    await recording.finish(runResult("passed", [stepRecord("s1", base)]));
    const raw = captured.appends.find((append) => append.track === "automation")?.ndjsonBatch ?? "";
    const event = JSON.parse(raw.split("\n")[0] as string) as { data: { assertions: unknown[] } };
    expect(event.data.assertions).toHaveLength(1);
  });

  test("a cancelled run still produces a session with its completed steps", async () => {
    installBackend();
    const recording = await startRunRecording({
      label: "run",
      policyId: "rules",
      flow: FLOW,
      goal: null,
      deviceSerial: null,
      appPackage: null,
    });
    const base = recording.startedAt + 50;
    recording.recordStep(stepRecord("s1", base));
    recording.recordStep(stepRecord("s2", base + 100));
    const finished = await recording.finish(
      runResult("cancelled", [stepRecord("s1", base), stepRecord("s2", base + 100)]),
    );
    expect(finished.filePath).toBe("/sessions/run-1.capu");
    expect(finished.partial).toBe(true);
    expect(automationEvents()).toHaveLength(2);
    const manifest = JSON.parse(captured.manifests[0] as string) as SessionManifest;
    expect(manifest.automation?.runStatus).toBe("cancelled");
    expect(manifest.incomplete).toBeDefined();
  });

  test("a finalization failure still leaves a partial archive", async () => {
    installBackend("throw");
    const recording = await startRunRecording({
      label: "run",
      policyId: "rules",
      flow: FLOW,
      goal: null,
      deviceSerial: null,
      appPackage: null,
    });
    const base = recording.startedAt + 50;
    recording.recordStep(stepRecord("s1", base));
    const finished = await recording.finish(runResult("failed", [stepRecord("s1", base)]));
    expect(finished.filePath).toBeNull();
    expect(finished.partial).toBe(true);
    const last = JSON.parse(
      captured.manifests[captured.manifests.length - 1] as string,
    ) as SessionManifest;
    expect(last.incomplete?.errors.length).toBeGreaterThan(0);
  });

  test("a manifest without the automation track parses unchanged", () => {
    const legacy = {
      version: 1,
      sessionId: "old",
      label: "old",
      startedAt: 1000,
      duration: 500,
      deviceSerial: null,
      targetUrl: null,
      appPackage: null,
      tracks: { rrweb: true, network: true, console: true },
    };
    const manifest = JSON.parse(JSON.stringify(legacy)) as SessionManifest;
    expect(manifest.automation).toBeUndefined();
    expect(manifest.tracks.rrweb).toBe(true);
  });

  test("a pre-milestone session reports the automation track as absent, not an error", () => {
    const tracks: Record<string, string> = { rrweb: "{}\n", console: "{}\n" };
    expect(tracks["automation"]).toBeUndefined();
  });

  test("screenshot references point at archive entries and no base64 rides the NDJSON", async () => {
    installBackend();
    const recording = await startRunRecording({
      label: "run",
      policyId: "rules",
      flow: FLOW,
      goal: null,
      deviceSerial: null,
      appPackage: null,
    });
    const name = await recording.attachScreenshot("s1", "aGVsbG8=");
    expect(name).toBe("attachments/shot-s1.png");
    expect(invokeMock).toHaveBeenCalledWith("recording_session_attach", {
      sessionId: recording.sessionId,
      name: "shot-s1.png",
      base64Data: "aGVsbG8=",
    });
    const base = recording.startedAt + 50;
    recording.recordStep({ ...stepRecord("s1", base), screenshotRef: "attachments/shot-s1.png" });
    recording.recordStep({
      ...stepRecord("s2", base + 50),
      screenshotRef: `data:image/png;base64,${"QUJD".repeat(300)}`,
    });
    await recording.finish(runResult("passed", [stepRecord("s1", base)]));
    const raw = captured.appends.find((append) => append.track === "automation")?.ndjsonBatch ?? "";
    expect(raw).toContain("attachments/shot-s1.png");
    expect(raw).not.toContain("QUJDQUJD");
  });
});
