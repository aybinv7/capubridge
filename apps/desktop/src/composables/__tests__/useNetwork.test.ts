import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { effectScope, nextTick, type EffectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { CDPTarget } from "@/types/cdp.types";

type Handler = (payload: unknown) => void;

interface FakeClient {
  handlers: Map<string, Set<Handler>>;
  sent: string[];
  on: (event: string, handler: Handler) => () => void;
  send: (method: string) => Promise<unknown>;
  emit: (event: string, payload: unknown) => void;
}

function fakeClient(): FakeClient {
  const handlers = new Map<string, Set<Handler>>();
  const client: FakeClient = {
    handlers,
    sent: [],
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return () => set.delete(handler);
    },
    send(method) {
      client.sent.push(method);
      return Promise.resolve({});
    },
    emit(event, payload) {
      for (const handler of handlers.get(event) ?? []) handler(payload);
    },
  };
  return client;
}

const env = vi.hoisted(() => ({
  clients: new Map<string, unknown>(),
  targets: null as null | { selectedTarget: CDPTarget | null; cdpTargetId: string },
}));

vi.mock("@/stores/targets.store", async () => {
  const { reactive } = await import("vue");
  const store = reactive({ selectedTarget: null as CDPTarget | null, cdpTargetId: "" });
  env.targets = store;
  return { useTargetsStore: () => store };
});

vi.mock("@/composables/useCDP", async () => {
  const { reactive } = await import("vue");
  const connectionStore = reactive({ connections: new Map<string, { status: string }>() });
  return {
    useCDP: () => ({
      getClient: (id: string) => env.clients.get(id),
      connectToTarget: async (target: CDPTarget) => env.clients.get(target.id),
      connectionStore,
    }),
  };
});

const { useNetwork } = await import("../useNetwork");
const { useNetworkStore } = await import("@/modules/network/stores/useNetworkStore");

function target(id: string): CDPTarget {
  return {
    id,
    type: "page",
    title: id,
    url: `https://${id}.test/`,
    source: "adb",
    deviceSerial: "phone",
  };
}

function request(id: string, url = `https://api.test/${id}`) {
  return {
    requestId: id,
    request: { url, method: "GET", headers: {} },
    timestamp: 1,
    wallTime: 1,
    initiator: { type: "script" },
    type: "Fetch",
  };
}

async function settle() {
  for (let index = 0; index < 5; index += 1) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function selectTarget(id: string | null) {
  const store = env.targets;
  if (!store) throw new Error("targets store was not created");
  store.selectedTarget = id ? target(id) : null;
  store.cdpTargetId = id ?? "";
  await settle();
}

let scope: EffectScope;

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  env.clients.clear();
  env.clients.set("a", fakeClient());
  env.clients.set("b", fakeClient());
  scope = effectScope();
});

afterEach(async () => {
  scope.stop();
  await selectTarget(null);
});

function client(id: string): FakeClient {
  return env.clients.get(id) as FakeClient;
}

describe("network capture lifecycle", () => {
  test("captures the selected target and goes live", async () => {
    await selectTarget("a");
    scope.run(() => useNetwork());
    await settle();
    const store = useNetworkStore();

    expect(store.captureStatus).toBe("live");
    expect(store.captureTargetId).toBe("a");
    client("a").emit("Network.requestWillBeSent", request("1"));
    expect(store.requestCount).toBe(1);
  });

  test("switching targets clears the log and ignores the previous target", async () => {
    await selectTarget("a");
    scope.run(() => useNetwork());
    await settle();
    const store = useNetworkStore();
    client("a").emit("Network.requestWillBeSent", request("1"));
    store.select("1");

    await selectTarget("b");

    expect(store.requestCount).toBe(0);
    expect(store.selectedId).toBeNull();
    expect(store.captureTargetId).toBe("b");
    client("a").emit("Network.requestWillBeSent", request("late"));
    expect(store.requestCount).toBe(0);
    client("b").emit("Network.requestWillBeSent", request("2"));
    expect(store.allEntries.map((entry) => entry.requestId)).toEqual(["2"]);
    expect(client("a").sent).toContain("Network.disable");
  });

  test("a main-frame navigation clears the log unless requests are kept", async () => {
    await selectTarget("a");
    scope.run(() => useNetwork());
    await settle();
    const store = useNetworkStore();
    client("a").emit("Network.requestWillBeSent", request("1"));

    store.preserveLog = true;
    client("a").emit("Page.frameNavigated", { frame: { id: "main" } });
    expect(store.requestCount).toBe(1);

    store.preserveLog = false;
    client("a").emit("Page.frameNavigated", { frame: { id: "child", parentId: "main" } });
    expect(store.requestCount).toBe(1);
    client("a").emit("Page.frameNavigated", { frame: { id: "main" } });
    expect(store.requestCount).toBe(0);
  });

  test("paused capture drops new requests and keeps the old ones", async () => {
    await selectTarget("a");
    scope.run(() => useNetwork());
    await settle();
    const store = useNetworkStore();
    client("a").emit("Network.requestWillBeSent", request("1"));

    store.isRecording = false;
    client("a").emit("Network.requestWillBeSent", request("2"));

    expect(store.allEntries.map((entry) => entry.requestId)).toEqual(["1"]);
  });

  test("losing the target stops capture and resets its state", async () => {
    await selectTarget("a");
    scope.run(() => useNetwork());
    await settle();
    const store = useNetworkStore();

    await selectTarget(null);

    expect(store.captureStatus).toBe("idle");
    expect(store.captureTargetId).toBeNull();
  });
});
