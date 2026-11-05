import { describe, expect, test } from "vite-plus/test";
import { hexRows } from "../hexDump";

describe("hexRows", () => {
  test("formats offset, hex with a middle gap, and printable ASCII", () => {
    const bytes = new TextEncoder().encode("SQLite format 3\0");
    const [row] = hexRows(bytes);
    expect(row?.offset).toBe("00000000");
    expect(row?.hex).toBe("53 51 4c 69 74 65 20 66  6f 72 6d 61 74 20 33 00");
    expect(row?.ascii).toBe("SQLite format 3.");
  });

  test("pads a short last row so columns stay aligned", () => {
    const rows = hexRows(new Uint8Array(18).fill(0x41));
    expect(rows).toHaveLength(2);
    expect(rows[1]?.offset).toBe("00000010");
    expect(rows[1]?.hex.length).toBe(rows[0]?.hex.length);
    expect(rows[1]?.ascii).toBe("AA");
  });

  test("has no rows for an empty file", () => {
    expect(hexRows(new Uint8Array())).toEqual([]);
  });
});
