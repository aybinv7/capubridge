import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { effectScope, nextTick, ref } from "vue";
import type { DeviceOrientation, RotationController, RotationSettings } from "../deviceRotation";
import { RotationError } from "../deviceRotation";
import { useDeviceRotation } from "../useDeviceRotation";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("vue-sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/composables/useAdb", () => ({ useAdb: () => ({ shellCommand: vi.fn() }) }));

function controllerWith(initial: RotationSettings) {
  let settings = initial;
  const controller: RotationController = {
    read: vi.fn(async () => settings),
    hold: vi.fn(async (_serial: string, target: DeviceOrientation) => {
      settings = { autoRotate: false, userRotation: target === "landscape" ? 1 : 0 };
      return settings;
    }),
    restoreAuto: vi.fn(async () => {
      settings = { ...settings, autoRotate: true };
      return settings;
    }),
  };
  return controller;
}

async function settle() {
  await Promise.resolve();
  await nextTick();
}

const scopes: Array<ReturnType<typeof effectScope>> = [];

function mount(controller: RotationController, orientation: DeviceOrientation | null = "portrait") {
  const scope = effectScope();
  scopes.push(scope);
  const serial = ref<string | null>("emulator-5554");
  const streamOrientation = ref<DeviceOrientation | null>(orientation);
  const rotation = scope.run(() => useDeviceRotation({ serial, streamOrientation, controller }));
  if (!rotation) throw new Error("scope did not run");
  return { rotation, serial, streamOrientation };
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  toastError.mockReset();
});

describe("useDeviceRotation", () => {
  it("reads the device and offers the opposite of what the stream shows", async () => {
    const { rotation, streamOrientation } = mount(
      controllerWith({ autoRotate: true, userRotation: 0 }),
    );
    await settle();
    expect(rotation.available.value).toBe(true);
    expect(rotation.locked.value).toBe(false);
    expect(rotation.target.value).toBe("landscape");
    streamOrientation.value = "landscape";
    expect(rotation.target.value).toBe("portrait");
  });

  it("trusts the held turn over a stream that has not caught up yet", async () => {
    const { rotation } = mount(controllerWith({ autoRotate: false, userRotation: 1 }), "portrait");
    await settle();
    expect(rotation.current.value).toBe("landscape");
    expect(rotation.target.value).toBe("portrait");
  });

  it("rotates, marks the orientation as held, and restores auto-rotate", async () => {
    const controller = controllerWith({ autoRotate: true, userRotation: 0 });
    const { rotation } = mount(controller);
    await settle();

    await rotation.rotate();
    expect(controller.hold).toHaveBeenCalledWith("emulator-5554", "landscape", {
      autoRotate: true,
      userRotation: 0,
    });
    expect(rotation.locked.value).toBe(true);
    expect(rotation.current.value).toBe("landscape");

    await rotation.restoreAuto();
    expect(rotation.locked.value).toBe(false);
    expect(rotation.busy.value).toBe(false);
  });

  it("shows a failure and re-reads the real state", async () => {
    const controller = controllerWith({ autoRotate: true, userRotation: 0 });
    controller.hold = vi.fn(async () => {
      throw new RotationError("The device refused to turn landscape", "SecurityException");
    });
    const { rotation } = mount(controller);
    await settle();

    await rotation.rotate();
    expect(toastError).toHaveBeenCalledWith("The device refused to turn landscape", {
      description: "SecurityException",
    });
    expect(controller.read).toHaveBeenCalledTimes(2);
    expect(rotation.locked.value).toBe(false);
  });

  it("is unavailable without a device or when the settings cannot be read", async () => {
    const controller = controllerWith({ autoRotate: true, userRotation: 0 });
    controller.read = vi.fn(async () => {
      throw new Error("offline");
    });
    const { rotation, serial } = mount(controller);
    await settle();
    expect(rotation.available.value).toBe(false);

    serial.value = null;
    await settle();
    await rotation.rotate();
    expect(controller.hold).not.toHaveBeenCalled();
  });
});
