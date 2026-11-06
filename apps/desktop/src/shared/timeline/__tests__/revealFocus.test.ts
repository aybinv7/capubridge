// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { effectScope, nextTick, ref, type Ref } from "vue";
import { requestRevealFocus, useRevealFocus } from "../revealFocus";
import { keptLookup } from "../keptLookup";
import { RingBuffer } from "@/lib/ring-buffer";

interface Row {
  id: string;
}

function mount(rows: Ref<Row[]>, showAll?: () => void) {
  const scrolled: number[] = [];
  const scope = effectScope();
  const flashId = scope.run(() =>
    useRevealFocus<Row>("console", {
      rows,
      idOf: (row) => row.id,
      scrollToIndex: (index) => scrolled.push(index),
      showAll,
    }),
  );
  return { flashId, scrolled, scope };
}

async function frame() {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
}

describe("reveal focus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a view mounted after the request scrolls to the row and flashes it", async () => {
    requestRevealFocus("console", "b");
    const { flashId, scrolled, scope } = mount(ref([{ id: "a" }, { id: "b" }]));
    expect(flashId?.value).toBe("b");
    await frame();
    expect(scrolled).toEqual([1]);
    scope.stop();
  });

  test("clears the view's filters once when they hide the row", async () => {
    const rows = ref<Row[]>([{ id: "a" }]);
    const showAll = vi.fn(() => {
      rows.value = [{ id: "a" }, { id: "hidden" }];
    });
    const { flashId, scope } = mount(rows, showAll);
    requestRevealFocus("console", "hidden");
    await nextTick();
    await nextTick();
    expect(showAll).toHaveBeenCalledTimes(1);
    expect(flashId?.value).toBe("hidden");
    scope.stop();
  });

  test("ignores requests for another view and drops stale ones", async () => {
    vi.useFakeTimers();
    requestRevealFocus("logcat", "a");
    const first = mount(ref([{ id: "a" }]));
    expect(first.flashId?.value).toBeNull();
    first.scope.stop();

    requestRevealFocus("console", "a");
    vi.advanceTimersByTime(5000);
    const late = mount(ref([{ id: "a" }]));
    expect(late.flashId?.value).toBeNull();
    late.scope.stop();
  });

  test("the flash ends on its own", () => {
    vi.useFakeTimers();
    requestRevealFocus("console", "a");
    const { flashId, scope } = mount(ref([{ id: "a" }]));
    expect(flashId?.value).toBe("a");
    vi.advanceTimersByTime(2000);
    expect(flashId?.value).toBeNull();
    scope.stop();
  });
});

describe("kept lookup", () => {
  test("answers from the ring as it is now, including after eviction", () => {
    const ring = new RingBuffer<Row>(3);
    ring.pushAll([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const isKept = keptLookup(ring, (row) => row.id);
    expect(isKept("a")).toBe(true);
    ring.pushAll([{ id: "d" }]);
    expect(isKept("a")).toBe(false);
    expect(isKept("d")).toBe(true);
    expect(isKept("zz")).toBe(false);
  });
});
