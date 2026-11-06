import { describe, expect, it } from "vite-plus/test";
import { effectScope, nextTick, ref } from "vue";
import { useRingView } from "@/composables/useRingView";
import { RingBuffer } from "@/lib/ring-buffer";
import { createStreamFeed } from "@/lib/stream-feed";

interface Item {
  seq: number;
  even: boolean;
}

function item(seq: number): Item {
  return { seq, even: seq % 2 === 0 };
}

function source(capacity: number) {
  const ring = new RingBuffer<Item>(capacity);
  const feed = createStreamFeed<Item>("test");
  return {
    ring,
    feed,
    append(seqs: number[]) {
      const items = seqs.map(item);
      const evicted = ring.pushAll(items);
      feed.emit({ kind: "append", items, evicted });
    },
  };
}

describe("useRingView", () => {
  it("filters appended items and drops evicted ones from the front", async () => {
    const stream = source(4);
    const scope = effectScope();
    const predicate = ref<((entry: Item) => boolean) | null>((entry) => entry.even);
    const view = scope.run(() => useRingView(stream, predicate));
    if (!view) throw new Error("view not created");

    stream.append([1, 2, 3, 4]);
    expect(view.rows.value.map((entry) => entry.seq)).toEqual([2, 4]);
    stream.append([5, 6, 7]);
    expect(view.rows.value.map((entry) => entry.seq)).toEqual([4, 6]);

    predicate.value = null;
    await nextTick();
    expect(view.rows.value.map((entry) => entry.seq)).toEqual([4, 5, 6, 7]);
    scope.stop();
  });

  it("holds still while frozen and catches up when released", async () => {
    const stream = source(10);
    const frozen = ref(false);
    const scope = effectScope();
    const view = scope.run(() => useRingView(stream, ref(null), { frozen }));
    if (!view) throw new Error("view not created");

    stream.append([1, 2]);
    frozen.value = true;
    stream.append([3, 4, 5]);
    expect(view.rows.value.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(view.pending.value).toBe(3);

    frozen.value = false;
    await nextTick();
    expect(view.rows.value.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(view.pending.value).toBe(0);
    scope.stop();
  });

  it("empties on clear and stops listening when its scope ends", () => {
    const stream = source(10);
    const scope = effectScope();
    const view = scope.run(() => useRingView(stream, ref(null)));
    if (!view) throw new Error("view not created");
    stream.append([1]);
    stream.ring.clear();
    stream.feed.emit({ kind: "clear" });
    expect(view.rows.value).toEqual([]);
    scope.stop();
    stream.append([2]);
    expect(view.rows.value).toEqual([]);
  });
});
