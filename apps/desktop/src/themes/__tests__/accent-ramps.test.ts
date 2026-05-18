import { describe, test, expect } from "vite-plus/test";
import { presetAccents, getAccentRamp, hexToRamp } from "../accent-ramps";
import { contrastRatio } from "../contrast";

describe("presetAccents", () => {
  test("ships 8 presets including coral-amber as the default", () => {
    expect(presetAccents).toHaveLength(8);
    expect(presetAccents[0].id).toBe("coral-amber");
  });
  test("every preset has 7 ramp steps", () => {
    for (const ramp of presetAccents) {
      expect(ramp.steps).toHaveLength(7);
      for (const step of ramp.steps) {
        expect(step).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});

describe("getAccentRamp", () => {
  test("returns preset by id", () => {
    expect(getAccentRamp("coral-amber").id).toBe("coral-amber");
    expect(getAccentRamp("blue").id).toBe("blue");
  });
  test("throws on unknown id", () => {
    expect(() => getAccentRamp("nope")).toThrow(/unknown accent/i);
  });
});

describe("hexToRamp", () => {
  test("produces 7 steps from a single hex seed", () => {
    const ramp = hexToRamp("#3b82f6");
    expect(ramp.id).toBe("custom");
    expect(ramp.steps).toHaveLength(7);
  });
  test("middle step is close to the seed color", () => {
    const seed = "#3b82f6";
    const ramp = hexToRamp(seed);
    // step[3] is the mid-tone — should be perceptually close
    expect(contrastRatio(ramp.steps[3], seed)).toBeLessThan(1.5);
  });
  test("generated ramp passes 4.5:1 against a typical light surface", () => {
    const ramp = hexToRamp("#3b82f6");
    // step[4] (slightly darker than mid) should pass AA on #ffffff
    expect(contrastRatio(ramp.steps[4], "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  test("generated ramp passes 4.5:1 against a typical dark surface", () => {
    const ramp = hexToRamp("#3b82f6");
    // step[2] (slightly lighter than mid) should pass AA on #121214
    expect(contrastRatio(ramp.steps[2], "#121214")).toBeGreaterThanOrEqual(4.5);
  });
});
