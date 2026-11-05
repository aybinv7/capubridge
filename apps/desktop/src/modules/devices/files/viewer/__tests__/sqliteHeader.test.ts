import { describe, expect, test } from "vite-plus/test";
import { appDatabaseFromPath, parseSqliteHeader } from "../sqliteHeader";

function header(options: {
  pageSize: number;
  pages: number;
  changeCounter: number;
  validFor: number;
  encoding: number;
  wal: boolean;
  userVersion: number;
}): Uint8Array {
  const bytes = new Uint8Array(100);
  bytes.set(new TextEncoder().encode("SQLite format 3\0"));
  const view = new DataView(bytes.buffer);
  view.setUint16(16, options.pageSize === 65536 ? 1 : options.pageSize);
  bytes[18] = options.wal ? 2 : 1;
  bytes[19] = options.wal ? 2 : 1;
  view.setUint32(24, options.changeCounter);
  view.setUint32(28, options.pages);
  view.setUint32(56, options.encoding);
  view.setUint32(60, options.userVersion);
  view.setUint32(92, options.validFor);
  return bytes;
}

describe("parseSqliteHeader", () => {
  test("reads page size, pages, encoding, journal and user version", () => {
    const facts = parseSqliteHeader(
      header({
        pageSize: 4096,
        pages: 12,
        changeCounter: 7,
        validFor: 7,
        encoding: 1,
        wal: true,
        userVersion: 3,
      }),
      4096 * 12,
    );
    expect(facts).toEqual({
      pageSize: 4096,
      pageCount: 12,
      encoding: "UTF-8",
      journal: "Write-ahead log",
      userVersion: 3,
    });
  });

  test("derives the page count from the size when the header count is stale", () => {
    const facts = parseSqliteHeader(
      header({
        pageSize: 65536,
        pages: 99,
        changeCounter: 8,
        validFor: 7,
        encoding: 2,
        wal: false,
        userVersion: 0,
      }),
      65536 * 3,
    );
    expect(facts?.pageSize).toBe(65536);
    expect(facts?.pageCount).toBe(3);
    expect(facts?.encoding).toBe("UTF-16le");
    expect(facts?.journal).toBe("Rollback journal");
  });

  test("gives up on a short or nonsensical header", () => {
    expect(parseSqliteHeader(new Uint8Array(40), 0)).toBeNull();
    expect(parseSqliteHeader(new Uint8Array(100), 0)).toBeNull();
  });
});

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
