import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const { invokeCommand } = vi.hoisted(() => ({ invokeCommand: vi.fn() }));

vi.mock("@/runtime/ipc/client", () => ({ invokeCommand }));

import { createArtemisTransport } from "../artemisTransport";

describe("artemis transport", () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  test("turns repeated provider capacity retries into a terminal supervised failure", async () => {
    invokeCommand.mockResolvedValueOnce({ status: "running", elapsed_seconds: 12 });
    invokeCommand.mockResolvedValueOnce([
      {
        generic_tools: [
          { type: "llm_call", status: "failed", payload: { error: "503 Service Unavailable" } },
          { type: "llm_call", status: "retrying", payload: { error: "503 Service Unavailable" } },
          { type: "llm_call", status: "retrying", payload: { error: "503 Service Unavailable" } },
        ],
      },
    ]);

    const status = await createArtemisTransport().taskStatus("trace-1");

    expect(status.state).toBe("failed");
    expect(status.error).toContain("provider unavailable after 3 retries");
  });

  test("keeps a normal running trace supervised", async () => {
    invokeCommand.mockResolvedValueOnce({ status: "running", elapsed_seconds: 12 });
    invokeCommand.mockResolvedValueOnce([]);

    const status = await createArtemisTransport().taskStatus("trace-1");

    expect(status.state).toBe("running");
    expect(status.error).toBeNull();
  });

  test("reuses the status observation when mapping actions", async () => {
    invokeCommand.mockResolvedValueOnce({ status: "running", elapsed_seconds: 12 });
    invokeCommand.mockResolvedValueOnce([
      { generic_tools: [{ type: "action", trace_id: "tap-1", name: "tap", status: "success" }] },
    ]);
    const transport = createArtemisTransport();

    await transport.taskStatus("trace-1");
    const actions = await transport.listActions?.("trace-1");

    expect(actions).toEqual([{ id: "tap-1", name: "tap", status: "success", error: null }]);
    expect(invokeCommand).toHaveBeenCalledTimes(2);
  });
});
