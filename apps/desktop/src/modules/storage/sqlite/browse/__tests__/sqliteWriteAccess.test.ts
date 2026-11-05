import { describe, expect, it } from "vite-plus/test";
import { canWriteDatabase, sqliteReadOnlyReason } from "../sqliteWriteAccess";

describe("canWriteDatabase", () => {
  it("allows changes only on a database that is itself an imported file", () => {
    expect(canWriteDatabase({ sourceKind: "imported" })).toBe(true);
  });

  it("never allows a device database, whatever else is open", () => {
    for (const sourceKind of ["native-android", "opfs", "jeep-sqlite", undefined] as const) {
      expect(canWriteDatabase({ sourceKind })).toBe(false);
    }
  });

  it("explains why a device database is read-only", () => {
    expect(
      sqliteReadOnlyReason(null, { name: "a", path: "/a", size: 0, sourceKind: "opfs" }),
    ).not.toBeNull();
  });
});
