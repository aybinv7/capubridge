import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import type { OPFSDeleteResult, OPFSFilesDomain } from "@capubridge/cdp-protocol";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));

const { deleteQuestion, opfsWrites } = await import("../opfsWrites");
const { useOpfsWrites } = await import("../useOpfsWrites");
const { file, folder, poolHint, row } = await import("./opfsFixtures");

const ORIGIN = "https://app.test";
const db = row(file("data/app.sqlite3", 4096));
const log = row(file("data/today.log", 13));
const slot = row(file("pool/Xa9", 8192), [poolHint(["Xa9"])]);
const dir = row(folder("data/cache"));

function result(partial: Partial<OPFSDeleteResult>): OPFSDeleteResult {
  return { deleted: [], gone: [], changed: [], busy: [], failed: [], ...partial };
}

function device(...replies: OPFSDeleteResult[]) {
  const remove = vi.fn();
  for (const reply of replies) remove.mockResolvedValueOnce(reply);
  return { remove, domain: { remove } as unknown as OPFSFilesDomain };
}

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
});

describe("the delete question", () => {
  test("names the file and the folder, and says it cannot be undone", () => {
    const question = deleteQuestion([log], "data");
    expect(question.title).toBe("Delete “today.log”?");
    expect(question.text).toMatch(/The file “today.log” is deleted from the folder “data”/);
    expect(question.text).toMatch(/cannot be undone/);
    expect(question.danger).toBe(true);
    expect(question.confirmLabel).toBe("Delete file");
  });

  test("warns about a live database, a pool slot and a folder's contents", () => {
    expect(deleteQuestion([db], "").text).toMatch(/SQLite files belong together/);
    expect(deleteQuestion([db], "").text).toMatch(/top of OPFS/);
    expect(deleteQuestion([slot], "pool").text).toMatch(
      /SAH-Pool slot holds a whole SQLite database/,
    );
    expect(deleteQuestion([dir], "data").text).toMatch(/everything inside it/);
    expect(deleteQuestion([dir], "data").confirmLabel).toBe("Delete folder");
    expect(deleteQuestion([log], "data").text).not.toMatch(/SQLite/);
  });

  test("several items are listed by name", () => {
    const question = deleteQuestion([log, dir], "data");
    expect(question.title).toBe("Delete 2 items?");
    expect(question.details).toEqual(["today.log", "cache"]);
  });
});

describe("deleting", () => {
  test("sends each file with the size and date the person saw, to the origin read", async () => {
    const { domain, remove } = device(result({ deleted: ["data/today.log"] }));
    const forget = vi.fn();
    await expect(opfsWrites(domain, ORIGIN, vi.fn(), forget).removeRows([log])).resolves.toBe(1);
    expect(remove).toHaveBeenCalledWith(ORIGIN, [
      { path: "data/today.log", kind: "file", size: 13, lastModified: 1000 },
    ]);
    expect(forget).toHaveBeenCalledWith([log]);
    expect(toast.success).toHaveBeenCalledWith("Deleted “today.log” on the phone");
  });

  test("a file the app wrote to is kept unless the person agrees", async () => {
    const declined = device(result({ changed: ["data/app.sqlite3"] }));
    const no = vi.fn().mockResolvedValue(false);
    const forget = vi.fn();
    await expect(opfsWrites(declined.domain, ORIGIN, no, forget).removeRows([db])).resolves.toBe(0);
    expect(declined.remove).toHaveBeenCalledTimes(1);
    expect(forget).toHaveBeenCalledWith([]);
    expect(toast.info).toHaveBeenCalledWith("Nothing was deleted", {
      description: "The app's newer file was kept.",
    });

    const agreed = device(
      result({ changed: ["data/app.sqlite3"] }),
      result({ deleted: ["data/app.sqlite3"] }),
    );
    const yes = vi.fn().mockResolvedValue(true);
    await expect(opfsWrites(agreed.domain, ORIGIN, yes, vi.fn()).removeRows([db])).resolves.toBe(1);
    expect(agreed.remove).toHaveBeenLastCalledWith(
      ORIGIN,
      [{ path: "data/app.sqlite3", kind: "file", size: 4096, lastModified: 1000 }],
      true,
    );
  });

  test("a file the app holds open is never forced, and the toast says why", async () => {
    const { domain, remove } = device(result({ busy: ["data/app.sqlite3"] }));
    await opfsWrites(domain, ORIGIN, vi.fn(), vi.fn()).removeRows([db]);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("“app.sqlite3” was not deleted", {
      description: expect.stringMatching(/has it open/),
    });
  });

  test("a file already gone is reported and its local copy forgotten", async () => {
    const { domain } = device(result({ gone: ["data/app.sqlite3"] }));
    const forget = vi.fn();
    await expect(opfsWrites(domain, ORIGIN, vi.fn(), forget).removeRows([db])).resolves.toBe(1);
    expect(forget).toHaveBeenCalledWith([db]);
    expect(toast.info).toHaveBeenCalledWith("“app.sqlite3” was already gone from the phone");
  });

  test("a failure on the phone is a toast with the phone's words", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("The page now shows https://x.test"));
    const domain = { remove } as unknown as OPFSFilesDomain;
    await expect(opfsWrites(domain, ORIGIN, vi.fn(), vi.fn()).removeRows([log])).resolves.toBe(0);
    expect(toast.error).toHaveBeenCalledWith("“today.log” was not deleted", {
      description: "The page now shows https://x.test",
    });
  });

  test("several items report what went and what stayed", async () => {
    const { domain } = device(result({ deleted: ["data/today.log"], busy: ["data/app.sqlite3"] }));
    await opfsWrites(domain, ORIGIN, vi.fn(), vi.fn()).removeRows([log, db]);
    expect(toast.success).toHaveBeenCalledWith("Deleted 1 item on the phone", {
      description: "1 held open by the app and kept.",
    });
  });
});

describe("the folder's deletes", () => {
  function writes(options: { pending?: boolean; away?: string | null; confirmed?: boolean }) {
    const remove = vi.fn().mockResolvedValue(result({ deleted: ["data/today.log"] }));
    const confirm = vi.fn().mockResolvedValue(options.confirmed ?? true);
    const after = vi.fn();
    const handle = useOpfsWrites({
      origin: ORIGIN,
      folder: "data",
      domain: () => ({ remove }) as unknown as OPFSFilesDomain,
      pending: ref(options.pending ?? false),
      away: ref(options.away ?? null),
      confirm,
      forget: vi.fn(),
      after,
    });
    return { handle, remove, confirm, after };
  }

  test("always asks first, and deletes nothing on no", async () => {
    const { handle, remove, confirm } = writes({ confirmed: false });
    await expect(handle.confirmAndRemove([log])).resolves.toBe(0);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  test("waits while the folder is read or the app is away, and says why", async () => {
    const reading = writes({ pending: true });
    await reading.handle.confirmAndRemove([log]);
    expect(reading.remove).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Nothing was deleted", {
      description: "The folder is still being read.",
    });

    const away = writes({ away: "The app is in the background" });
    expect(away.handle.blockedReason.value).toBe("The app is in the background");
    await away.handle.confirmAndRemove([log]);
    expect(away.confirm).not.toHaveBeenCalled();
    expect(away.remove).not.toHaveBeenCalled();
  });

  test("on yes, deletes and tells the folder to read again", async () => {
    const { handle, remove, after } = writes({});
    await expect(handle.confirmAndRemove([log])).resolves.toBe(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledWith(1);
    expect(handle.busy.value).toBe(false);
  });
});
