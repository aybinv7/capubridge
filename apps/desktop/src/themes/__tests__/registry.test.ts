// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { themes, getTheme, applyTheme, DEFAULT_THEME_ID } from "../registry";

describe("themes registry", () => {
  test("ships the Bench brand in dark and light plus high contrast", () => {
    expect(themes.map((theme) => theme.id)).toEqual(["bench-dark", "bench-light", "high-contrast"]);
  });

  test("default theme is bench-dark", () => {
    expect(DEFAULT_THEME_ID).toBe("bench-dark");
  });

  test("getTheme returns a theme by id and falls back for unknown ids", () => {
    expect(getTheme("bench-light").id).toBe("bench-light");
    expect(getTheme("codex-dark").id).toBe(DEFAULT_THEME_ID);
  });

  test("every theme defines every token role", () => {
    const roles = Object.keys(getTheme(DEFAULT_THEME_ID).tokens).sort();
    for (const theme of themes) {
      expect(Object.keys(theme.tokens).sort()).toEqual(roles);
    }
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-brand");
    document.documentElement.style.cssText = "";
  });

  test("marks the document with theme, mode and brand direction", () => {
    applyTheme(getTheme("bench-light"));
    const { dataset } = document.documentElement;
    expect(dataset.theme).toBe("bench-light");
    expect(dataset.themeMode).toBe("light");
    expect(dataset.brand).toBe("bench");
  });

  test("sets exactly one Cladd mode class so Cladd scopes follow the theme", () => {
    const html = document.documentElement;
    applyTheme(getTheme("bench-light"));
    expect(html.classList.contains("light")).toBe(true);
    expect(html.classList.contains("dark")).toBe(false);
    applyTheme(getTheme("bench-dark"));
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.classList.contains("light")).toBe(false);
  });

  test("writes token, signal and category variables", () => {
    const theme = getTheme("bench-dark");
    applyTheme(theme);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--bg-surface")).toBe(theme.tokens.bgSurface);
    expect(style.getPropertyValue("--signal-live")).toBe(theme.tokens.signalLive);
    expect(style.getPropertyValue("--cat-network")).toBe(theme.tokens.catNetwork);
  });

  test("selection drives the accent and ring aliases; primary is neutral ink", () => {
    const theme = getTheme("bench-dark");
    applyTheme(theme);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--accent")).toBe(theme.tokens.signalSelect);
    expect(style.getPropertyValue("--ring")).toBe(theme.tokens.signalSelect);
    expect(style.getPropertyValue("--brand")).toBe(theme.tokens.fgDefault);
    expect(style.getPropertyValue("--brand-foreground")).toBe(theme.tokens.bgApp);
  });

  test("writes the direction's font stacks", () => {
    const theme = getTheme("bench-light");
    applyTheme(theme);
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe(theme.fonts.sans);
    expect(document.documentElement.style.getPropertyValue("--font-mono")).toBe(theme.fonts.mono);
  });

  test("is idempotent", () => {
    applyTheme(getTheme("bench-light"));
    const snapshot = document.documentElement.style.cssText;
    applyTheme(getTheme("bench-light"));
    expect(document.documentElement.style.cssText).toBe(snapshot);
  });
});
