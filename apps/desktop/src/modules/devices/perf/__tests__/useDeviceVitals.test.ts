import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { effectScope, nextTick, reactive, ref } from "vue";
import type { PerfMetrics } from "@/types/perf.types";
import type { SessionEvent } from "@/types/session.types";

type Thunk = () => unknown;

const calls = vi.hoisted(() => ({
  leases: [] as Array<{ op: "start" | "stop"; serial: string; holder?: string }>,
  handler: null as ((event: SessionEvent) => void) | null,
}));
const device = vi.hoisted(() => ({ serial: "phone-a", status: "online" }));

vi.mock("@/runtime/session", () => ({
  runSessionEffect: async (thunk: Thunk) => thunk(),
  startPerfLeaseEffect: (serial: string, holder?: string) => () => {
    calls.leases.push({ op: "start", serial, holder });
    return { serial, kind: "perf", active: true };
  },
  stopPerfLeaseEffect: (serial: string, holder?: string) => () => {
    calls.leases.push({ op: "stop", serial, holder });
    return { serial, kind: "perf", active: false };
  },
  subscribeSessionEventsEffect: (handler: (event: SessionEvent) => void) => () => {
    calls.handler = handler;
    return () => {
      if (calls.handler === handler) calls.handler = null;
    };
  },
}));

vi.mock("@/stores/devices.store", async () => {
  const { reactive: makeReactive } = await import("vue");
  const store = makeReactive({ selectedDevice: device });
  return { useDevicesStore: () => store };
});

vi.mock("@vueuse/core", async (original) => {
  const actual = await original<typeof import("@vueuse/core")>();
  const { ref: makeRef } = await import("vue");
  return { ...actual, useDocumentVisibility: () => makeRef("visible") };
});

const { useDevicesStore } = await import("@/stores/devices.store");
const { createDeviceVitals } = await import("../useDeviceVitals");

function metrics(cpuTotal: number, timestamp = Date.now()): PerfMetrics {
  return {
    cpuCores: [{ core: 0, usage: cpuTotal }],
    cpuTotal,
    memory: { totalKb: 100, availableKb: 50, usedKb: 50, usedPct: 50 },
    network: { rxBps: 10, txBps: 5 },
    battery: { level: 80, temperature: 30, charging: false },
    cpuTemp: null,
    timestamp,
  };
}

function emit(serial: string, value: number) {
  calls.handler?.({ type: "perfMetrics", serial, metrics: metrics(value) } as SessionEvent);
}

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

const scopes: Array<ReturnType<typeof effectScope>> = [];

function mount() {
  const scope = effectScope();
  scopes.push(scope);
  const wanted = ref(true);
  const vitals = scope.run(() => createDeviceVitals(wanted));
  if (!vitals) throw new Error("scope did not run");
  return { vitals, wanted };
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  calls.leases.length = 0;
  calls.handler = null;
  const store = useDevicesStore() as unknown as { selectedDevice: typeof device };
  store.selectedDevice = reactive({ serial: "phone-a", status: "online" });
});

describe("createDeviceVitals", () => {
  it("takes the lease under its own holder name and reads the phone", async () => {
    const { vitals } = mount();
    await settle();
    expect(calls.leases).toEqual([{ op: "start", serial: "phone-a", holder: "device-vitals" }]);
    emit("phone-a", 42);
    expect(vitals.tickCount.value).toBe(1);
    expect(vitals.values("cpu")).toEqual([42]);
  });

  it("switching phones forgets the previous phone's readings", async () => {
    const { vitals } = mount();
    await settle();
    emit("phone-a", 42);
    emit("phone-a", 43);
    expect(vitals.latest.value?.cpuTotal).toBe(43);

    const store = useDevicesStore() as unknown as { selectedDevice: typeof device };
    store.selectedDevice = reactive({ serial: "phone-b", status: "online" });
    await settle();

    expect(vitals.tickCount.value).toBe(0);
    expect(vitals.latest.value).toBeNull();
    expect(vitals.values("cpu")).toEqual([]);
    expect(vitals.coreCount.value).toBe(0);
    expect(calls.leases.slice(-2)).toEqual([
      { op: "stop", serial: "phone-a", holder: "device-vitals" },
      { op: "start", serial: "phone-b", holder: "device-vitals" },
    ]);

    emit("phone-a", 99);
    expect(vitals.tickCount.value).toBe(0);
    emit("phone-b", 7);
    expect(vitals.values("cpu")).toEqual([7]);
  });

  it("leaving the vitals tabs gives the lease back but keeps the history", async () => {
    const { vitals, wanted } = mount();
    await settle();
    emit("phone-a", 42);
    wanted.value = false;
    await settle();
    expect(calls.leases.at(-1)).toEqual({ op: "stop", serial: "phone-a", holder: "device-vitals" });
    expect(vitals.isRunning.value).toBe(false);
    expect(vitals.values("cpu")).toEqual([42]);
  });

  it("an offline phone stops the monitor and reports offline", async () => {
    const { vitals } = mount();
    await settle();
    const store = useDevicesStore() as unknown as { selectedDevice: typeof device };
    store.selectedDevice = reactive({ serial: "phone-a", status: "offline" });
    await settle();
    expect(vitals.offline.value).toBe(true);
    expect(vitals.active.value).toBe(false);
    expect(vitals.isRunning.value).toBe(false);
  });
});
