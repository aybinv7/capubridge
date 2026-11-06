import { describe, expect, test } from "vite-plus/test";
import recordsText from "../__fixtures__/stored-artemis-run-v1.json?raw";
import type { RustSessionListItem } from "@/types/replay.types";
import { policyLabelOf, policyProvenance, toRunRow } from "../runHistory";
import { describeStoredOwner } from "../taskEvents";
import type { PersistedAutomationTaskSnapshot } from "../taskEvents";

const records = JSON.parse(recordsText) as {
  sessionListItem: RustSessionListItem;
  taskSnapshot: PersistedAutomationTaskSnapshot;
};

describe("runs and tasks recorded by the removed Artemis agent", () => {
  test("a recorded Artemis run still lists, labelled as removed", () => {
    const row = toRunRow(records.sessionListItem);
    expect(row).not.toBeNull();
    expect(row?.policyId).toBe("artemis");
    expect(policyLabelOf(row?.policyId ?? "")).toBe("Artemis (removed)");
  });

  test("its provenance stays local, as it was when it ran", () => {
    expect(policyProvenance("artemis")).toContain("nothing left the machine");
  });

  test("current policies keep their names and an unknown id shows as recorded", () => {
    expect(policyLabelOf("jev")).toBe("Jev");
    expect(policyLabelOf("rules")).toBe("Rules");
    expect(policyLabelOf("embedded")).toBe("Embedded reasoning");
    expect(policyLabelOf("mystery")).toBe("mystery");
  });

  test("a stored task Artemis owned names it as removed", () => {
    expect(describeStoredOwner(records.taskSnapshot.task.reasoningOwner)).toBe("Artemis (removed)");
    expect(records.taskSnapshot.runs[0]?.reasoningOwner).toBe("artemis");
  });

  test("other owners read as stored, and a missing owner says so", () => {
    expect(describeStoredOwner("embedded")).toBe("embedded");
    expect(describeStoredOwner(null)).toBe("owner undisclosed");
  });
});
