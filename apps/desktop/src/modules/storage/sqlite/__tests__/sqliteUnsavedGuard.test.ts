// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { createApp, defineComponent, nextTick } from "vue";

const ipc = vi.hoisted(() => [] as string[]);
const closeHandlers = vi.hoisted(
  () => [] as Array<(event: { preventDefault: () => void }) => Promise<void>>,
);
const asked = vi.hoisted(() => ({ answer: false, questions: [] as string[] }));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: vi.fn(async (command: string) => {
    ipc.push(command);
    if (command === "sqlite_open_local_file") {
      return {
        path: "C:/t/work.db",
        name: "shop.db",
        original: "D:/shop.db",
        size: 1,
        walBeside: false,
      };
    }
    return undefined;
  }),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: (event: { preventDefault: () => void }) => Promise<void>) => {
      closeHandlers.push(handler);
      return () => closeHandlers.splice(closeHandlers.indexOf(handler), 1);
    },
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async (text: string) => {
    asked.questions.push(text);
    return asked.answer;
  }),
  open: vi.fn(),
  save: vi.fn(),
}));

const { useSqliteFilesStore } = await import("@/modules/storage/stores/useSqliteFilesStore");
const { useSqliteUnsavedStore } = await import("@/modules/storage/stores/useSqliteUnsavedStore");
const { closeOpenedFile } = await import("../closeOpenedFile");
const { EMPTY_STAGED, addInsert } = await import("../browse/sqliteChangeset");
const { leaveQuestion } = await import("../sqliteUnsavedQuestion");

function stagedRows(count: number) {
  let staged = EMPTY_STAGED;
  for (let index = 0; index < count; index++) staged = addInsert(staged, `new:${index}`);
  return staged;
}
const { useSqliteCloseGuard } = await import("../useSqliteCloseGuard");

async function flush() {
  for (let i = 0; i < 5; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  setActivePinia(createPinia());
  ipc.length = 0;
  closeHandlers.length = 0;
  asked.answer = false;
  asked.questions.length = 0;
});

describe("closing a file with staged edits asks first (S3)", () => {
  test("no keeps the file and its edits; yes drops them, then closes", async () => {
    const files = useSqliteFilesStore();
    const unsaved = useSqliteUnsavedStore();
    const file = await files.open("D:/shop.db");
    unsaved.setStaged("file:1", "orders", stagedRows(2));
    const confirm = vi.fn(async () => false);
    const leave = vi.fn();

    expect(await closeOpenedFile("file:1", file.id, { confirm, files, unsaved, leave })).toBe(
      false,
    );
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((confirm.mock.calls as unknown as Array<[{ text: string }]>)[0]?.[0].text).toContain(
      "2 changes to “orders”",
    );
    expect(unsaved.total).toBe(2);
    expect(leave).not.toHaveBeenCalled();
    expect(files.files).toHaveLength(1);

    confirm.mockResolvedValueOnce(true);
    expect(await closeOpenedFile("file:1", file.id, { confirm, files, unsaved, leave })).toBe(true);
    expect(unsaved.total).toBe(0);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(files.files).toHaveLength(0);
    expect(ipc).toContain("sqlite_close_opened_file");
  });

  test("changes never written to the file are named with its path", async () => {
    const files = useSqliteFilesStore();
    const unsaved = useSqliteUnsavedStore();
    const file = await files.open("D:/shop.db");
    files.setUnsaved(file.id, true);
    const confirm = vi.fn(async () => false);
    await closeOpenedFile("file:1", file.id, { confirm, files, unsaved, leave: vi.fn() });
    expect((confirm.mock.calls as unknown as Array<[{ text: string }]>)[0]?.[0].text).toContain(
      "not written to D:/shop.db",
    );
  });

  test("a file with nothing to lose closes without a question", async () => {
    const files = useSqliteFilesStore();
    const file = await files.open("D:/shop.db");
    const confirm = vi.fn(async () => true);
    await closeOpenedFile("file:1", file.id, {
      confirm,
      files,
      unsaved: useSqliteUnsavedStore(),
      leave: vi.fn(),
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(files.files).toHaveLength(0);
  });
});

describe("closing the window with staged edits asks first (S3)", () => {
  test("listens only while something would be lost, and keeps the window on no", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp(
      defineComponent({ setup: () => useSqliteCloseGuard(), render: () => null }),
    );
    app.use(pinia);
    app.mount(document.createElement("div"));
    await flush();
    expect(closeHandlers).toHaveLength(0);

    const unsaved = useSqliteUnsavedStore();
    unsaved.setStaged("file:1", "orders", stagedRows(1));
    await flush();
    expect(closeHandlers).toHaveLength(1);

    const event = { preventDefault: vi.fn() };
    await closeHandlers[0]?.(event);
    expect(asked.questions[0]).toContain("1 change in the Data tab is not saved");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(unsaved.total).toBe(1);

    asked.answer = true;
    const closing = { preventDefault: vi.fn() };
    await closeHandlers[0]?.(closing);
    expect(closing.preventDefault).not.toHaveBeenCalled();
    expect(unsaved.total).toBe(0);
    await flush();
    expect(closeHandlers).toHaveLength(0);
    app.unmount();
  });
});

describe("staged edits live outside the grid (S4)", () => {
  test("a table's edits stay while another table or tab is shown, per table", () => {
    const unsaved = useSqliteUnsavedStore();
    unsaved.setStaged("/data/shop.db", "orders", stagedRows(2));
    unsaved.setStaged("/data/shop.db", "items", stagedRows(1));
    expect(unsaved.staged("/data/shop.db", "orders").inserts).toHaveLength(2);
    expect(unsaved.stagedIn("/data/shop.db").map((entry) => entry.count)).toEqual([2, 1]);
    unsaved.discardIn("/data/shop.db", "items");
    expect(unsaved.total).toBe(2);
    expect(unsaved.staged("/data/shop.db", "items")).toBe(EMPTY_STAGED);
  });

  test("leaving the database asks with every table; closing a tab names its own", () => {
    const both = leaveQuestion([
      { table: "orders", count: 2 },
      { table: "items", count: 1 },
    ]);
    expect(both?.title).toBe("Leave 3 changes unsaved?");
    expect(both?.text).toContain("“orders” and “items”");
    const one = leaveQuestion([{ table: "orders", count: 1 }], "Closing the tab drops them.");
    expect(one?.title).toBe("Leave 1 change unsaved?");
    expect(one?.text).toContain("Closing the tab drops them.");
    expect(leaveQuestion([])).toBeNull();
  });
});
