import { describe, test, expect } from "vite-plus/test";
import { relativeLuminance, contrastRatio, classifyContrast } from "../contrast";

describe("relativeLuminance", () => {
  test("returns 1 for pure white", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 4);
  });
  test("returns 0 for pure black", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 4);
  });
  test("matches the WCAG worked example for #777", () => {
    // sRGB 0x77 -> linear ~0.1845 -> Y ~0.1845 (gray)
    expect(relativeLuminance("#777777")).toBeCloseTo(0.1845, 3);
  });
  test("accepts shorthand hex", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 4);
  });
});

describe("contrastRatio", () => {
  test("21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
  test("1:1 for identical colors", () => {
    expect(contrastRatio("#abcdef", "#abcdef")).toBeCloseTo(1, 4);
  });
  test("symmetric: order does not matter", () => {
    const a = contrastRatio("#1a1a1a", "#fafaf7");
    const b = contrastRatio("#fafaf7", "#1a1a1a");
    expect(a).toBeCloseTo(b, 4);
  });
});

describe("classifyContrast", () => {
  test("FAIL below 3:1", () => {
    expect(classifyContrast(2.9)).toBe("FAIL");
  });
  test("AA-large between 3:1 and 4.5:1", () => {
    expect(classifyContrast(3.5)).toBe("AA-large");
  });
  test("AA between 4.5:1 and 7:1", () => {
    expect(classifyContrast(5)).toBe("AA");
  });
  test("AAA at 7:1 and above", () => {
    expect(classifyContrast(7)).toBe("AAA");
    expect(classifyContrast(15)).toBe("AAA");
  });
});
