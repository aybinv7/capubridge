// @vitest-environment happy-dom
import { describe, expect, test } from "vite-plus/test";
import { GO_SEQUENCE_TIMEOUT_MS, isEditableTarget, resolveGoKey } from "../useGoShortcuts";

const destinations = [
  { goKey: "d", path: "/devices" },
  { goKey: "n", path: "/network" },
  { path: "/settings" },
];

describe("resolveGoKey", () => {
  test("g starts a sequence", () => {
    expect(resolveGoKey("g", null, 100, destinations)).toEqual({ pendingSince: 100, path: null });
  });

  test("a mapped key inside the window navigates", () => {
    expect(resolveGoKey("n", 100, 600, destinations)).toEqual({
      pendingSince: null,
      path: "/network",
    });
  });

  test("keys are case-insensitive", () => {
    expect(resolveGoKey("D", 100, 200, destinations).path).toBe("/devices");
  });

  test("an unmapped key cancels the sequence", () => {
    expect(resolveGoKey("x", 100, 200, destinations)).toEqual({ pendingSince: null, path: null });
  });

  test("an expired sequence does not navigate", () => {
    const late = 100 + GO_SEQUENCE_TIMEOUT_MS + 1;
    expect(resolveGoKey("n", 100, late, destinations)).toEqual({ pendingSince: null, path: null });
  });

  test("letters without a pending g do nothing", () => {
    expect(resolveGoKey("n", null, 100, destinations)).toEqual({ pendingSince: null, path: null });
  });
});

describe("isEditableTarget", () => {
  test("inputs, textareas and contenteditable are editable", () => {
    document.body.innerHTML =
      '<input id="a" /><textarea id="b"></textarea><div id="c" contenteditable="true"><span id="d"></span></div><button id="e"></button>';
    expect(isEditableTarget(document.getElementById("a"))).toBe(true);
    expect(isEditableTarget(document.getElementById("b"))).toBe(true);
    expect(isEditableTarget(document.getElementById("d"))).toBe(true);
    expect(isEditableTarget(document.getElementById("e"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
