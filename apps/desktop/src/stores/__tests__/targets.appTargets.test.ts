import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { CDPTarget } from "@/types/cdp.types";
import type { SessionDeviceSnapshot } from "@/types/session.types";
import { installMemoryStorage } from "@/test/memory-storage";

const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: ipc.invoke,
}));

import { useConnectionStore } from "../connection.store";
import { useSessionStore } from "../session.store";
import { useTargetsStore } from "../targets.store";

const SERIAL = "phone-a";

function device(serial: string): SessionDeviceSnapshot {
  return {
    serial,
    model: "Pixel",
    product: "pixel",
    transportId: "1",
    deviceKind: "physical",
    connectionType: "usb",
    status: "online",
    temperature: "hot",
    isStale: false,
    lastSeenAt: null,
    lastUpdatedAt: 0,
  };
}

function webview(packageName: string): CDPTarget {
  return {
    id: `wv:${packageName}`,
    type: "page",
    title: packageName,
    url: "https://localhost/",
    source: "adb",
    deviceSerial: SERIAL,
    packageName,
    webSocketDebuggerUrl: "ws://127.0.0.1:53000/devtools/page/1",
  };
}

describe("app targets", () => {
  let targets: ReturnType<typeof useTargetsStore>;

  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
    ipc.invoke.mockReset();
    const session = useSessionStore();
    session.registry = { ...session.registry, devices: [device(SERIAL)], activeSerial: SERIAL };
    targets = useTargetsStore();
  });

  test("debuggable apps without a live WebView become app targets", async () => {
    targets.targets = [webview("com.hybrid.app")];
    ipc.invoke.mockResolvedValueOnce(["com.hybrid.app", "com.native.app"]);

    await targets.refreshDebuggablePackages(SERIAL);

    expect(ipc.invoke).toHaveBeenCalledWith("adb_list_debuggable_packages", { serial: SERIAL });
    expect(targets.targets.map((target) => target.id)).toEqual([
      "wv:com.hybrid.app",
      `app:${SERIAL}:com.native.app`,
    ]);
  });

  test("labels rename the app targets and the selection follows", async () => {
    ipc.invoke.mockResolvedValueOnce(["com.native.app"]);
    await targets.refreshDebuggablePackages(SERIAL);
    targets.selectTarget(targets.targets[0]);

    targets.setAppLabels(SERIAL, { "com.native.app": "Notes" });

    expect(targets.selectedTarget?.title).toBe("Notes");
    expect(targets.cdpTargetId).toBe("");
  });

  test("a selected app target is restored once the scan finds it again", async () => {
    localStorage.setItem("capubridge:target-url", "android-app://com.native.app");
    ipc.invoke.mockResolvedValueOnce(["com.native.app"]);

    await targets.refreshDebuggablePackages(SERIAL);

    expect(targets.selectedTarget?.id).toBe(`app:${SERIAL}:com.native.app`);
  });

  test("a failed scan keeps the targets and records why", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    targets.targets = [webview("com.hybrid.app")];
    ipc.invoke.mockRejectedValueOnce(new Error("device offline"));

    await targets.refreshDebuggablePackages(SERIAL);

    expect(targets.targets).toHaveLength(1);
    expect(targets.appScanError.get(SERIAL)).toContain("device offline");
    expect(targets.error).toBeNull();
  });

  test("the connection store refuses an app target before touching any state", async () => {
    ipc.invoke.mockResolvedValueOnce(["com.native.app"]);
    await targets.refreshDebuggablePackages(SERIAL);
    const connection = useConnectionStore();

    await expect(connection.connect(targets.targets[0])).rejects.toThrow("has no WebView");
    expect(connection.selectedTargetId).toBeNull();
    expect(connection.failures.size).toBe(0);
    expect(ipc.invoke).toHaveBeenCalledTimes(1);
  });
});
