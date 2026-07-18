import { beforeEach, expect, test, vi } from "vite-plus/test";
import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { IpcError, normalizeIpcError } from "@/runtime/ipc/error";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.listen.mockReset();
});

test("invokes a typed command with its canonical arguments", async () => {
  mocks.invoke.mockResolvedValue("ok");

  const result = await invokeCommand("session_shell_command", {
    serial: "device-1",
    command: "getprop",
  });

  expect(result).toBe("ok");
  expect(mocks.invoke).toHaveBeenCalledWith("session_shell_command", {
    serial: "device-1",
    command: "getprop",
  });
});

test("normalizes rejected command failures", async () => {
  mocks.invoke.mockRejectedValue("Device disconnected");

  const failure = await invokeCommand("session_list_devices").catch((error) => error);

  expect(failure).toBeInstanceOf(IpcError);
  expect(failure).toMatchObject({
    command: "session_list_devices",
    category: "unavailable",
    code: "IPC_UNAVAILABLE",
    retryable: true,
  });
});

test("delivers typed event payloads and returns cleanup", async () => {
  const cleanup = vi.fn();
  mocks.listen.mockImplementation(async (_name, handler) => {
    handler({ payload: "device-1" });
    return cleanup;
  });
  const received: string[] = [];

  const unlisten = await listenEvent("perf:stopped", (serial) => received.push(serial));

  expect(received).toEqual(["device-1"]);
  expect(unlisten).toBe(cleanup);
});

test("classifies aborted operations separately", () => {
  const controller = new AbortController();
  controller.abort();

  const error = normalizeIpcError("transport failed", {
    operation: "invoke",
    name: "session_refresh_devices",
    signal: controller.signal,
  });

  expect(error.category).toBe("cancelled");
  expect(error.code).toBe("IPC_CANCELLED");
  expect(error.retryable).toBe(false);
});

test("preserves structured backend error fields", () => {
  const error = normalizeIpcError(
    {
      category: "timeout",
      code: "SESSION_TIMEOUT",
      message: "Session request timed out",
      retryable: true,
      operation: "session_refresh_targets",
    },
    {
      operation: "invoke",
      name: "session_refresh_targets",
    },
  );

  expect(error).toMatchObject({
    category: "timeout",
    code: "SESSION_TIMEOUT",
    message: "Session request timed out",
    retryable: true,
  });
});
