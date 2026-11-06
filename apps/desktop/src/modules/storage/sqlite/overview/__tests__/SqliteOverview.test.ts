// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { computed, createApp, defineComponent, h, nextTick, type App } from "vue";
import type { SqliteTableInfo } from "@/types/sqlite.types";

vi.mock("../useSqliteFacts", () => ({
  useSqliteFacts: () => ({
    facts: computed(() => null),
    loading: computed(() => false),
    error: computed(() => null),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/modules/storage/changes/useSqliteChangeOverlay", () => ({
  useSqliteChangeIndex: () => ({
    getTableSummary: () => ({ add: 0, update: 0, delete: 0, total: 0, latestAt: null }),
  }),
}));
vi.mock("../SqliteOverviewTables.vue", () => ({
  default: defineComponent({ name: "Tables", render: () => h("div", "tables grid") }),
}));

const { default: SqliteOverview } = await import("../../SqliteOverview.vue");

let app: App | null = null;
let root: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  root?.remove();
  app = null;
});

async function mount(props: Record<string, unknown>) {
  root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  const retries: number[] = [];
  app = createApp({
    render: () =>
      h(SqliteOverview, {
        tables: [],
        loading: false,
        loaded: true,
        error: null,
        db: { name: "shop.db", path: "/data/shop.db", size: 1 },
        address: null,
        changeSerial: "R5",
        changePackage: "com.shop",
        watched: true,
        onRetry: () => retries.push(1),
        ...props,
      }),
  });
  app.mount(root);
  await nextTick();
  return { text: root.textContent ?? "", retries };
}

const table: SqliteTableInfo = { name: "orders", tableType: "table", rowCount: 3, sql: "" };

describe("the overview's states keep their words", () => {
  test("loading, error and empty", async () => {
    expect((await mount({ loading: true, loaded: false })).text).toContain("Opening the database");
    app?.unmount();
    expect((await mount({ error: "disk I/O error" })).text).toContain(
      "Could not open the database",
    );
    app?.unmount();
    expect((await mount({})).text).toContain("This database has no tables");
  });

  test("with tables: the grid, what changed and the checks", async () => {
    const { text } = await mount({ tables: [table] });
    expect(text).toContain("tables grid");
    expect(text).toContain("Nothing changed since it was opened");
    expect(text).toContain("Schema checks");
  });
});
