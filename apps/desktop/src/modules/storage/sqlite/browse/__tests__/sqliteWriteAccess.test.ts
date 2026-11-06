import { describe, expect, it } from "vite-plus/test";
import { canWriteDatabase, sqliteReadOnlyReason } from "../sqliteWriteAccess";

describe("canWriteDatabase", () => {
  it("allows changes only on a database that is itself an opened file", () => {
    expect(canWriteDatabase({ sourceKind: "imported" })).toBe(true);
  });

  it("never allows a phone database, whatever else is open", () => {
    for (const sourceKind of ["native-android", "opfs", "jeep-sqlite", undefined] as const) {
      expect(canWriteDatabase({ sourceKind })).toBe(false);
    }
  });

  it("explains why a phone database is read-only", () => {
    expect(sqliteReadOnlyReason({ sourceKind: "opfs" })).toMatch(/read-only/);
    expect(sqliteReadOnlyReason({ sourceKind: "native-android" })).toMatch(/phone/);
    expect(sqliteReadOnlyReason(null)).not.toBeNull();
  });
});
