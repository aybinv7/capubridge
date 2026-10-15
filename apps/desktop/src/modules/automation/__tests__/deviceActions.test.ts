import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createDeviceActions, createFakeDeviceActions } from "../deviceActions";

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
}));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: mocks.invokeCommand,
}));

const invokeMock = mocks.invokeCommand;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue("");
});

describe("createDeviceActions", () => {
  test("tap invokes adb_shell_command with an input tap", async () => {
    await createDeviceActions().tap("serial-1", 100, 200);
    expect(invokeMock.mock.calls).toEqual([
      ["adb_shell_command", { serial: "serial-1", command: "input tap 100 200" }],
    ]);
  });

  test("longPress invokes a same-point swipe with the duration", async () => {
    await createDeviceActions().longPress("serial-1", 10, 20, 800);
    expect(invokeMock.mock.calls).toEqual([
      ["adb_shell_command", { serial: "serial-1", command: "input swipe 10 20 10 20 800" }],
    ]);
  });

  test("swipe invokes adb_shell_command with the endpoints and duration", async () => {
    await createDeviceActions().swipe("serial-1", { x: 1, y: 2 }, { x: 3, y: 4 }, 300);
    expect(invokeMock.mock.calls).toEqual([
      ["adb_shell_command", { serial: "serial-1", command: "input swipe 1 2 3 4 300" }],
    ]);
  });

  test("inputText escapes spaces and quotes for the device shell", async () => {
    await createDeviceActions().inputText("serial-1", "a b'cé");
    expect(invokeMock.mock.calls).toEqual([
      ["adb_shell_command", { serial: "serial-1", command: `input text 'a%sb'\\''cé'` }],
    ]);
  });

  test("pressKey invokes adb_shell_command with the keycode", async () => {
    await createDeviceActions().pressKey("serial-1", "KEYCODE_ENTER");
    expect(invokeMock.mock.calls).toEqual([
      ["adb_shell_command", { serial: "serial-1", command: "input keyevent 'KEYCODE_ENTER'" }],
    ]);
  });

  test("back invokes the back keyevent", async () => {
    await createDeviceActions().back("serial-1");
    expect(invokeMock.mock.calls).toEqual([
      ["adb_shell_command", { serial: "serial-1", command: "input keyevent KEYCODE_BACK" }],
    ]);
  });

  test("openApp invokes adb_open_package", async () => {
    invokeMock.mockResolvedValue("ok");
    await createDeviceActions().openApp("serial-1", "com.example.app");
    expect(invokeMock.mock.calls).toEqual([
      ["adb_open_package", { serial: "serial-1", packageName: "com.example.app" }],
    ]);
  });

  test("screenSize parses wm size output", async () => {
    invokeMock.mockResolvedValue("Physical size: 1080x2400\n");
    await expect(createDeviceActions().screenSize("serial-1")).resolves.toEqual({
      width: 1080,
      height: 2400,
    });
  });

  test("a rejecting invoke names the action and the serial", async () => {
    invokeMock.mockRejectedValue(new Error("no route to host"));
    await expect(createDeviceActions().tap("serial-9", 1, 1)).rejects.toThrow(/tap.*serial-9/);
    await expect(createDeviceActions().openApp("serial-9", "com.example.app")).rejects.toThrow(
      /openApp.*serial-9/,
    );
  });

  test("error-marked device output fails instead of passing silently", async () => {
    invokeMock.mockResolvedValue("Error: Unknown command tap");
    await expect(createDeviceActions().tap("serial-1", 1, 1)).rejects.toThrow(/serial-1/);
  });
});

describe("createFakeDeviceActions", () => {
  test("records calls in order and honours configured results", async () => {
    const fake = createFakeDeviceActions({ screenSize: { width: 720, height: 1600 } });
    await fake.tap("s", 1, 2);
    await fake.inputText("s", "hi");
    await expect(fake.screenSize("s")).resolves.toEqual({ width: 720, height: 1600 });
    expect(fake.calls.map((call) => call.method)).toEqual(["tap", "inputText", "screenSize"]);
    expect(fake.calls[0]).toEqual({ method: "tap", args: ["s", 1, 2] });
  });

  test("honours configured failures without recording the call", async () => {
    const fake = createFakeDeviceActions({ failures: { swipe: "boom" } });
    await expect(fake.swipe("s", { x: 0, y: 0 }, { x: 1, y: 1 }, 100)).rejects.toThrow("boom");
    expect(fake.calls).toEqual([]);
  });
});
