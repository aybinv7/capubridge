// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { computed, createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import type { SqliteTableInfo } from "@/types/sqlite.types";

vi.mock("vue-sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const { useSqliteTabs } = await import("../useSqliteTabs");
const { useSqliteLocation } = await import("../../useSqliteLocation");
const { useSqliteUnsavedStore } = await import("@/modules/storage/stores/useSqliteUnsavedStore");
const { EMPTY_STAGED, addInsert } = await import("../../browse/sqliteChangeset");

const Blank = defineComponent({ render: () => null });
const info = (name: string): SqliteTableInfo => ({
  name,
  tableType: "table",
  rowCount: 1,
  sql: "",
});

let app: App | null = null;

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  app?.unmount();
  app = null;
  vi.unstubAllGlobals();
});

async function settle() {
  for (let i = 0; i < 6; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mount(path: string, answer = true) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/storage/sqlite/:db?/:table?", name: "storage-sqlite", component: Blank },
      { path: "/storage/sqlite-file/:file/:table?", name: "storage-sqlite-file", component: Blank },
    ],
  });
  await router.push(path);
  await router.isReady();
  const asked: string[] = [];
  let tabs: ReturnType<typeof useSqliteTabs> | null = null;
  const tables = ref([info("orders"), info("items"), info("users")]);
  app = createApp(
    defineComponent({
      setup() {
        const location = useSqliteLocation();
        const current = computed(() =>
          location.target.value
            ? {
                sourceId: "/data/shop.db",
                db: { name: "shop.db", path: "/data/shop.db", size: 1 },
                fileId: null,
              }
            : null,
        );
        tabs = useSqliteTabs({
          tab: {
            location,
            current,
            tables: { tables, loaded: ref(true) },
            scope: ref("R5::shop::sqlite"),
          } as unknown as Parameters<typeof useSqliteTabs>[0]["tab"],
          confirm: async (request) => {
            asked.push(request.title);
            return answer;
          },
        });
        return () => h("div");
      },
    }),
  );
  app.use(pinia);
  app.use(router);
  app.mount(document.createElement("div"));
  await settle();
  if (!tabs) throw new Error("no tabs");
  return { tabs: tabs as ReturnType<typeof useSqliteTabs>, router, asked, tables };
}

const ids = (tabs: ReturnType<typeof useSqliteTabs>) =>
  tabs.state.value.tabs.map((tab) => `${tab.preview ? "/" : ""}${tab.id}`);

describe("tabs and the address bar", () => {
  test("a deep link opens its table in a tab; opening pushes, switching replaces", async () => {
    const { tabs, router } = await mount("/storage/sqlite/%2Fdata%2Fshop.db/orders");
    expect(ids(tabs)).toEqual(["/table:orders"]);
    tabs.openTable("items", { keep: true });
    await settle();
    expect(router.currentRoute.value.params["table"]).toBe("items");
    expect(ids(tabs)).toEqual(["/table:orders", "table:items"]);
    tabs.select("table:orders");
    await settle();
    expect(router.currentRoute.value.params["table"]).toBe("orders");
    router.back();
    await settle();
    expect(router.currentRoute.value.params["table"]).toBe("orders");
  });

  test("Back goes to the table you came from", async () => {
    const { tabs, router } = await mount("/storage/sqlite/%2Fdata%2Fshop.db/orders");
    tabs.openTable("items", { keep: true });
    await settle();
    tabs.openTable("users", { keep: true });
    await settle();
    router.back();
    await settle();
    expect(router.currentRoute.value.params["table"]).toBe("items");
    expect(tabs.activeId.value).toBe("table:items");
  });

  test("switching tabs never asks; closing a tab with staged edits asks first", async () => {
    const { tabs, asked } = await mount("/storage/sqlite/%2Fdata%2Fshop.db/orders", false);
    useSqliteUnsavedStore().setStaged("/data/shop.db", "orders", addInsert(EMPTY_STAGED, "new:1"));
    await settle();
    expect(ids(tabs)).toEqual(["table:orders"]);
    tabs.openTable("items");
    await settle();
    tabs.select("table:orders");
    await settle();
    expect(asked).toEqual([]);
    await tabs.close(new Set(["table:orders"]));
    await settle();
    expect(asked).toEqual(["Leave 1 change unsaved?"]);
    expect(ids(tabs)).toContain("table:orders");
  });

  test("a database opened again comes back on the tab it was left on", async () => {
    const first = await mount("/storage/sqlite/%2Fdata%2Fshop.db/items");
    first.tabs.keep("table:items");
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 450));
    app?.unmount();
    app = null;
    const again = await mount("/storage/sqlite/%2Fdata%2Fshop.db");
    expect(again.router.currentRoute.value.params["table"]).toBe("items");
    expect(again.tabs.activeId.value).toBe("table:items");
  });
});
