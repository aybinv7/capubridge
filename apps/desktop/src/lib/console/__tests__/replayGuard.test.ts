import { describe, expect, it } from "vite-plus/test";
import { createReplayGuard } from "@/lib/console/replayGuard";

describe("createReplayGuard", () => {
  it("drops only kept messages from before the rebind", () => {
    const guard = createReplayGuard();
    guard.arm(["100|log|ready|app.js:3"], 1_000);
    expect(guard.isReplay(100, "100|log|ready|app.js:3")).toBe(true);
    expect(guard.isReplay(100, "100|log|other|app.js:3")).toBe(false);
    expect(guard.isReplay(1_500, "1500|log|ready|app.js:3")).toBe(false);
  });

  it("lets everything through once disarmed or before it is armed", () => {
    const guard = createReplayGuard();
    expect(guard.isReplay(1, "1|log|x|null:null")).toBe(false);
    guard.arm(["1|log|x|null:null"], 10);
    guard.disarm();
    expect(guard.isReplay(1, "1|log|x|null:null")).toBe(false);
  });
});
