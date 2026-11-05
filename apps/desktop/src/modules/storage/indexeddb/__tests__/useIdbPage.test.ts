import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createApp, effectScope, nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import type { IdbOpenDatabase } from "../useIdbCatalog";

interface Pending {
  store: string;
  skip: number;
  resolve: (value: { records: unknown[]; hasMore: boolean }) => void;
}

const device = vi.hoisted(() => ({
  pending: [] as Pending[],
  puts: [] as unknown[][],
  patches: [] as unknown[][],
}));

vi.mock("@capubridge/cdp-protocol", () => ({
  IDBDomain: class {
    getData(params: { objectStoreName: string; skipCount: number }) {
      return new Promise((resolve) =>
        device.pending.push({ store: params.objectStoreName, skip: params.skipCount, resolve }),
      );
    }
    putRecord(...args: unknown[]) {
      device.puts.push(args);
      return Promise.resolve();
    }
    patchRecord(...args: unknown[]) {
      device.patches.push(args);
      return Promise.resolve();
    }
  },
  IdbKeyConflictError: class extends Error {},
}));
vi.mock("@/composables/useCDP", () => ({ useCDP: () => ({ getClient: () => ({}) }) }));
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const { useIdbPage } = await import("../useIdbPage");
const { useIdbStoreWrites } = await import("../useIdbStoreWrites");

const database: IdbOpenDatabase = {
  mode: "live",
  id: "shop",
  name: "shop",
  version: 1,
  origin: "https://app",
  storeNames: ["orders", "customers"],
  file: null,
};

const record = (id: number, store: string) => ({
  key: id,
  primaryKey: id,
  value: { id, store },
  editable: true,
});

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await nextTick();
    await Promise.resolve();
  }
}

async function answer(store: string, skip: number, records: unknown[], hasMore = false) {
  await settle();
  const index = device.pending.findIndex((entry) => entry.store === store && entry.skip === skip);
  const [found] = device.pending.splice(index, 1);
  found?.resolve({ records, hasMore });
  await settle();
}

let stopScope: () => void = () => undefined;

function mount() {
  const app = createApp({});
  app.use(VueQueryPlugin, { queryClient: new QueryClient() });
  const scope = effectScope();
  const store = ref("orders");
  const open = ref<IdbOpenDatabase | null>(database);
  const result = app.runWithContext(() =>
    scope.run(() => {
      const pager = useIdbPage({ targetId: ref("t1"), open, store });
      const writes = useIdbStoreWrites({
        open,
        store,
        domain: pager.domain,
        pending: pager.placeholder,
        afterWrite: () => undefined,
      });
      return { pager, writes };
    }),
  );
  stopScope = () => scope.stop();
  if (!result) throw new Error("scope did not run");
  return { ...result, store };
}

beforeEach(() => {
  setActivePinia(createPinia());
  device.pending = [];
  device.puts = [];
  device.patches = [];
});

afterEach(() => stopScope());

describe("a store switch never shows or writes another store's rows (S1)", () => {
  test("the previous store's page is not kept while the next store is read", async () => {
    const { pager, store } = mount();
    await answer("orders", 0, [record(1, "orders")]);
    expect(pager.records.value.map((entry) => entry.key)).toEqual([1]);
    store.value = "customers";
    await settle();
    expect(pager.records.value).toEqual([]);
    await answer("customers", 0, [record(7, "customers")]);
    expect(pager.records.value.map((entry) => entry.key)).toEqual([7]);
  });

  test("writes are refused while the previous page is still on screen", async () => {
    const { pager, writes } = mount();
    await answer("orders", 0, [record(1, "orders")], true);
    pager.setPage(1);
    await settle();
    expect(pager.records.value.map((entry) => entry.key)).toEqual([1]);
    expect(pager.placeholder.value).toBe(true);
    const saved = await writes.saveCell(record(1, "orders"), "store", "changed");
    expect(saved).toBe(false);
    expect(device.patches).toEqual([]);
    await answer("orders", 50, [record(51, "orders")]);
    expect(pager.placeholder.value).toBe(false);
    expect(await writes.saveCell(record(51, "orders"), "store", "changed")).toBe(true);
    expect(device.patches).toHaveLength(1);
  });
});
