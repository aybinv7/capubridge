import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { effectScope, ref } from "vue";
import type { FileEntry } from "@/types/adb.types";

const listings = vi.hoisted(() => new Map<string, FileEntry[]>());
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: async (_name: string, args: { path: string }) => listings.get(args.path) ?? [],
}));

const { useFileTree } = await import("../useFileTree");

function folder(name: string): FileEntry {
  return { name, size: 0, modified: "", entryType: "dir", permissions: "rwxr-xr-x" };
}

const scopes: Array<ReturnType<typeof effectScope>> = [];

function mount() {
  const scope = effectScope();
  scopes.push(scope);
  const tree = scope.run(() => useFileTree(ref("phone")));
  if (!tree) throw new Error("scope did not run");
  return tree;
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  listings.clear();
});

describe("useFileTree", () => {
  it("keeps a folder's branch while it is read again, then shows the new listing", async () => {
    listings.set("/", [folder("sdcard")]);
    listings.set("/sdcard", [folder("DCIM"), folder("Download")]);
    const tree = mount();
    await tree.revealPath("/sdcard");
    expect(tree.rows.value.map((row) => row.path)).toEqual([
      "/",
      "/sdcard",
      "/sdcard/DCIM",
      "/sdcard/Download",
    ]);

    let finish: (entries: FileEntry[]) => void = () => undefined;
    const pending = tree.reload(
      "/sdcard",
      () => new Promise<FileEntry[]>((resolve) => (finish = resolve)),
    );
    expect(tree.rows.value.map((row) => row.path)).toContain("/sdcard/DCIM");

    finish([folder("DCIM"), folder("Movies")]);
    await pending;
    expect(tree.rows.value.map((row) => row.path)).toEqual([
      "/",
      "/sdcard",
      "/sdcard/DCIM",
      "/sdcard/Movies",
    ]);
  });

  it("a read that brings nothing back leaves the branch as it was", async () => {
    listings.set("/", [folder("data")]);
    const tree = mount();
    await tree.revealPath("/");
    await tree.reload("/", async () => undefined);
    expect(tree.rows.value.map((row) => row.path)).toEqual(["/", "/data"]);
  });
});
