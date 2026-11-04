import { describe, expect, it } from "vite-plus/test";
import { isRovingKey, nextRovingIndex } from "../rovingFocus";

describe("nextRovingIndex", () => {
  it("moves down and wraps to the first item", () => {
    expect(nextRovingIndex(0, 3, "ArrowDown")).toBe(1);
    expect(nextRovingIndex(2, 3, "ArrowDown")).toBe(0);
  });

  it("moves up and wraps to the last item", () => {
    expect(nextRovingIndex(1, 3, "ArrowUp")).toBe(0);
    expect(nextRovingIndex(0, 3, "ArrowUp")).toBe(2);
  });

  it("enters from the nearest end when nothing is focused", () => {
    expect(nextRovingIndex(-1, 3, "ArrowDown")).toBe(0);
    expect(nextRovingIndex(-1, 3, "ArrowUp")).toBe(2);
  });

  it("jumps to the ends", () => {
    expect(nextRovingIndex(1, 4, "Home")).toBe(0);
    expect(nextRovingIndex(1, 4, "End")).toBe(3);
  });

  it("has nowhere to go in an empty list", () => {
    expect(nextRovingIndex(-1, 0, "ArrowDown")).toBe(-1);
  });
});

describe("isRovingKey", () => {
  it("accepts only list navigation keys", () => {
    expect(isRovingKey("ArrowDown")).toBe(true);
    expect(isRovingKey("Enter")).toBe(false);
    expect(isRovingKey("ArrowLeft")).toBe(false);
  });
});
