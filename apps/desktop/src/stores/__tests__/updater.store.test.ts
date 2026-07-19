// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useUpdaterStore } from "../updater.store";

describe("updater store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  test("initial state is idle with no update", () => {
    const store = useUpdaterStore();
    expect(store.status).toBe("idle");
    expect(store.info).toBeNull();
    expect(store.updateAvailable).toBe(false);
    expect(store.isBusy).toBe(false);
  });

  test("setPrerelease persists to localStorage", () => {
    const store = useUpdaterStore();
    expect(store.prerelease).toBe(false);
    store.setPrerelease(true);
    expect(store.prerelease).toBe(true);
    expect(localStorage.getItem("capubridge:update-prerelease")).toBe("true");
  });

  test("prerelease preference is restored from localStorage", () => {
    localStorage.setItem("capubridge:update-prerelease", "true");
    setActivePinia(createPinia());
    const store = useUpdaterStore();
    expect(store.prerelease).toBe(true);
  });

  test("isBusy is true while checking or downloading", () => {
    const store = useUpdaterStore();
    store.status = "checking";
    expect(store.isBusy).toBe(true);
    store.status = "downloading";
    expect(store.isBusy).toBe(true);
    store.status = "available";
    expect(store.isBusy).toBe(false);
  });

  test("updateAvailable is true only in available state", () => {
    const store = useUpdaterStore();
    store.status = "up-to-date";
    expect(store.updateAvailable).toBe(false);
    store.status = "available";
    expect(store.updateAvailable).toBe(true);
  });

  test("progressPct is null until total is known, then a clamped percentage", () => {
    const store = useUpdaterStore();
    expect(store.progressPct).toBeNull();
    store.total = 1000;
    store.downloaded = 250;
    expect(store.progressPct).toBe(25);
    store.downloaded = 5000; // over-report is clamped
    expect(store.progressPct).toBe(100);
  });
});
