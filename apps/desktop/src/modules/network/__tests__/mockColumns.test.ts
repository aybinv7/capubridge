import { describe, expect, test } from "vite-plus/test";
import { fitColumns } from "../columns/listColumns";
import {
  MOCK_LOG_COLUMNS,
  MOCK_RULE_COLUMNS,
  delayText,
  hitsText,
  matchText,
} from "../mock/mockColumns";

const EMPTY = { widths: {}, hidden: {} };
const ids = (columns: readonly { id: string }[]) => columns.map((column) => column.id);

describe("mock columns", () => {
  test("rules read one fact per column, the switch first and delete last", () => {
    expect(ids(MOCK_RULE_COLUMNS)).toEqual([
      "enabled",
      "method",
      "name",
      "match",
      "status",
      "delay",
      "hits",
      "actions",
    ]);
  });

  test("a narrow rules list keeps the switch, name, status and delete", () => {
    expect(ids(fitColumns(MOCK_RULE_COLUMNS, EMPTY, 300).shown)).toEqual([
      "enabled",
      "name",
      "status",
      "actions",
    ]);
  });

  test("a narrow log keeps time, status and the address", () => {
    expect(ids(fitColumns(MOCK_LOG_COLUMNS, EMPTY, 320).shown)).toEqual(["time", "status", "url"]);
  });

  test("empty values read as a dash, a rule without a pattern as every address", () => {
    expect(delayText(0)).toBe("—");
    expect(delayText(250)).toBe("250 ms");
    expect(hitsText(0)).toBe("—");
    expect(hitsText(1200)).toBe("1,200");
    expect(matchText({ urlPattern: "  " })).toEqual({ text: "Every address", every: true });
    expect(matchText({ urlPattern: "/api/users" })).toEqual({ text: "/api/users", every: false });
  });
});
