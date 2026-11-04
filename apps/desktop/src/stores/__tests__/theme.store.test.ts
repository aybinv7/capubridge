// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useThemeStore } from "../theme.store";
import { installMemoryStorage } from "@/test/memory-storage";

describe("themeStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMemoryStorage();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.style.cssText = "";
  });

  test("defaults to bench-dark", () => {
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("bench-dark");
    expect(store.direction).toBe("bench");
    expect(document.documentElement.dataset.theme).toBe("bench-dark");
  });

  test("setTheme switches theme and persists", () => {
    const store = useThemeStore();
    store.initialize();
    store.setTheme("high-contrast");
    expect(store.themeId).toBe("high-contrast");
    expect(document.documentElement.dataset.theme).toBe("high-contrast");
    expect(localStorage.getItem("capubridge:theme-id")).toBe("high-contrast");
  });

  test("initialize restores a saved theme", () => {
    localStorage.setItem("capubridge:theme-id", "bench-light");
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("bench-light");
    expect(store.mode).toBe("light");
  });

  test("a retired theme id migrates to the default", () => {
    localStorage.setItem("capubridge:theme-id", "codex-dark");
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("bench-dark");
  });

  test("setTheme with an unknown id falls back to the default", () => {
    const store = useThemeStore();
    store.initialize();
    store.setTheme("nord");
    expect(store.themeId).toBe("bench-dark");
  });
});
