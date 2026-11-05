import { describe, expect, test } from "vite-plus/test";
import { exportLoss, IdbRecordTooLargeError, planImportChunks, V1_LOSS } from "../idbImportPlan";
import type { IdbExportedDatabase } from "../idbTransfer.types";

function data(records: Array<{ key: unknown; value: unknown }>): IdbExportedDatabase {
  return {
    format: "capubridge-idb-export",
    version: 2,
    exportedAt: "2026-11-05T00:00:00.000Z",
    origin: "https://app",
    database: {
      name: "shop",
      version: 1,
      stores: [{ name: "orders", keyPath: null, autoIncrement: false, indexes: [], records }],
    },
  };
}

describe("exportLoss (S2)", () => {
  test("lists every lossy value with its store, record and field", () => {
    const loss = exportLoss(
      data([
        { key: 1, value: { a: { __type: "Unsupported", kind: "Foo" }, ok: true } },
        { key: "x", value: { list: [{ __type: "Circular" }], blob: { __type: "Blob", size: 3 } } },
        { key: 3, value: { fine: { __type: "Date", value: "2026-01-01T00:00:00.000Z" } } },
      ]),
    );
    expect(loss).toEqual([
      'orders · record 1: "a" is a kind of value that cannot be saved; it is written as empty (null)',
      'orders · record "x": "list[0]" refers back to itself; it is written as empty (null)',
      'orders · record "x": "blob" is Blob data that was not saved; it is written empty',
    ]);
  });

  test("a version 1 file says what it lost in general", () => {
    expect(exportLoss({ ...data([]), version: 1 })).toEqual([V1_LOSS]);
  });
});

describe("planImportChunks (S3)", () => {
  test("chunks are capped by size, not by count", () => {
    const records = Array.from({ length: 10 }, (_, key) => ({ key, value: "x".repeat(300) }));
    const chunks = [...planImportChunks(records, { maxBytes: 1000 })];
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.bytes).toBeLessThanOrEqual(1000);
    expect(chunks.flatMap((chunk) => chunk.records)).toHaveLength(10);
  });

  test("a large binary value goes ahead in pieces and the file is not changed", () => {
    const base64 = "QUJD".repeat(200_000);
    const record = { key: 1, value: { photo: { __type: "Blob", size: 600_000, base64 } } };
    const [chunk] = [...planImportChunks([record], { maxBytes: 4096 })];
    expect(chunk?.binaries).toHaveLength(1);
    expect(chunk?.binaries[0]?.pieces.join("")).toBe(base64);
    for (const piece of chunk?.binaries[0]?.pieces ?? []) expect(piece.length % 4).toBe(0);
    expect(chunk?.records[0]?.value).toEqual({
      photo: { __type: "Blob", size: 600_000, staged: chunk?.binaries[0]?.id },
    });
    expect(record.value.photo.base64).toBe(base64);
  });

  test("a record too large even without its binary data is refused up front", () => {
    const record = { key: 1, value: "y".repeat(5000) };
    expect(() => [...planImportChunks([record], { maxBytes: 1000 })]).toThrow(
      IdbRecordTooLargeError,
    );
  });
});
