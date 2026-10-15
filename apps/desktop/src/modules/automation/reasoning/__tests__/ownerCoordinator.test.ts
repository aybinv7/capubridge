import { describe, expect, test } from "vite-plus/test";
import { createReasoningOwnerCoordinator } from "../ownerCoordinator";

describe("reasoning owner coordinator", () => {
  test("rejects concurrent owners and permits takeover after expiry", () => {
    let time = 0;
    const coordinator = createReasoningOwnerCoordinator(() => time, 10);
    coordinator.claim("task-1", "mcp-host", "connection-a");
    expect(() => coordinator.claim("task-1", "embedded", null)).toThrow("owned by mcp-host");
    time = 10;
    expect(coordinator.claim("task-1", "embedded", null)).toMatchObject({ owner: "embedded" });
  });

  test("requires the current owner for heartbeat and release", () => {
    const coordinator = createReasoningOwnerCoordinator();
    coordinator.claim("task-1", "mcp-host", "connection-a");
    expect(() => coordinator.heartbeat("task-1", "mcp-host", "connection-b")).toThrow(
      "no matching owner",
    );
    expect(() => coordinator.release("task-1", "embedded", null)).toThrow("owned by mcp-host");
  });
});
