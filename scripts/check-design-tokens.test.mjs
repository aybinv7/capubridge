import { describe, expect, test } from "vite-plus/test";
import { findDesignTokenViolations } from "./check-design-tokens.mjs";

describe("findDesignTokenViolations", () => {
  test("flags arbitrary text sizes", () => {
    const violations = findDesignTokenViolations('<span class="text-[10px] font-mono" />');
    expect(violations.map((v) => v.token)).toEqual(["text-[10px]"]);
  });

  test("flags raw state palette colours with any utility prefix", () => {
    const violations = findDesignTokenViolations(
      '<div class="bg-red-500/10 text-amber-400 border-emerald-500/30 ring-sky-400" />',
    );
    expect(violations.map((v) => v.token)).toEqual([
      "bg-red-500",
      "text-amber-400",
      "border-emerald-500",
      "ring-sky-400",
    ]);
  });

  test("accepts semantic tokens, signals and the type scale", () => {
    const violations = findDesignTokenViolations(
      '<div class="text-error bg-warning/10 bg-signal-rec text-2xs text-sm text-cat-network" />',
    );
    expect(violations).toEqual([]);
  });

  test("reports the line number", () => {
    const violations = findDesignTokenViolations("a\nb\n<i class='text-[12px]' />");
    expect(violations[0]?.line).toBe(3);
  });
});
