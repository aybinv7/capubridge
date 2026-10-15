import { describe, expect, test } from "vite-plus/test";
import { deps, flakyActions, flow, observation } from "./flowExecutorFixtures";
import type { Flow, Observation } from "@/types/automation.types";
import { createFakeDeviceActions } from "../deviceActions";
import type { DeviceActions } from "../deviceActions";
import { runFlow } from "../flowExecutor";

describe("runFlow", () => {
  test("a three-step flow where everything succeeds passes with three records in order", async () => {
    const result = await runFlow(
      flow(),
      deps({ readbackText: () => Promise.resolve("hello") }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(result.records.map((record) => record.stepId)).toEqual(["s1", "s2", "s3"]);
    expect(result.records.every((record) => record.outcome === "ok")).toBe(true);
  });

  test("a failing middle step halts with two records and the error carried", async () => {
    const failing: Flow = {
      ...flow(),
      steps: [
        { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
        { id: "s2", op: "tap", target: { kind: "selector", cssSelector: "#missing" } },
        { id: "s3", op: "back" },
      ],
    };
    const result = await runFlow(failing, deps(), new AbortController().signal);
    expect(result.status).toBe("failed");
    expect(result.records).toHaveLength(2);
    expect(result.records[1]?.outcome).toBe("failed");
    expect(result.records[1]?.error).toContain("#missing");
  });

  test("a step whose post-action observation rejects still produces its record", async () => {
    let calls = 0;
    const result = await runFlow(
      {
        version: 1,
        id: "flow-1",
        name: "One tap",
        appPackage: "com.example.app",
        steps: [{ id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } }],
      },
      deps({
        observe: () => {
          calls += 1;
          return calls <= 1
            ? Promise.resolve(observation())
            : Promise.reject(new Error("pipe broke"));
        },
      }),
      new AbortController().signal,
    );
    expect(result.status).toBe("failed");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.outcome).toBe("failed");
    expect(result.records[0]?.verificationStatus).toBe("unverified");
    expect(result.failureReason).toContain("post-action observation failed");
  });

  test("a type step with mismatched readback halts naming both values", async () => {
    const result = await runFlow(
      flow(),
      deps({ readbackText: () => Promise.resolve("bye") }),
      new AbortController().signal,
    );
    expect(result.status).toBe("failed");
    expect(result.records).toHaveLength(2);
    expect(result.records[1]?.error).toContain("hello");
    expect(result.records[1]?.error).toContain("bye");
  });

  test("a selector type step can write through the live WebView and skip shell text input", async () => {
    const actions = createFakeDeviceActions();
    const result = await runFlow(
      {
        ...flow(),
        steps: [flow().steps[1] as Flow["steps"][number]],
      },
      deps({
        actions,
        readbackText: () => Promise.resolve("hello"),
        writeText: () => Promise.resolve(true),
      }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(actions.calls.map((call) => call.method)).toEqual([]);
  });

  test("a native type step verifies from the settled native frame", async () => {
    const before = observation();
    before.webview = null;
    const inputControl = {
      index: 7,
      bounds: [0, 0, 200, 60] as [number, number, number, number],
      className: "android.widget.EditText",
      text: "",
      contentDesc: "Search",
      clickable: true,
      enabled: true,
    };
    before.native.controls = [inputControl];
    const after: Observation = {
      ...before,
      native: {
        ...before.native,
        controls: [{ ...inputControl, text: "hello" }],
      },
    };
    let reads = 0;
    const result = await runFlow(
      {
        version: 1,
        id: "flow-1",
        name: "Native type",
        appPackage: "com.example.app",
        steps: [{ id: "s1", op: "type", target: { kind: "nativeIndex", index: 7 }, text: "hello" }],
      },
      deps({
        observe: () => Promise.resolve(reads++ === 0 ? before : after),
        readbackText: (_target, settled) =>
          Promise.resolve(
            settled?.native.controls.find((control) => control.index === 7)?.text ?? null,
          ),
      }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(result.records[0]?.verificationStatus).toBe("verified");
  });

  test("a selector tap uses the WebView action bridge before coordinate fallback", async () => {
    const actions = createFakeDeviceActions();
    const result = await runFlow(
      {
        ...flow(),
        steps: [flow().steps[0] as Flow["steps"][number]],
      },
      deps({ actions, clickWebview: () => Promise.resolve(true) }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(actions.calls).toEqual([]);
    expect(result.records[0]?.resolvedTarget?.strategy).toBe("selector");
    expect(result.records[0]?.decision.frameId).toBe(result.records[0]?.beforeFingerprint);
    expect(result.records[0]?.resolvedTarget?.frameId).toBe(result.records[0]?.decision.frameId);
  });

  test("a step that succeeds on the second attempt yields one record with two attempts", async () => {
    const flaky = flakyActions(1);
    const result = await runFlow(
      {
        version: 1,
        id: "flow-1",
        name: "Retry",
        appPackage: "com.example.app",
        steps: [
          {
            id: "s1",
            op: "tap",
            target: { kind: "selector", cssSelector: "#a" },
            retry: { maxAttempts: 2 },
          },
        ],
      },
      deps({ actions: flaky.actions }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.attempts).toBe(2);
  });

  test("aborting mid-run returns cancelled with completed records intact", async () => {
    const controller = new AbortController();
    const base = createFakeDeviceActions();
    const actions: DeviceActions = {
      ...base,
      tap: async (serial, x, y) => {
        await base.tap(serial, x, y);
        controller.abort();
      },
    };
    const result = await runFlow(flow(), deps({ actions }), controller.signal);
    expect(result.status).toBe("cancelled");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.outcome).toBe("ok");
  });
});
