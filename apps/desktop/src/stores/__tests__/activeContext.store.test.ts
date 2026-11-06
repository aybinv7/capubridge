import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useActiveContextStore } from "../activeContext.store";
import { useSessionStore } from "../session.store";
import { useTargetsStore } from "../targets.store";
import { useConnectionStore } from "../connection.store";
import type { CDPTarget } from "@/types/cdp.types";
import { installMemoryStorage } from "@/test/memory-storage";
import { createAppTarget } from "@/lib/app-target";

function adbTarget(id: string, serial: string): CDPTarget {
  return { id, type: "page", title: id, url: `https://${id}`, source: "adb", deviceSerial: serial };
}

function localTarget(id: string): CDPTarget {
  return {
    id,
    type: "page",
    title: id,
    url: "http://localhost:5173",
    source: "local",
    localWebviewLabel: id,
  };
}

async function settle() {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

describe("active context", () => {
  let session: ReturnType<typeof useSessionStore>;
  let targets: ReturnType<typeof useTargetsStore>;
  let connection: ReturnType<typeof useConnectionStore>;

  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
    session = useSessionStore();
    targets = useTargetsStore();
    connection = useConnectionStore();
    session.registry = { ...session.registry, activeSerial: "phone-a" };
    vi.spyOn(session, "setActiveDevice").mockImplementation(async (serial) => {
      session.registry = { ...session.registry, activeSerial: serial };
      return session.registry;
    });
    useActiveContextStore();
  });

  test("selecting an adb target on another device switches the active device", async () => {
    targets.selectTarget(adbTarget("t1", "phone-b"));
    await settle();
    expect(session.setActiveDevice).toHaveBeenCalledWith("phone-b");
    expect(session.registry.activeSerial).toBe("phone-b");
    expect(targets.selectedTarget?.id).toBe("t1");
  });

  test("selecting a local target clears the active android device", async () => {
    targets.selectTarget(localTarget("local:1"));
    await settle();
    expect(session.registry.activeSerial).toBeNull();
    expect(targets.selectedTarget?.id).toBe("local:1");
  });

  test("selecting a device drops a target that belongs elsewhere", async () => {
    targets.selectTarget(localTarget("local:1"));
    await settle();
    session.registry = { ...session.registry, activeSerial: "phone-a" };
    await settle();
    expect(targets.selectedTarget).toBeNull();
  });

  test("selecting a device keeps a target that belongs to it", async () => {
    targets.selectTarget(adbTarget("t1", "phone-a"));
    await settle();
    expect(session.setActiveDevice).not.toHaveBeenCalled();
    expect(targets.selectedTarget?.id).toBe("t1");
  });

  test("the connection store follows the selected target", async () => {
    targets.selectTarget(adbTarget("t1", "phone-a"));
    await settle();
    expect(connection.selectedTargetId).toBe("t1");
    targets.selectTarget(null);
    await settle();
    expect(connection.selectedTargetId).toBeNull();
  });

  test("kind and target status are derived from one source", async () => {
    const context = useActiveContextStore();
    expect(context.kind).toBe("none");
    targets.selectTarget(localTarget("local:1"));
    await settle();
    expect(context.kind).toBe("local");
    expect(context.targetStatus).toBe("idle");
  });

  test("an app target reads as native and names the app, not an address", async () => {
    const context = useActiveContextStore();
    targets.selectTarget(createAppTarget("phone-a", "com.example.notes", "Notes"));
    await settle();
    expect(context.kind).toBe("adb-target");
    expect(context.link).toMatchObject({ health: "native", label: "native" });
    expect(context.gateInput.target).toMatchObject({ title: "Notes", native: true });
  });
});
