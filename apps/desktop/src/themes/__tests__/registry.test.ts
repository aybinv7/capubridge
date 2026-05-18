// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { themes, getTheme, applyTheme, DEFAULT_THEME_ID, DEFAULT_ACCENT_ID } from "../registry";
import { getAccentRamp } from "../accent-ramps";

describe("themes registry", () => {
  test("ships exactly 6 themes", () => {
    expect(themes).toHaveLength(6);
  });
  test("default theme id is codex-dark", () => {
    expect(DEFAULT_THEME_ID).toBe("codex-dark");
  });
  test("default accent id is coral-amber", () => {
    expect(DEFAULT_ACCENT_ID).toBe("coral-amber");
  });
  test("getTheme returns a theme by id", () => {
    expect(getTheme("nord").id).toBe("nord");
  });
  test("getTheme falls back to default for unknown id", () => {
    expect(getTheme("does-not-exist").id).toBe(DEFAULT_THEME_ID);
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.style.cssText = "";
  });

  test("sets data-theme on the html element", () => {
    applyTheme(getTheme("nord"), getAccentRamp("blue"));
    expect(document.documentElement.dataset.theme).toBe("nord");
  });

  test("writes --accent and the seven accent step vars", () => {
    applyTheme(getTheme("codex-dark"), getAccentRamp("coral-amber"));
    const html = document.documentElement;
    expect(html.style.getPropertyValue("--accent")).toBeTruthy();
    expect(html.style.getPropertyValue("--accent-0")).toBeTruthy();
    expect(html.style.getPropertyValue("--accent-6")).toBeTruthy();
  });

  test("writes the semantic Layer-B vars", () => {
    applyTheme(getTheme("codex-dark"), getAccentRamp("coral-amber"));
    expect(document.documentElement.style.getPropertyValue("--bg-surface")).toBe("#121214");
    expect(document.documentElement.style.getPropertyValue("--fg-default")).toBe("#f2efe9");
  });

  test("idempotent: applying the same theme twice produces the same state", () => {
    applyTheme(getTheme("nord"), getAccentRamp("blue"));
    const snapshot = document.documentElement.style.cssText;
    applyTheme(getTheme("nord"), getAccentRamp("blue"));
    expect(document.documentElement.style.cssText).toBe(snapshot);
  });
});
