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
    const discard = vi.fn();
    unsaved.track("file:1", "orders", { count: 2, discard });
    const confirm = vi.fn(async () => false);
    const leave = vi.fn();

    expect(await closeOpenedFile("file:1", file.id, { confirm, files, unsaved, leave })).toBe(
      false,
    );
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((confirm.mock.calls as unknown as Array<[{ text: string }]>)[0]?.[0].text).toContain(
      "2 changes to “orders”",
    );
    expect(discard).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
    expect(files.files).toHaveLength(1);

    confirm.mockResolvedValueOnce(true);
    expect(await closeOpenedFile("file:1", file.id, { confirm, files, unsaved, leave })).toBe(true);
    expect(discard).toHaveBeenCalledTimes(1);
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

    const discard = vi.fn();
    useSqliteUnsavedStore().track("file:1", "orders", { count: 1, discard });
    await flush();
    expect(closeHandlers).toHaveLength(1);

    const event = { preventDefault: vi.fn() };
    await closeHandlers[0]?.(event);
    expect(asked.questions[0]).toContain("1 change in the Data tab is not saved");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();

    asked.answer = true;
    const closing = { preventDefault: vi.fn() };
    await closeHandlers[0]?.(closing);
    expect(closing.preventDefault).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalled();
    await flush();
    expect(closeHandlers).toHaveLength(0);
    app.unmount();
  });
});
