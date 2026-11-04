import { describe, expect, it } from "vite-plus/test";
import {
  READ_ROTATION_COMMAND,
  RESTORE_AUTO_ROTATE_COMMAND,
  RotationError,
  createRotationController,
  lockRotationCommand,
  oppositeOrientation,
  orientationOfSize,
  parseRotationSettings,
  quarterTurnFor,
  shellFailure,
} from "../deviceRotation";

function fakeDevice(
  initial: { auto: string; user: string },
  options: { ignoreWrites?: boolean } = {},
) {
  const state = { ...initial };
  const commands: string[] = [];
  async function shell(serial: string, command: string) {
    commands.push(`${serial}: ${command}`);
    if (command === READ_ROTATION_COMMAND) return `${state.auto}\n${state.user}\n`;
    if (options.ignoreWrites) return "";
    if (command === RESTORE_AUTO_ROTATE_COMMAND) {
      state.auto = "1";
      return "";
    }
    const lock = /user_rotation (\d)/.exec(command);
    if (lock) {
      state.auto = "0";
      state.user = lock[1];
      return "";
    }
    return "/system/bin/sh: unknown command";
  }
  return { state, commands, shell };
}

describe("parseRotationSettings", () => {
  it("reads auto-rotate and the held quarter turn", () => {
    expect(parseRotationSettings("0\n1\n")).toEqual({ autoRotate: false, userRotation: 1 });
    expect(parseRotationSettings("1\r\n0\r\n")).toEqual({ autoRotate: true, userRotation: 0 });
  });

  it("uses Android's defaults when a setting was never written", () => {
    expect(parseRotationSettings("null\nnull\n")).toEqual({ autoRotate: true, userRotation: 0 });
  });

  it("rejects errors and values outside Android's range", () => {
    expect(() => parseRotationSettings("Security exception: permission denied")).toThrow(
      RotationError,
    );
    expect(() => parseRotationSettings("1\n7\n")).toThrow(RotationError);
    expect(() => parseRotationSettings("yes\n0\n")).toThrow(RotationError);
  });
});

describe("rotation helpers", () => {
  it("builds a lock that turns auto-rotate off before holding the turn", () => {
    expect(lockRotationCommand(1)).toBe(
      "settings put system accelerometer_rotation 0 2>&1 && settings put system user_rotation 1 2>&1",
    );
  });

  it("reads a stream size as an orientation", () => {
    expect(orientationOfSize(1080, 2400)).toBe("portrait");
    expect(orientationOfSize(2400, 1080)).toBe("landscape");
    expect(orientationOfSize(0, 2400)).toBeNull();
    expect(oppositeOrientation("portrait")).toBe("landscape");
  });

  it("keeps a held turn that already matches and otherwise picks the natural one", () => {
    expect(quarterTurnFor("landscape", { autoRotate: true, userRotation: 0 })).toBe(1);
    expect(quarterTurnFor("landscape", { autoRotate: false, userRotation: 3 })).toBe(3);
    expect(quarterTurnFor("portrait", { autoRotate: false, userRotation: 3 })).toBe(0);
    expect(quarterTurnFor("portrait", { autoRotate: false, userRotation: 2 })).toBe(2);
  });

  it("only treats words as failures", () => {
    expect(shellFailure("")).toBeNull();
    expect(shellFailure("1\n")).toBeNull();
    expect(shellFailure("Error: bad value")).toBe("Error: bad value");
  });
});

describe("createRotationController", () => {
  it("holds landscape, verifies it, then restores auto-rotate", async () => {
    const device = fakeDevice({ auto: "1", user: "0" });
    const controller = createRotationController(device.shell);
    const before = await controller.read("emulator-5554");

    await expect(controller.hold("emulator-5554", "landscape", before)).resolves.toEqual({
      autoRotate: false,
      userRotation: 1,
    });
    await expect(controller.restoreAuto("emulator-5554")).resolves.toEqual({
      autoRotate: true,
      userRotation: 1,
    });
    expect(device.commands.every((command) => command.startsWith("emulator-5554: "))).toBe(true);
  });

  it("reports a device that ignores the write instead of claiming success", async () => {
    const device = fakeDevice({ auto: "1", user: "0" }, { ignoreWrites: true });
    const controller = createRotationController(device.shell);
    await expect(
      controller.hold("R58", "landscape", { autoRotate: true, userRotation: 0 }),
    ).rejects.toThrow("did not keep the landscape orientation");
    device.state.auto = "0";
    await expect(controller.restoreAuto("R58")).rejects.toThrow("kept auto-rotate off");
  });

  it("surfaces the device's own error text", async () => {
    const controller = createRotationController(async (_serial, command) =>
      command === READ_ROTATION_COMMAND ? "1\n0\n" : "java.lang.SecurityException: denied",
    );
    const error = await controller
      .hold("R58", "portrait", { autoRotate: false, userRotation: 1 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RotationError);
    expect((error as RotationError).detail).toContain("SecurityException");
  });
});
