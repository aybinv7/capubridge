import { describe, expect, test } from "vite-plus/test";
import type { DatabaseCapuEvent, TableChangeCapuData } from "@/types/replay.types";
import {
  buildTableChangeMarkers,
  buildTableChangeSources,
  countChangesAtOrBefore,
  formatAffectedRows,
  groupTableChanges,
  tableChangeMarkerClass,
  truncateAffectedIds,
} from "../replayTableChanges";

function change(
  t: number,
  overrides: Partial<Omit<TableChangeCapuData, "kind" | "engine">> = {},
): DatabaseCapuEvent {
  return {
    t,
    data: {
      kind: "tableChange",
      engine: "sqlite",
      table: "orders",
      type: "insert",
      affectedRows: 1,
      affectedIds: ["ord_1"],
      transactionId: null,
      ...overrides,
    },
  };
}

const localStorageEvent: DatabaseCapuEvent = {
  t: 10,
  data: {
    kind: "localStorage",
    origin: "https://app.example",
    entries: [{ key: "locale", value: "fr" }],
    reason: "initial",
  },
};

describe("buildTableChangeSources", () => {
  test("builds one virtual source per (engine, table) from three tableChange events", () => {
    const events = [
      localStorageEvent,
      change(3000, { type: "delete", affectedRows: 2, affectedIds: ["ord_1", "ord_2"] }),
      change(1000),
      change(2000, { type: "update", table: "customers", affectedIds: [7], transactionId: "tx-1" }),
    ];

    const sources = buildTableChangeSources(events);

    expect(sources.map((source) => source.id)).toEqual([
      "tableChange:sqlite:customers",
      "tableChange:sqlite:orders",
    ]);
    const orders = sources[1];
    expect(orders.kind).toBe("tableChange");
    expect(orders.label).toBe("orders");
    expect(orders.recordCount).toBe(2);
    expect(orders.changes.map((entry) => entry.tMs)).toEqual([1000, 3000]);
    expect(orders.counts).toEqual({ insert: 1, update: 0, delete: 1, bulk: 0 });
    expect(sources[0].changes[0]).toMatchObject({
      tMs: 2000,
      type: "update",
      affectedRows: 1,
      affectedIds: [7],
      transactionId: "tx-1",
    });
  });

  test("ignores localStorage snapshots", () => {
    expect(buildTableChangeSources([localStorageEvent])).toEqual([]);
  });
});

describe("groupTableChanges", () => {
  test("groups by transactionId and keeps autocommit changes standalone", () => {
    const source = buildTableChangeSources([
      change(1000, { transactionId: "tx-9" }),
      change(1500),
      change(1200, { type: "update", transactionId: "tx-9" }),
      change(2000, { type: "bulk", affectedRows: null, affectedIds: null }),
    ])[0];

    const groups = groupTableChanges(source.changes);

    expect(groups.map((group) => [group.transactionId, group.changes.length])).toEqual([
      ["tx-9", 2],
      [null, 1],
      [null, 1],
    ]);
    expect(groups[0].tMs).toBe(1000);
    expect(groups[0].changes.map((entry) => entry.type)).toEqual(["insert", "update"]);
  });

  test("counts only the changes at or before the playhead", () => {
    const source = buildTableChangeSources([change(1000), change(2000), change(3000)])[0];
    expect(countChangesAtOrBefore(source.changes, 0)).toBe(0);
    expect(countChangesAtOrBefore(source.changes, 2000)).toBe(2);
    expect(countChangesAtOrBefore(source.changes, 9000)).toBe(3);
  });
});

describe("tableChange formatters", () => {
  test("truncates affectedIds and reports the hidden count", () => {
    expect(truncateAffectedIds(null)).toEqual({ shown: [], hidden: 0 });
    expect(truncateAffectedIds([])).toEqual({ shown: [], hidden: 0 });
    expect(truncateAffectedIds([1, "b", 3], 2)).toEqual({ shown: ["1", "b"], hidden: 1 });
  });

  test("formats affectedRows and treats null as not available", () => {
    expect(formatAffectedRows({ affectedRows: null })).toBe("rows: n/a");
    expect(formatAffectedRows({ affectedRows: 1 })).toBe("1 row");
    expect(formatAffectedRows({ affectedRows: 12 })).toBe("12 rows");
  });
});

describe("buildTableChangeMarkers", () => {
  test("emits one marker per tableChange coloured by type", () => {
    const events = [
      localStorageEvent,
      change(0),
      change(5000, { type: "update" }),
      change(10000, { type: "delete", table: "customers", affectedRows: null }),
    ];

    const markers = buildTableChangeMarkers(events, 10000);

    expect(markers).toHaveLength(3);
    expect(markers.map((marker) => marker.pct)).toEqual([0, 50, 100]);
    expect(markers.map((marker) => marker.type)).toEqual(["insert", "update", "delete"]);
    expect(markers[2].title).toBe("customers · delete · rows: n/a");
    expect(markers[1].title).toBe("orders · update · 1 row");
    expect(tableChangeMarkerClass("bulk")).toBe("bg-violet-400/80");
  });

  test("returns zero percent when the duration is unknown", () => {
    expect(buildTableChangeMarkers([change(4000)], 0)[0].pct).toBe(0);
  });
});
