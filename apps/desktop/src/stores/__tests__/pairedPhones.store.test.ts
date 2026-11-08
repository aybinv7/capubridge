// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { installMemoryStorage } from "@/test/memory-storage";
import { usePairedPhonesStore } from "../pairedPhones.store";

const KEY = "capubridge.paired-phones.v1";

describe("paired phones store", () => {
  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
  });

  test("a newly remembered phone reconnects by itself and is persisted without an address", () => {
    const store = usePairedPhonesStore();
    store.remember("adb-R5CR-Xy", "Google Pixel 8");
    expect(store.find("adb-R5CR-Xy")?.autoReconnect).toBe(true);
    expect(store.autoReconnectGuids.has("adb-R5CR-Xy")).toBe(true);
    const saved = localStorage.getItem(KEY) ?? "";
    expect(saved).toContain("Google Pixel 8");
    expect(saved).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  test("remembering again keeps the choice and the last known name", () => {
    const store = usePairedPhonesStore();
    store.remember("adb-R5CR-Xy", "Google Pixel 8");
    store.setAutoReconnect("adb-R5CR-Xy", false);
    store.remember("adb-R5CR-Xy", null);
    expect(store.find("adb-R5CR-Xy")).toMatchObject({
      label: "Google Pixel 8",
      autoReconnect: false,
    });
    expect(store.autoReconnectGuids.size).toBe(0);
  });

  test("restores valid entries and ignores corrupted storage", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ guid: "g", label: null, autoReconnect: true, lastConnectedAt: 1 }]),
    );
    expect(usePairedPhonesStore().phones).toHaveLength(1);

    setActivePinia(createPinia());
    localStorage.setItem(KEY, JSON.stringify([{ guid: 3 }]));
    expect(usePairedPhonesStore().phones).toEqual([]);
  });

  test("forget removes the phone", () => {
    const store = usePairedPhonesStore();
    store.remember("g", "Phone");
    store.forget("g");
    expect(store.find("g")).toBeNull();
  });
});
