import { beforeEach, describe, expect, test } from "vite-plus/test";
import { readPersisted, writePersisted } from "../persisted";
import { installMemoryStorage } from "@/test/memory-storage";

const isWidth = (value: unknown) => typeof value === "number" && value > 0;

describe("persisted layout state", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  test("returns the fallback when nothing is stored", () => {
    expect(readPersisted("k", 272, isWidth)).toBe(272);
  });

  test("round-trips a valid value", () => {
    writePersisted("k", 320);
    expect(readPersisted("k", 272, isWidth)).toBe(320);
  });

  test("falls back when the stored value fails validation", () => {
    writePersisted("k", -5);
    expect(readPersisted("k", 272, isWidth)).toBe(272);
  });

  test("falls back on malformed JSON", () => {
    localStorage.setItem("k", "{not json");
    expect(readPersisted("k", 272, isWidth)).toBe(272);
  });
});
