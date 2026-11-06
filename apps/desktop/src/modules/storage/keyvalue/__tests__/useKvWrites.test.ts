import { describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import type { KeyValueDomain } from "@capubridge/cdp-protocol";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("@capubridge/cdp-protocol", () => ({ KeyValueConflictError: class extends Error {} }));

const { useKvWrites } = await import("../useKvWrites");
const { makeSource } = await import("../kvModel");

function setup(state: { pending: boolean; away: string | null }) {
  const write = vi.fn().mockResolvedValue({ gone: false });
  const afterWrite = vi.fn();
  const writes = useKvWrites({
    source: makeSource({ kind: "local", origin: "https://app" }),
    domain: () => ({ write }) as unknown as KeyValueDomain,
    pending: ref(state.pending),
    away: ref(state.away),
    confirm: vi.fn(),
    afterWrite,
  });
  return { writes, write, afterWrite };
}

describe("writes wait when the phone cannot be trusted to answer (U1)", () => {
  test("nothing is sent while the list is still being read", async () => {
    const { writes, write } = setup({ pending: true, away: null });
    await expect(writes.save({ entry: null, key: "a", value: "b" })).resolves.toBe("kept");
    expect(write).not.toHaveBeenCalled();
    expect(writes.blockedReason.value).toBe("The keys are still being read.");
  });

  test("nothing is sent while the app is away, and the reason is shown", async () => {
    const { writes, write } = setup({ pending: false, away: "The app is in the background" });
    await writes.save({ entry: null, key: "a", value: "b" });
    expect(write).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Nothing was saved", {
      description: "The app is in the background",
    });
  });

  test("a saved write reads the list again", async () => {
    const { writes, write, afterWrite } = setup({ pending: false, away: null });
    await expect(writes.save({ entry: null, key: "a", value: "b" })).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(1);
    expect(afterWrite).toHaveBeenCalledTimes(1);
  });
});
