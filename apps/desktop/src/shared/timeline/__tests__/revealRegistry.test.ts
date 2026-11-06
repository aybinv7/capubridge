import { describe, expect, it } from "vite-plus/test";
import { isMarkerKept, registerReveal, revealMarker } from "@/shared/timeline/revealRegistry";

describe("reveal registry", () => {
  it("routes a marker to the section that registered its kind", async () => {
    const revealed: string[] = [];
    const unregister = registerReveal("network", {
      reveal: (ref) => {
        revealed.push(ref.id);
        return ref.id !== "evicted";
      },
      isKept: (ref) => ref.id !== "evicted",
    });

    expect(await revealMarker({ kind: "network", id: "r1" })).toBe("revealed");
    expect(await revealMarker({ kind: "network", id: "evicted" })).toBe("aged-out");
    expect(isMarkerKept({ kind: "network", id: "evicted" })).toBe(false);
    expect(revealed).toEqual(["r1", "evicted"]);

    unregister();
    expect(await revealMarker({ kind: "network", id: "r1" })).toBe("no-handler");
  });

  it("keeps a newer registration when an older one unregisters", async () => {
    const stale = registerReveal("console", { reveal: () => false });
    const current = registerReveal("console", { reveal: () => true });
    stale();
    expect(await revealMarker({ kind: "console", id: "c1" })).toBe("revealed");
    current();
  });
});
