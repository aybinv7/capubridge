import { describe, expect, test } from "vite-plus/test";
import { createProviderAwaitingEvent } from "../providerRecovery";
import { ReasoningProviderError } from "../providerTypes";

describe("provider recovery", () => {
  test("turns a timeout into a resumable task event", () => {
    const event = createProviderAwaitingEvent(
      {
        id: "event-2",
        taskId: "task-1",
        runId: "run-1",
        sequence: 2,
        occurredAt: 2,
        origin: "local-chat",
        principalId: "local-user",
        connectionId: null,
      },
      new ReasoningProviderError("timeout", "Provider request timed out", true),
    );

    expect(event.data).toEqual({
      status: "awaiting-reasoner",
      reason: "timeout:Provider request timed out",
    });
  });
});
