import { describe, expect, test } from "vite-plus/test";
import type { Flow } from "@/types/automation.types";
import { parseFlow, serializeFlow, validateStep } from "../flowSchema";
import { EDITABLE_STEP_OPS } from "../flowEditorState";
import {
  createStep,
  deleteStep,
  duplicateFlow,
  flowRunnability,
  moveStep,
  targetStrength,
} from "../flowEditorState";
import { createLocalStorageFlowStorage } from "../flowStorage";

/** Minimal in-memory Web Storage backend for persistence tests. */
function memoryStorage(): Storage {
  const backing = new Map<string, string>();
  return {
    get length() {
      return backing.size;
    },
    clear: () => {
      backing.clear();
    },
    getItem: (key: string) => (backing.has(key) ? (backing.get(key) as string) : null),
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key);
    },
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
  };
}

function validFlow(): Flow {
  return {
    version: 1,
    id: "flow-1",
    name: "Flow",
    appPackage: "com.example.app",
    steps: [createStep("tap"), createStep("wait")],
  };
}

describe("flow editor state", () => {
  test("adding a step of each editable op produces a valid default step", () => {
    for (const op of EDITABLE_STEP_OPS) {
      expect(validateStep(createStep(op))).toEqual([]);
    }
    expect(EDITABLE_STEP_OPS).not.toContain("goal");
  });

  test("reordering moves the step and preserves ids", () => {
    const flow = validFlow();
    const [first, second] = flow.steps;
    if (first === undefined || second === undefined) {
      throw new Error("fixture needs two steps");
    }
    const reordered = moveStep(flow.steps, 0, 1);
    expect(reordered.map((step) => step.id)).toEqual([second.id, first.id]);
  });

  test("deleting a step leaves the rest in order", () => {
    const flow = validFlow();
    const remaining = deleteStep(flow.steps, 0);
    expect(remaining.map((step) => step.id)).toEqual(flow.steps.slice(1).map((step) => step.id));
  });

  test("duplicating a flow yields a new id and an unchanged step list", () => {
    const flow = validFlow();
    const copy = duplicateFlow(flow);
    expect(copy.id).not.toBe(flow.id);
    expect(copy.steps).toEqual(flow.steps);
  });

  test("an invalid step makes the flow not runnable and names the step index", () => {
    const flow = validFlow();
    const invalid = { id: "broken", op: "wait" } as unknown as Flow["steps"][number];
    const runnability = flowRunnability({ ...flow, steps: [...flow.steps, invalid] });
    expect(runnability.runnable).toBe(false);
    expect(runnability.reason).toContain("3");
  });

  test("persist then load round-trips a flow with no loss", () => {
    const storage = createLocalStorageFlowStorage(memoryStorage());
    const flow = validFlow();
    storage.saveAll([flow]);
    const loaded = storage.list();
    expect(loaded).toHaveLength(1);
    expect(parseFlow(JSON.parse(serializeFlow(loaded[0])) as unknown)).toEqual({
      ok: true,
      flow,
    });
  });

  test("target strength reads stronger for selectors than for points", () => {
    expect(targetStrength({ kind: "selector", cssSelector: "#a" })).toBe("strong");
    expect(targetStrength({ kind: "text", text: "Go", exact: false })).toBe("fair");
    expect(targetStrength({ kind: "point", x: 1, y: 2 })).toBe("weak");
    expect(targetStrength(undefined)).toBeNull();
  });
});
