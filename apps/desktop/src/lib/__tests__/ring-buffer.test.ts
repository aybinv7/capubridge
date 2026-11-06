import { describe, expect, it } from "vite-plus/test";
import { RingBuffer } from "@/lib/ring-buffer";

describe("RingBuffer", () => {
  it("keeps items oldest first until full", () => {
    const ring = new RingBuffer<number>(3);
    expect(ring.pushAll([1, 2])).toEqual([]);
    expect(ring.toArray()).toEqual([1, 2]);
    expect(ring.first()).toBe(1);
    expect(ring.last()).toBe(2);
  });

  it("evicts the oldest items once full and reports them in order", () => {
    const ring = new RingBuffer<number>(3);
    ring.pushAll([1, 2, 3]);
    expect(ring.pushAll([4, 5])).toEqual([1, 2]);
    expect(ring.toArray()).toEqual([3, 4, 5]);
    expect(ring.at(0)).toBe(3);
    expect(ring.at(3)).toBeUndefined();
    expect(ring.size).toBe(3);
  });

  it("handles a batch larger than the ring", () => {
    const ring = new RingBuffer<number>(2);
    expect(ring.pushAll([1, 2, 3, 4, 5])).toEqual([1, 2, 3]);
    expect(ring.toArray()).toEqual([4, 5]);
  });

  it("returns the newest items with tail and empties on clear", () => {
    const ring = new RingBuffer<number>(4);
    ring.pushAll([1, 2, 3, 4, 5, 6]);
    expect(ring.tail(2)).toEqual([5, 6]);
    expect(ring.tail(10)).toEqual([3, 4, 5, 6]);
    ring.clear();
    expect(ring.size).toBe(0);
    expect(ring.toArray()).toEqual([]);
    ring.pushAll([7]);
    expect(ring.toArray()).toEqual([7]);
  });

  it("rejects a capacity that is not a positive integer", () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
    expect(() => new RingBuffer(1.5)).toThrow(RangeError);
  });
});
