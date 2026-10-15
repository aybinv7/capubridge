import { describe, expect, test } from "vite-plus/test";
import { describeDatabaseEventError, validateDatabaseTrack } from "../databaseTrack";

const localStorageLine = {
  t: 0,
  data: {
    kind: "localStorage",
    origin: "https://app.example",
    entries: [{ key: "locale", value: "fr" }],
    reason: "initial",
  },
};

const tableChangeLine = {
  t: 5120,
  data: {
    kind: "tableChange",
    engine: "sqlite",
    table: "orders",
    type: "update",
    affectedRows: 1,
    affectedIds: ["ord_8812"],
    transactionId: "tx-41",
  },
};

describe("validateDatabaseTrack", () => {
  test("accepts localStorage and tableChange events", () => {
    const result = validateDatabaseTrack([localStorageLine, tableChangeLine]);
    expect(result.events).toHaveLength(2);
    expect(result.events[1].data.kind).toBe("tableChange");
    expect(result.skippedKinds).toEqual([]);
  });

  test("accepts nullable tableChange fields", () => {
    const result = validateDatabaseTrack([
      {
        t: 1,
        data: {
          kind: "tableChange",
          engine: "sqlite",
          table: "orders",
          type: "bulk",
          affectedRows: null,
          affectedIds: null,
          transactionId: null,
        },
      },
    ]);
    expect(result.events[0].data).toMatchObject({ type: "bulk", affectedRows: null });
  });

  test("skips unknown kinds and reports them", () => {
    const result = validateDatabaseTrack([{ t: 0, data: { kind: "cookies" } }, tableChangeLine]);
    expect(result.events).toHaveLength(1);
    expect(result.skippedKinds).toEqual(["cookies"]);
  });

  test("rejects malformed tableChange events with the event index and reason", () => {
    expect(() =>
      validateDatabaseTrack([
        localStorageLine,
        { t: 1, data: { ...tableChangeLine.data, type: "upsert" } },
      ]),
    ).toThrow(
      "Corrupt databases track at event 2: tableChange.type must be insert, update, delete or bulk",
    );
    expect(() =>
      validateDatabaseTrack([{ t: 1, data: { ...tableChangeLine.data, engine: "indexedDB" } }]),
    ).toThrow("tableChange.engine must be sqlite");
    expect(() =>
      validateDatabaseTrack([{ t: 1, data: { ...tableChangeLine.data, affectedRows: -1 } }]),
    ).toThrow("tableChange.affectedRows must be a non-negative integer or null");
    expect(() =>
      validateDatabaseTrack([{ t: 1, data: { ...tableChangeLine.data, affectedIds: [{}] } }]),
    ).toThrow("tableChange.affectedIds must be an array of strings or numbers, or null");
  });

  test("rejects malformed localStorage events and non-object data", () => {
    expect(describeDatabaseEventError({ ...localStorageLine.data, reason: "later" })).toBe(
      "localStorage.reason must be initial, change or final",
    );
    expect(describeDatabaseEventError({ ...localStorageLine.data, entries: [{ key: 1 }] })).toBe(
      "localStorage.entries must be an array of { key, value } strings",
    );
    expect(describeDatabaseEventError("text")).toBe("data must be an object");
    expect(describeDatabaseEventError({})).toBe("data.kind must be a string");
  });
});
