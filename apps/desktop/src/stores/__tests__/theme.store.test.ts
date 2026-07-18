// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useThemeStore } from "../theme.store";

describe("themeStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.style.cssText = "";
  });

  test("defaults to codex-dark + coral-amber", () => {
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("codex-dark");
    expect(store.accentId).toBe("coral-amber");
    expect(document.documentElement.dataset.theme).toBe("codex-dark");
  });

  test("setTheme switches theme and persists", () => {
    const store = useThemeStore();
    store.initialize();
    store.setTheme("nord");
    expect(store.themeId).toBe("nord");
    expect(document.documentElement.dataset.theme).toBe("nord");
    expect(localStorage.getItem("capubridge:theme-id")).toBe("nord");
  });

  test("setAccent switches accent and persists", () => {
    const store = useThemeStore();
    store.initialize();
    store.setAccent("blue");
    expect(store.accentId).toBe("blue");
    expect(localStorage.getItem("capubridge:accent-id")).toBe("blue");
  });

  test("setCustomAccent generates and applies a custom ramp", () => {
    const store = useThemeStore();
    store.initialize();
    store.setCustomAccent("#3b82f6");
    expect(store.accentId).toBe("custom");
    expect(store.customAccentHex).toBe("#3b82f6");
    expect(localStorage.getItem("capubridge:accent-hex")).toBe("#3b82f6");
  });

  test("initialize restores from localStorage", () => {
    localStorage.setItem("capubridge:theme-id", "tokyo-night");
    localStorage.setItem("capubridge:accent-id", "purple");
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("tokyo-night");
    expect(store.accentId).toBe("purple");
  });

  test("mode getter mirrors the active theme's mode", () => {
    const store = useThemeStore();
    store.initialize();
    expect(store.mode).toBe("dark");
    store.setTheme("codex-light");
    expect(store.mode).toBe("light");
  });
});
