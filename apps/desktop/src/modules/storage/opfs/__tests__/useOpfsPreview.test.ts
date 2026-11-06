import { describe, expect, test, vi } from "vite-plus/test";
import { effectScope, nextTick, ref } from "vue";
import type { OPFSDomain } from "@capubridge/cdp-protocol";
import type { OpfsRow } from "../opfsModel";
import { OPFS_MEDIA_PREVIEW_CAP, refusedPreview, useOpfsPreview } from "../useOpfsPreview";
import { file, row } from "./opfsFixtures";

function bytesDomain(read: (path: string, length: number) => Promise<Uint8Array>) {
  const readFileBytes = vi.fn((path: string, range?: { length?: number }) =>
    read(path, range?.length ?? 0),
  );
  return { readFileBytes, domain: () => ({ readFileBytes }) as unknown as OPFSDomain };
}

async function settle(ms = 0) {
  for (let index = 0; index < 6; index += 1) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, ms));
  for (let index = 0; index < 6; index += 1) await nextTick();
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("OPFS preview", () => {
  test("refuses a video over the pane's budget before reading it", () => {
    expect(refusedPreview({ name: "clip.mp4", size: OPFS_MEDIA_PREVIEW_CAP + 1 })).toMatchObject({
      status: "too-large",
      kind: "video",
    });
    expect(refusedPreview({ name: "clip.mp4", size: 1024 })).toBeNull();
    expect(refusedPreview({ name: "big.json", size: OPFS_MEDIA_PREVIEW_CAP * 2 })).toBeNull();
  });

  test("reads a text file through DevTools and shows it", async () => {
    const { domain, readFileBytes } = bytesDomain(async () => text("hello"));
    const current = ref<OpfsRow | null>(row(file("notes.txt", 5)));
    const scope = effectScope();
    const preview = scope.run(() => useOpfsPreview({ row: current, paused: ref(false), domain }));
    await settle();
    expect(readFileBytes).toHaveBeenCalledWith("notes.txt", { offset: 0, length: 5 });
    expect(preview?.state.value).toMatchObject({
      status: "ready",
      content: { kind: "text", text: "hello" },
    });
    scope.stop();
  });

  test("never reads a file the app holds open", async () => {
    const { domain, readFileBytes } = bytesDomain(async () => new Uint8Array());
    const locked = row(file("app.sqlite3", 0, { size: null, locked: true }));
    const scope = effectScope();
    const preview = scope.run(() =>
      useOpfsPreview({ row: ref<OpfsRow | null>(locked), paused: ref(false), domain }),
    );
    await settle();
    expect(readFileBytes).not.toHaveBeenCalled();
    expect(preview?.state.value.status).toBe("idle");
    scope.stop();
  });

  test("waits while the app is away and reads when it returns", async () => {
    const { domain, readFileBytes } = bytesDomain(async () => text("{}"));
    const paused = ref(true);
    const scope = effectScope();
    const preview = scope.run(() =>
      useOpfsPreview({ row: ref<OpfsRow | null>(row(file("a.json", 2))), paused, domain }),
    );
    await settle();
    expect(readFileBytes).not.toHaveBeenCalled();
    expect(preview?.state.value.status).toBe("loading");
    paused.value = false;
    await settle();
    expect(readFileBytes).toHaveBeenCalledTimes(1);
    expect(preview?.state.value.status).toBe("ready");
    scope.stop();
  });

  test("drops a read that finishes after the pane moved to another file", async () => {
    let release: (bytes: Uint8Array) => void = () => undefined;
    const slow = new Promise<Uint8Array>((resolve) => (release = resolve));
    const { domain } = bytesDomain((path) =>
      path === "slow.txt" ? slow : Promise.resolve(text("fast")),
    );
    const current = ref<OpfsRow | null>(row(file("slow.txt", 4)));
    const scope = effectScope();
    const preview = scope.run(() => useOpfsPreview({ row: current, paused: ref(false), domain }));
    await settle();
    current.value = row(file("fast.txt", 4));
    await settle(200);
    release(text("slow"));
    await settle();
    expect(preview?.state.value).toMatchObject({ content: { text: "fast" } });
    scope.stop();
  });
});
