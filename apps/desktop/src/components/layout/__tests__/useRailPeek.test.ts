import { effectScope, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useRailPeek } from "../useRailPeek";

function pointer(buttons = 0) {
  return { buttons } as PointerEvent;
}

describe("useRailPeek", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(hidden = true) {
    const scope = effectScope();
    const state = ref(hidden);
    const peek = scope.run(() => useRailPeek(state));
    if (!peek) throw new Error("scope did not run");
    return { scope, state, peek };
  }

  it("opens after a short rest on the edge and closes after leaving the rail", () => {
    const { peek } = setup();
    peek.reveal(pointer());
    expect(peek.peeking.value).toBe(false);
    vi.advanceTimersByTime(60);
    expect(peek.peeking.value).toBe(true);
    peek.conceal();
    vi.advanceTimersByTime(239);
    expect(peek.peeking.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(peek.peeking.value).toBe(false);
  });

  it("ignores a pointer that only sweeps past or drags", () => {
    const { peek } = setup();
    peek.reveal(pointer());
    peek.hold();
    vi.advanceTimersByTime(200);
    expect(peek.peeking.value).toBe(false);
    peek.reveal(pointer(1));
    vi.advanceTimersByTime(200);
    expect(peek.peeking.value).toBe(false);
  });

  it("stays shut while the rail is pinned open", () => {
    const { peek, state } = setup(false);
    peek.reveal(pointer());
    vi.advanceTimersByTime(200);
    expect(peek.peeking.value).toBe(false);
    state.value = true;
    peek.reveal(pointer());
    vi.advanceTimersByTime(60);
    expect(peek.peeking.value).toBe(true);
  });
});
