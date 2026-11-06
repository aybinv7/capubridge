import { describe, expect, test } from "vite-plus/test";
import libraryText from "../__fixtures__/flow-library-artemis-v1.json?raw";
import { ARTEMIS_MIGRATION_NOTE, migrateStoredFlow } from "../flowMigrate";
import { createLocalStorageFlowStorage } from "../flowStorage";
import { parseFlowDsl } from "../flowDsl";
import { createEmptyFlow } from "../flowSchema";
import { REMOVED_ARTEMIS_MESSAGE } from "../removedPolicies";

const FLOW_LIBRARY_KEY = "capubridge.automation.flows.v1";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial));
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

describe("flows saved before Artemis was removed", () => {
  test("a library naming Artemis still loads every flow", () => {
    const storage = createLocalStorageFlowStorage(
      memoryStorage({ [FLOW_LIBRARY_KEY]: libraryText }),
    );
    expect(storage.list().map((flow) => flow.id)).toEqual(["flow-artemis-mixed", "flow-plain"]);
  });

  test("an Artemis goal step moves to Jev, keeps its goal and limits, and must be acknowledged again", () => {
    const storage = createLocalStorageFlowStorage(
      memoryStorage({ [FLOW_LIBRARY_KEY]: libraryText }),
    );
    const migrated = storage.list().find((flow) => flow.id === "flow-artemis-mixed");
    const step = migrated?.steps.find((entry) => entry.id === "step-goal-artemis");
    expect(step).toEqual({
      id: "step-goal-artemis",
      op: "goal",
      goal: "Open the orders list",
      policyId: "jev",
      limits: { maxSteps: 60, maxDurationMs: 600000, maxConsecutiveFailures: 5 },
      acknowledgedNotice: false,
    });
  });

  test("the migrated flow carries a note, other steps and flows are untouched", () => {
    const storage = createLocalStorageFlowStorage(
      memoryStorage({ [FLOW_LIBRARY_KEY]: libraryText }),
    );
    const [mixed, plain] = storage.list();
    expect(mixed?.migrationNote).toBe(ARTEMIS_MIGRATION_NOTE);
    expect(mixed?.steps.find((entry) => entry.id === "step-goal-rules")).toMatchObject({
      policyId: "rules",
      acknowledgedNotice: true,
    });
    expect(plain?.migrationNote).toBeUndefined();
  });

  test("saving the migrated library drops Artemis for good and keeps the note", () => {
    const backing = memoryStorage({ [FLOW_LIBRARY_KEY]: libraryText });
    const storage = createLocalStorageFlowStorage(backing);
    storage.saveAll(storage.list());
    const saved = backing.getItem(FLOW_LIBRARY_KEY) ?? "";
    expect(saved).not.toContain('"artemis"');
    expect(storage.list()[0]?.migrationNote).toBe(ARTEMIS_MIGRATION_NOTE);
  });

  test("a flow without an Artemis step comes back as the same object", () => {
    const flow = { version: 1, id: "f", name: "n", appPackage: "a.b", steps: [] };
    expect(migrateStoredFlow(flow)).toBe(flow);
    expect(migrateStoredFlow(null)).toBeNull();
    expect(migrateStoredFlow("not a flow")).toBe("not a flow");
  });

  test("the source editor refuses a new Artemis goal and names Jev", () => {
    const result = parseFlowDsl(
      'goal artemis "open orders" 40 300000 5',
      createEmptyFlow("Orders", "com.presalio.app"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toBe(REMOVED_ARTEMIS_MESSAGE);
    }
  });
});
