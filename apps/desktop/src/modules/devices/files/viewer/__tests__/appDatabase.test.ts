import { describe, expect, test } from "vite-plus/test";
import { appDatabaseFromPath } from "../appDatabase";

describe("appDatabaseFromPath", () => {
  test("recognises an app's own databases folder", () => {
    expect(appDatabaseFromPath("/data/data/com.shop.app/databases/shopSQLite.db")).toEqual({
      packageName: "com.shop.app",
      fileName: "shopSQLite.db",
    });
    expect(appDatabaseFromPath("/data/user/0/com.shop.app/databases/a.db")?.packageName).toBe(
      "com.shop.app",
    );
  });

  test("ignores databases anywhere else", () => {
    expect(appDatabaseFromPath("/sdcard/Download/a.db")).toBeNull();
    expect(appDatabaseFromPath("/data/data/com.shop.app/files/a.db")).toBeNull();
    expect(appDatabaseFromPath("/data/data/com.shop.app/databases/nested/a.db")).toBeNull();
  });
});
