import { describe, expect, test } from "vite-plus/test";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import { SqlitePartialValueError } from "../../sqlText";
import { buildGroupRowsQuery } from "../sqliteQuery";
import {
  GROUP_CHUNK,
  buildSectionRows,
  groupChildRows,
  groupValueKey,
  groupsOf,
  noteOf,
  type SqliteGroupChildren,
} from "../sqliteGroupSections";

const column = (name: string, pk = 0): SqliteColumnInfo => ({
  cid: 0,
  name,
  colType: "TEXT",
  notnull: false,
  defaultValue: null,
  pk,
});

const base = {
  table: "orders",
  where: "",
  orderBy: null,
  direction: null,
  offset: 0,
  limit: GROUP_CHUNK + 1,
} as const;

describe("the rows of one group", () => {
  test("a value matches with =, under the current WHERE and sort", () => {
    expect(
      buildGroupRowsQuery({
        ...base,
        where: `"total" > 5`,
        orderBy: "total",
        direction: "DESC",
        column: "state",
        value: "paid",
        offset: 100,
      }),
    ).toBe(
      `SELECT * FROM "orders" WHERE (("total" > 5) AND "state" = 'paid') ORDER BY "total" DESC LIMIT 101 OFFSET 100`,
    );
  });

  test("NULL matches with IS NULL and wide integers keep every digit", () => {
    expect(buildGroupRowsQuery({ ...base, column: "state", value: null })).toBe(
      `SELECT * FROM "orders" WHERE ("state" IS NULL) LIMIT 101 OFFSET 0`,
    );
    expect(
      buildGroupRowsQuery({
        ...base,
        column: "id",
        value: { __type: "Number", value: "9007199254740993" },
      }),
    ).toContain(`"id" = 9007199254740993`);
  });

  test("a BLOB read only in part is refused, a whole one matches by its bytes", () => {
    const partial = { __type: "Blob", size: 4096, hex: "00ff", complete: false };
    expect(() => buildGroupRowsQuery({ ...base, column: "data", value: partial })).toThrow(
      SqlitePartialValueError,
    );
    const whole = { __type: "Blob", size: 2, hex: "00ff", complete: true };
    expect(buildGroupRowsQuery({ ...base, column: "data", value: whole })).toContain(
      `"data" = X'00ff'`,
    );
  });
});

describe("the sectioned rows", () => {
  const groups = groupsOf({
    rows: [
      ["paid", 120],
      [null, 3],
      ["", 1],
    ],
  });
  const child = (id: number) => ({ id: `pk:${id}`, cells: { id } });

  test("group keys tell NULL, numbers, text and wide integers apart", () => {
    expect(groups.map((group) => group.key)).toEqual(["s:paid", "null", "s:"]);
    expect(groupValueKey(1)).not.toBe(groupValueKey("1"));
    expect(groupValueKey({ __type: "Number", value: "9007199254740993" })).toBe(
      "n:9007199254740993",
    );
  });

  test("closed groups are headers alone; an open group lists its rows and what follows", () => {
    const children = new Map<string, SqliteGroupChildren>([
      ["s:paid", { rows: [child(1), child(2)], loading: false, error: null, hasMore: true }],
    ]);
    const rows = buildSectionRows({
      column: "state",
      groups,
      open: new Set(["s:paid", "null"]),
      children,
    });
    expect(rows.map((row) => row.id)).toEqual([
      "group:s:paid",
      "pk:1",
      "pk:2",
      "note:more:s:paid",
      "group:null",
      "note:reading:null",
      "group:s:",
    ]);
    expect(rows[0]?.section).toMatchObject({
      label: "state",
      value: "paid",
      count: 120,
      open: true,
    });
    expect(rows[3]?.note).toMatchObject({ text: "118 more", action: "Show 100 more" });
    expect(rows[5]?.note).toMatchObject({ busy: true });
    expect(rows[6]?.section).toMatchObject({ value: "", open: false });
  });

  test("an error offers to try again; notes name their group", () => {
    const rows = buildSectionRows({
      column: "state",
      groups: groups.slice(0, 1),
      open: new Set(["s:paid"]),
      children: new Map([
        ["s:paid", { rows: [], loading: false, error: "disk I/O error", hasMore: false }],
      ]),
    });
    expect(rows[1]?.note).toMatchObject({ tone: "error", action: "Try again" });
    expect(noteOf(rows[1]?.id ?? "")).toEqual({ key: "s:paid", kind: "retry" });
    expect(noteOf("note:more:s:a:more")).toEqual({ key: "s:a:more", kind: "more" });
    expect(noteOf("pk:1")).toBeNull();
  });

  test("rows of a table without a key get ids no other group shares", () => {
    const result = { columns: ["state"], rows: [["paid"], ["paid"]] };
    const first = groupChildRows(result, [column("state")], "s:paid", 0);
    const second = groupChildRows(result, [column("state")], "s:open", 0);
    const ids = [...first, ...second].map((row) => row.id);
    expect(new Set(ids).size).toBe(4);
    const keyed = groupChildRows(
      { columns: ["id", "state"], rows: [[7, "paid"]] },
      [column("id", 1), column("state")],
      "s:paid",
      0,
    );
    expect(keyed[0]?.id).not.toContain("s:paid");
  });
});
