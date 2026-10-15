import { describe, expect, test } from "vite-plus/test";
import { createReasoningStreamEvent } from "../streamEvents";

describe("createReasoningStreamEvent", () => {
  test("keeps model activity canonical and redacts provider credentials", () => {
    const event = createReasoningStreamEvent(
      {
        id: "event-1",
        taskId: "task-1",
        runId: "run-1",
        sequence: 1,
        occurredAt: 1,
        origin: "local-chat",
        principalId: "local-user",
        connectionId: null,
      },
      {
        provider: "openrouter",
        modelId: "openrouter/auto",
        phase: "text",
        detail: "Bearer sk-12345678901234567890",
      },
    );

    expect(event.kind).toBe("reasoning.streamed");
    expect(event.data.detail).toBe("[redacted]");
  });
});
