import { describe, expect, test } from "vite-plus/test";
import { artemisDiagnosticMessage } from "../artemisDiagnostics";

describe("artemisDiagnosticMessage", () => {
  test("keeps the daemon repair sequence actionable", () => {
    expect(
      artemisDiagnosticMessage({
        verdict: "blocked",
        next_steps: ["Unlock device.", "Restart daemon."],
      }),
    ).toBe("Unlock device. Restart daemon.");
  });

  test("names a ready daemon without misclassifying the current task error", () => {
    expect(artemisDiagnosticMessage({ overall_ready: true, probes: [] })).toBe(
      "ARTEMIS daemon and device are ready. Inspect the task error for the failed launch.",
    );
  });

  test("uses failed readiness probes when the daemon returns its current schema", () => {
    expect(
      artemisDiagnosticMessage({
        probes: [{ status: "fail", description: "Unlock the target device." }],
      }),
    ).toBe("Unlock the target device.");
  });
});
