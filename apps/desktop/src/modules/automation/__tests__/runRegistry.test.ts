import { describe, expect, test } from "vite-plus/test";
import type { Flow, Observation } from "@/types/automation.types";
import type { ExecutorDeps } from "../flowExecutor";
import { buildCandidates, resolveTarget } from "../elementIndex";
import { createFakeDeviceActions } from "../deviceActions";
import type { RunRegistryDeps } from "../runRegistry";
import { createRunRegistry, resumePersistedGoal } from "../runRegistry";
import type { AutomationRunInfo } from "../runTrace";
import type { ActiveRun, RunEvent } from "../runObserver";
import { activeRunOf, applyRunEvent } from "../runObserver";

function observation(): Observation {
  return {
    native: {
      controls: [],
      packageName: "com.example.app",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: {
      elements: [
        {
          index: 0,
          cssSelector: "#go",
          role: "button",
          text: "Go",
          enabled: true,
          visible: true,
          bounds: [0, 0, 100, 40],
          isInput: false,
          inputType: null,
        },
      ],
    },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

const FLOW: Flow = {
  version: 1,
  id: "flow-1",
  name: "Go flow",
  appPackage: "com.example.app",
  steps: [{ id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#go" } }],
};

function testDeps(): RunRegistryDeps {
  const saved = new Map<string, Flow>([[FLOW.id, FLOW]]);
  return {
    loadFlow: (flowId) => saved.get(flowId) ?? null,
    listFlows: () =>
      [...saved.values()].map((flow) => ({
        id: flow.id,
        name: flow.name,
        appPackage: flow.appPackage,
        stepCount: flow.steps.length,
      })),
    saveFlow: (flow) => {
      saved.set(flow.id, flow);
    },
    deleteFlow: (flowId) => saved.delete(flowId),
    createExecutorDeps: (serial): ExecutorDeps => ({
      deviceSerial: serial,
      observe: () => Promise.resolve(observation()),
      actions: createFakeDeviceActions(),
      resolveTarget,
      buildCandidates,
      evaluateAssertion: () =>
        Promise.resolve({
          passed: true,
          assertion: { kind: "urlMatches", pattern: "^https://" },
          elapsedMs: 0,
          attempts: 1,
          observed: "ok",
        }),
      evidence: {
        queryDom: () => Promise.resolve(null),
        currentUrl: () => Promise.resolve("https://example.com/"),
        dbRow: () => Promise.resolve(null),
        recentNetwork: () => Promise.resolve([]),
        recentConsole: () => Promise.resolve([]),
      },
      readbackText: () => Promise.resolve(null),
      now: () => 0,
      sleep: () => Promise.resolve(),
    }),
    beginRecording: (_info: AutomationRunInfo) =>
      Promise.resolve({
        sessionId: "session-mcp",
        recordStep: () => {},
        finish: () => Promise.resolve({ filePath: "/sessions/mcp.capu" }),
      }),
    readSessionFile: () =>
      Promise.resolve({
        manifest: {
          version: 1,
          sessionId: "run-x",
          label: "run",
          startedAt: 0,
          duration: 10,
          deviceSerial: null,
          targetUrl: null,
          appPackage: null,
          tracks: { rrweb: false, network: false, console: false, automation: true },
        },
        automationNdjson: "",
      }),
  };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("run registry", () => {
  test("run_flow returns a run id without waiting for completion", () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startFlow("flow-1", "serial-1");
    expect(typeof runId).toBe("string");
    expect(registry.getStatus(runId).status).toBe("running");
  });

  test("concurrent MCP runs retain their authenticated principal and connection", () => {
    const registry = createRunRegistry(testDeps());
    const firstRun = registry.startFlow("flow-1", "serial-1", {
      principal: {
        id: "principal-claude",
        label: "Claude Desktop",
        kind: "mcp",
        connectionId: "mcp-session-1",
        clientName: "Claude Desktop",
      },
    });
    const secondRun = registry.startFlow("flow-1", "serial-1", {
      principal: {
        id: "principal-chatgpt",
        label: "ChatGPT Desktop",
        kind: "mcp",
        connectionId: "mcp-session-2",
        clientName: "ChatGPT Desktop",
      },
    });

    expect(registry.readEvents(firstRun).events[0]?.principalId).toBe("principal-claude");
    expect(registry.readEvents(firstRun).events[0]?.connectionId).toBe("mcp-session-1");
    expect(registry.readEvents(secondRun).events[0]?.principalId).toBe("principal-chatgpt");
    expect(registry.readEvents(secondRun).events[0]?.connectionId).toBe("mcp-session-2");
  });

  test("get_run_status reflects a finished run", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    expect(registry.getStatus(runId).status).toBe("passed");
    expect(registry.getStatus(runId).stepCount).toBe(1);
  });

  test("run_agent_goal with a remote policy and no acknowledgement is rejected", () => {
    const registry = createRunRegistry(testDeps());
    expect(() => registry.startGoal("sign in", "jev", "serial-1", {})).toThrow(
      /acknowledgeDataNotice/,
    );
  });

  test("run_agent_goal with acknowledgement starts", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startGoal("sign in", "rules", "serial-1", {
      flowId: "flow-1",
      acknowledgeDataNotice: true,
    });
    await tick();
    await tick();
    const status = registry.getStatus(runId);
    expect(["passed", "failed", "halted"]).toContain(status.status);
  });

  test("agent actions consume the task scope before device dispatch", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startGoal("Tap Go", "rules", "serial-1", {
      flowId: "flow-1",
      acknowledgeDataNotice: true,
    });
    await tick();
    await tick();
    expect(
      registry.readEvents(runId).events.some((event) => event.kind === "authorization.consumed"),
    ).toBe(true);
  });

  test("uses the selected flow package for a goal executor", async () => {
    const packages: string[] = [];
    const base = testDeps();
    const registry = createRunRegistry({
      ...base,
      createExecutorDeps: (serial, appPackage) => {
        packages.push(appPackage ?? "");
        return base.createExecutorDeps(serial);
      },
    });
    registry.startGoal("Tap Go", "rules", "serial-1", {
      flowId: "flow-1",
      acknowledgeDataNotice: true,
    });
    await tick();
    await tick();
    expect(packages).toContain("com.example.app");
  });

  test("persists the selected flow package in the durable goal task", () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startGoal("Tap Go", "rules", "serial-1", {
      flowId: "flow-1",
      acknowledgeDataNotice: true,
    });
    const created = registry.readEvents(runId).events[0];
    expect(created).toMatchObject({
      kind: "task.created",
      data: { appPackage: "com.example.app" },
    });
  });

  test("launches the selected package before asking the goal policy to decide", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startGoal("Tap Go", "rules", "serial-1", {
      flowId: "flow-1",
      acknowledgeDataNotice: true,
    });
    await tick();
    await tick();
    const actions = registry
      .readEvents(runId)
      .events.filter((event) => event.kind === "action.dispatched");
    expect(actions[0]).toMatchObject({
      data: { stepId: "bootstrap.open-app", operation: "openApp", status: "dispatched" },
    });
  });

  test("resuming a persisted task creates a new attempt with the same task id", () => {
    const registry = createRunRegistry(testDeps());
    const runId = resumePersistedGoal(
      registry,
      {
        task: {
          schemaVersion: 1,
          id: "task-restored",
          conversationId: null,
          origin: "local-chat",
          principal: {
            id: "principal-capubridge-local",
            label: "Capubridge",
            kind: "local",
            connectionId: null,
            clientName: null,
          },
          originalGoal: "resume this",
          appPackage: null,
          deviceSerial: "serial-1",
          reasoningOwner: "deterministic",
          authorizationScope: null,
          status: "awaiting-reasoner",
          activeRunId: null,
          terminalReason: null,
          createdAt: 1,
          updatedAt: 2,
        },
        runs: [
          {
            schemaVersion: 1,
            id: "run-old",
            taskId: "task-restored",
            attempt: 2,
            status: "pending",
            reasoningOwner: "deterministic",
            principalId: "principal-capubridge-local",
            deviceLease: null,
            startedAt: null,
            endedAt: null,
          },
        ],
        events: [],
      },
      "rules",
      "serial-1",
      { flowId: "flow-1" },
    );
    expect(registry.getStatus(runId).taskId).toBe("task-restored");
  });

  test("read_run_trace paginates and stays bounded", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    const first = await registry.readTrace(runId, 0, 1);
    expect(first.total).toBe(1);
    expect(first.records).toHaveLength(1);
    expect(first.records[0]?.operation).toBe("tap");
    const empty = await registry.readTrace(runId, 10, 5);
    expect(empty.records).toHaveLength(0);
    const clamped = await registry.readTrace(runId, 0, 5000);
    expect(clamped.limit).toBeLessThanOrEqual(500);
  });

  test("read_events exposes an ordered, bounded task evidence stream", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    const first = registry.readEvents(runId, null, 3);
    expect(first.events.map((event) => event.kind)).toEqual([
      "task.created",
      "run.started",
      "reasoning.decision",
    ]);
    expect(first.nextCursor).toBe("3");
    const next = registry.readEvents(runId, first.nextCursor, 5000);
    expect(next.events.at(-1)?.kind).toBe("task.terminal");
    expect(next.events).toHaveLength(4);
    expect(next.nextCursor).toBeNull();
  });

  test("stores a Presalio report only from explicitly verified assertion milestones", async () => {
    const milestones = [
      "app-opened",
      "location-obstacle-cleared",
      "next-stop-opened",
      "three-products-selected",
      "quantities-set-to-two",
      "order-reviewed",
      "order-confirmed",
      "report-returned",
    ] as const;
    const acceptanceFlow: Flow = {
      version: 1,
      id: "presalio-flow",
      name: "Presalio acceptance",
      appPackage: "com.presalio.app",
      acceptanceScenario: "presalio-order-v1",
      steps: milestones.map((acceptanceMilestone) => ({
        id: `assert-${acceptanceMilestone}`,
        op: "assert" as const,
        acceptanceMilestone,
        assertion: {
          kind: "visible" as const,
          source: "native" as const,
          target: { kind: "text" as const, text: acceptanceMilestone, exact: true },
        },
      })),
    };
    const base = testDeps();
    const registry = createRunRegistry({
      ...base,
      loadFlow: (flowId) => (flowId === acceptanceFlow.id ? acceptanceFlow : base.loadFlow(flowId)),
    });
    const runId = registry.startFlow(acceptanceFlow.id, "serial-1");
    await tick();
    await tick();
    const report = registry.readAcceptanceReport(runId);
    expect(report).toMatchObject({ availability: "completed", evidenceComplete: true });
    expect(registry.readEvents(runId).events.at(-2)?.kind).toBe("acceptance.reported");
  });

  test("promote_run returns the flow id and warnings", async () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    const promoted = await registry.promoteRun(runId, "Promoted");
    expect(typeof promoted.flowId).toBe("string");
    expect(Array.isArray(promoted.warnings)).toBe(true);
  });

  test("cancel_run cancels a running run and is idempotent on a finished one", async () => {
    const registry = createRunRegistry({
      ...testDeps(),
      createExecutorDeps: (serial) => ({
        ...testDeps().createExecutorDeps(serial),
        observe: () => new Promise<Observation>(() => {}),
      }),
    });
    const runningId = registry.startFlow("flow-1", "serial-1");
    const cancelled = await registry.cancelRun(runningId);
    expect(cancelled.cancelled).toBe(true);

    const plain = createRunRegistry(testDeps());
    const finishedId = plain.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    const again = await plain.cancelRun(finishedId);
    expect(again.cancelled).toBe(false);
    expect(again.status).toBe("passed");
  });

  test("list_flows returns saved flow summaries", () => {
    const registry = createRunRegistry(testDeps());
    expect(registry.listFlows()).toEqual([
      { id: "flow-1", name: "Go flow", appPackage: "com.example.app", stepCount: 1 },
    ]);
  });

  test("save_flow creates a validated flow the flows tab can open", () => {
    const registry = createRunRegistry(testDeps());
    const flowId = registry.createFlow({
      name: "Agent made",
      appPackage: "com.example.app",
      steps: [{ id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#go" } }],
    });
    expect(typeof flowId).toBe("string");
    expect(registry.listFlows().some((flow) => flow.id === flowId)).toBe(true);
    const runId = registry.startFlow(flowId, "serial-1");
    expect(typeof runId).toBe("string");
  });

  test("save_flow rejects invalid steps with precise paths", () => {
    const registry = createRunRegistry(testDeps());
    expect(() =>
      registry.createFlow({
        name: "Bad",
        appPackage: "com.example.app",
        steps: [{ id: "s1", op: "tap" }],
      }),
    ).toThrow(/steps\[0\]\.target/);
  });

  test("update_flow patches and delete_flow removes", () => {
    const registry = createRunRegistry(testDeps());
    const renamed = registry.updateFlow("flow-1", { name: "Renamed" });
    expect(renamed).toBe("flow-1");
    expect(registry.listFlows()[0]?.name).toBe("Renamed");
    expect(() => registry.updateFlow("missing", { name: "x" })).toThrow(/unknown flow/);
    expect(registry.deleteFlow("flow-1")).toBe(true);
    expect(registry.deleteFlow("flow-1")).toBe(false);
  });
});

describe("registry observers", () => {
  test("an MCP-started flow run reaches an observer that never touched the UI", async () => {
    const registry = createRunRegistry(testDeps());
    const events: RunEvent[] = [];
    registry.subscribe((event) => events.push(event));
    const runId = registry.startFlow("flow-1", "serial-1", {
      principal: {
        id: "principal-claude",
        label: "Claude Desktop",
        kind: "mcp",
        connectionId: "conn-1",
        clientName: "claude",
      },
    });
    await tick();
    await tick();
    const start = events.find((event) => event.kind === "started");
    expect(start?.runId).toBe(runId);
    expect(start?.kind === "started" ? start.origin : null).toBe("mcp");
    expect(events.some((event) => event.kind === "step")).toBe(true);
    expect(events.some((event) => event.kind === "finished")).toBe(true);
  });

  test("a folded observer stream reproduces the run the registry reports", async () => {
    const registry = createRunRegistry(testDeps());
    let runs = new Map<string, ActiveRun>();
    registry.subscribe((event) => {
      runs = applyRunEvent(runs, event);
    });
    const runId = registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    const status = registry.getStatus(runId);
    const observed = activeRunOf(runs, runId);
    expect(observed?.status).toBe(status.status);
    expect(observed?.records).toHaveLength(status.stepCount);
  });

  test("a throwing observer does not stop the run or the other observers", async () => {
    const registry = createRunRegistry(testDeps());
    const seen: string[] = [];
    registry.subscribe(() => {
      throw new Error("broken surface");
    });
    registry.subscribe((event) => seen.push(event.kind));
    const runId = registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    expect(registry.getStatus(runId).status).toBe("passed");
    expect(seen).toContain("finished");
  });

  test("unsubscribing stops delivery", async () => {
    const registry = createRunRegistry(testDeps());
    const seen: string[] = [];
    const stop = registry.subscribe((event) => seen.push(event.kind));
    stop();
    registry.startFlow("flow-1", "serial-1");
    await tick();
    await tick();
    expect(seen).toHaveLength(0);
  });
});

describe("goal app authorization", () => {
  test("a goal with no app and no flow is refused at start, before any observation", () => {
    const observed: string[] = [];
    const registry = createRunRegistry({
      ...testDeps(),
      createExecutorDeps: (serial, appPackage) => {
        observed.push(appPackage ?? "");
        return testDeps().createExecutorDeps(serial, appPackage);
      },
    });
    expect(() =>
      registry.startGoal("Open stock", "jev", "serial-1", { acknowledgeDataNotice: true }),
    ).toThrow("app_package");
    expect(observed).toHaveLength(0);
  });

  test("an explicit app package authorizes that app", () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startGoal("Open stock", "jev", "serial-1", {
      acknowledgeDataNotice: true,
      appPackage: "com.presalio.app",
    });
    const { task } = registry.getTask(registry.getStatus(runId).taskId);
    expect(task.authorizationScope?.appPackages).toEqual(["com.presalio.app"]);
  });

  test("a flow's app package still authorizes when none is passed", () => {
    const registry = createRunRegistry(testDeps());
    const runId = registry.startGoal("Tap Go", "rules", "serial-1", { flowId: "flow-1" });
    const { task } = registry.getTask(registry.getStatus(runId).taskId);
    expect(task.authorizationScope?.appPackages).toEqual(["com.example.app"]);
  });
});
