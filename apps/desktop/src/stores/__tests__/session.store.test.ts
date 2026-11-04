import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { SessionEvent, SessionRegistrySnapshot } from "@/types/session.types";

const runtime = vi.hoisted(() => ({
  listener: null as null | ((event: SessionEvent) => void),
  results: [] as SessionRegistrySnapshot[],
}));

vi.mock("@/runtime/session", () => ({
  subscribeSessionEventsEffect: (handler: (event: SessionEvent) => void) => {
    runtime.listener = handler;
    return { kind: "subscribe" };
  },
  getRegistryStateEffect: () => ({ kind: "state" }),
  refreshDevicesEffect: () => ({ kind: "refresh" }),
  setActiveDeviceEffect: () => ({ kind: "active" }),
  forgetDeviceEffect: () => ({ kind: "forget" }),
  runSessionEffect: async (effect: { kind: string }) => {
    if (effect.kind === "subscribe") return () => undefined;
    const next = runtime.results.shift();
    if (!next) throw new Error(`no scripted result for ${effect.kind}`);
    return next;
  },
}));

import { useSessionStore } from "../session.store";

function snapshot(revision: number, activeSerial: string | null): SessionRegistrySnapshot {
  return {
    devices: [],
    activeSerial,
    trackerStatus: "running",
    revision,
    lastError: null,
    updatedAt: revision,
  };
}

describe("session registry ordering", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    runtime.listener = null;
    runtime.results = [];
  });

  test("an event older than the applied revision is ignored", async () => {
    runtime.results.push(snapshot(5, "phone-a"));
    const store = useSessionStore();
    await store.initialize();
    runtime.listener?.({ type: "registryUpdated", snapshot: snapshot(4, "phone-b") });
    expect(store.registry.revision).toBe(5);
    expect(store.registry.activeSerial).toBe("phone-a");
  });

  test("a newer event is applied", async () => {
    runtime.results.push(snapshot(5, "phone-a"));
    const store = useSessionStore();
    await store.initialize();
    runtime.listener?.({ type: "registryUpdated", snapshot: snapshot(6, "phone-b") });
    expect(store.registry.activeSerial).toBe("phone-b");
  });

  test("a stale command result does not overwrite a newer event", async () => {
    runtime.results.push(snapshot(5, "phone-a"));
    const store = useSessionStore();
    await store.initialize();
    runtime.listener?.({ type: "registryUpdated", snapshot: snapshot(8, "phone-c") });
    runtime.results.push(snapshot(7, "phone-a"));
    await store.refreshDevices();
    expect(store.registry.revision).toBe(8);
    expect(store.registry.activeSerial).toBe("phone-c");
  });

  test("initial state is always applied", async () => {
    runtime.results.push(snapshot(0, null));
    const store = useSessionStore();
    await store.initialize();
    expect(store.isInitialized).toBe(true);
    expect(store.registry.revision).toBe(0);
  });
});
