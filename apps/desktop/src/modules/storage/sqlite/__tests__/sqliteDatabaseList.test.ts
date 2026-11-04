import { describe, expect, test } from "vite-plus/test";
import { carryOverUnreachable } from "../sqliteDatabaseList";
import type { SqliteDbFile } from "@/types/sqlite.types";

const native: SqliteDbFile = {
  name: "a.db",
  path: "/data/a.db",
  size: 1,
  sourceKind: "native-android",
};
const opfs: SqliteDbFile = { name: "Store.sqlite3", path: "opfs:/s", size: 9, sourceKind: "opfs" };
const jeep: SqliteDbFile = { name: "j.db", path: "jeep:j", size: 2, sourceKind: "jeep-sqlite" };

describe("carryOverUnreachable", () => {
  test("keeps OPFS databases listed, marked unreachable, when the WebView cannot answer", () => {
    const next = carryOverUnreachable([native, opfs, jeep], [native, jeep], {
      opfs: false,
      jeep: true,
    });
    expect(next.map((db) => [db.name, db.unreachable])).toEqual([
      ["a.db", false],
      ["j.db", false],
      ["Store.sqlite3", true],
    ]);
  });

  test("drops a database that a successful discovery no longer finds", () => {
    const next = carryOverUnreachable([native, opfs], [native], { opfs: true, jeep: true });
    expect(next.map((db) => db.name)).toEqual(["a.db"]);
  });

  test("a rediscovered database is reachable again", () => {
    const stale = { ...opfs, unreachable: true };
    expect(carryOverUnreachable([stale], [opfs], { opfs: true, jeep: true })[0]?.unreachable).toBe(
      false,
    );
  });

  test("native databases never linger", () => {
    expect(carryOverUnreachable([native], [], { opfs: false, jeep: false })).toEqual([]);
  });
});
