import { describe, expect, it } from "vite-plus/test";
import { effectScope, ref } from "vue";
import { useRepeatRingView } from "@/composables/useRepeatRingView";
import { RingBuffer } from "@/lib/ring-buffer";
import { createStreamFeed } from "@/lib/stream-feed";

interface Item {
  seq: number;
  text: string;
}

const rule = {
  keyOf: (item: Item) => String(item.seq),
  same: (a: Item, b: Item) => a.text === b.text,
};

function stream(capacity: number) {
  const ring = new RingBuffer<Item>(capacity);
  const feed = createStreamFeed<Item>("test");
  let seq = 0;
  return {
    ring,
    feed,
    append(texts: string[]) {
      const items = texts.map((text) => ({ seq: ++seq, text }));
      feed.emit({ kind: "append", items, evicted: ring.pushAll(items) });
    },
  };
}

function shape(rows: ReadonlyArray<{ first: Item; last: Item; count: number }>) {
  return rows.map((row) => `${row.first.text}x${row.count}`);
}

describe("useRepeatRingView", () => {
  it("folds consecutive repeats and keeps first and last", () => {
    const source = stream(20);
    const scope = effectScope();
    const view = scope.run(() => useRepeatRingView(source, ref(null), { rule }));
    if (!view) throw new Error("view not created");

    source.append(["a", "a", "b", "a"]);
    source.append(["a", "a"]);
    expect(shape(view.rows.value)).toEqual(["ax2", "bx1", "ax3"]);
    expect(view.rows.value[2]?.first.seq).toBe(4);
    expect(view.rows.value[2]?.last.seq).toBe(6);
    scope.stop();
  });

  it("groups only what the filter keeps and shrinks rows as the ring evicts", () => {
    const source = stream(5);
    const scope = effectScope();
    const predicate = ref<((item: Item) => boolean) | null>((item) => item.text !== "noise");
    const view = scope.run(() => useRepeatRingView(source, predicate, { rule }));
    if (!view) throw new Error("view not created");

    source.append(["a", "noise", "a", "b", "b"]);
    expect(shape(view.rows.value)).toEqual(["ax2", "bx2"]);
    source.append(["b", "c"]);
    expect(shape(view.rows.value)).toEqual(["ax1", "bx3", "cx1"]);
    source.append(["c", "c"]);
    expect(shape(view.rows.value)).toEqual(["bx2", "cx3"]);
    predicate.value = null;
    expect(shape(view.rows.value)).toEqual(["bx2", "cx3"]);
    scope.stop();
  });

  it("counts arrivals while frozen and catches up when released", () => {
    const source = stream(4);
    const frozen = ref(false);
    const scope = effectScope();
    const view = scope.run(() => useRepeatRingView(source, ref(null), { rule, frozen }));
    if (!view) throw new Error("view not created");

    source.append(["a", "b"]);
    frozen.value = true;
    source.append(["c", "d", "e"]);
    expect(shape(view.rows.value)).toEqual(["ax1", "bx1"]);
    expect(view.pending.value).toBe(3);
    expect(view.evictedWhileFrozen.value).toBe(1);
    frozen.value = false;
    expect(shape(view.rows.value)).toEqual(["bx1", "cx1", "dx1", "ex1"]);
    expect(view.pending.value).toBe(0);
    scope.stop();
  });
});
