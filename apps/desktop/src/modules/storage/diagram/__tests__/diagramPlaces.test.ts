import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  lastDiagramPath,
  readIncludeOther,
  rememberDiagramPath,
  writeIncludeOther,
} from "../diagramPlaces";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));

describe("diagram places", () => {
  test("the old Graph address leads to the SQLite tab until a diagram was shown", () => {
    expect(lastDiagramPath()).toBe("/storage/sqlite");
    rememberDiagramPath(
      "/storage/sqlite/%2Fdata%2Fdata%2Fcom.shop%2Fdatabases%2Fa.db?view=diagram",
    );
    expect(lastDiagramPath()).toBe(
      "/storage/sqlite/%2Fdata%2Fdata%2Fcom.shop%2Fdatabases%2Fa.db?view=diagram",
    );
  });

  test("only diagrams of databases that outlive a restart are remembered", () => {
    rememberDiagramPath("/storage/indexeddb/shop?view=diagram");
    rememberDiagramPath("/storage/sqlite-file/k3/?view=diagram");
    rememberDiagramPath("/storage/indexeddb-snapshot/f1?view=diagram");
    rememberDiagramPath("/storage/sqlite/a.db");
    rememberDiagramPath("/network");
    expect(lastDiagramPath()).toBe("/storage/indexeddb/shop?view=diagram");
  });

  test("the other-data choice is kept per kind", () => {
    expect(readIncludeOther("sqlite")).toBe(false);
    writeIncludeOther("sqlite", true);
    expect(readIncludeOther("sqlite")).toBe(true);
    expect(readIncludeOther("indexeddb")).toBe(false);
  });
});
