import { describe, expect, test, vi } from "vite-plus/test";
import type { CDPTarget } from "@/types/cdp.types";

vi.mock("@/composables/useTargetActivation", () => ({ useTargetActivation: () => ({}) }));
vi.mock("@/stores/connection.store", () => ({ useConnectionStore: () => ({}) }));
vi.mock("@/stores/targets.store", () => ({ useTargetsStore: () => ({}) }));

const { pickReturningPage } = await import("../lifecycle/useReattach");

function page(id: string, overrides: Partial<CDPTarget> = {}): CDPTarget {
  return {
    id,
    type: "page",
    title: "Retail",
    url: "https://localhost/",
    source: "adb",
    deviceSerial: "phone-a",
    packageName: "com.example.retail",
    ...overrides,
  } as CDPTarget;
}

describe("pickReturningPage", () => {
  const previous = { id: "old", url: "https://localhost/" };

  test("the dead page is never picked again; the new one at the same address is", () => {
    const targets = [
      page("old"),
      page("other", { url: "https://localhost/settings" }),
      page("new"),
    ];
    expect(pickReturningPage(targets, "phone-a", "com.example.retail", previous)?.id).toBe("new");
  });

  test("without the same address, the app's first page; other apps and phones never", () => {
    const targets = [
      page("x", { packageName: "com.other" }),
      page("y", { deviceSerial: "phone-b" }),
      page("z", { type: "worker" }),
      page("w", { url: "https://localhost/login", packageName: "com.example.retail:remote" }),
    ];
    expect(pickReturningPage(targets, "phone-a", "com.example.retail", previous)?.id).toBe("w");
    expect(pickReturningPage([page("old")], "phone-a", "com.example.retail", previous)).toBeNull();
  });
});
