import type { SqliteQueryResult } from "@/types/sqlite.types";
import { quoteIdent, sqlLiteral } from "../sqlText";
import {
  keyCondition,
  readBackDifferences,
  savedKey,
  type ReadBackDifference,
  type SqliteStaged,
} from "./sqliteChangeset";

const MAX_READ_BACK = 200;
const BATCH = 100;
const ROWID_COLUMN = "__capubridge_rowid";

type RunQuery = (sql: string) => Promise<SqliteQueryResult>;
type Row = Record<string, unknown>;

function records(result: SqliteQueryResult): Row[] {
  return result.rows.map((values) => {
    const record: Row = {};
    result.columns.forEach((column, index) => (record[column] = values[index]));
    return record;
  });
}

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) out.push(items.slice(i, i + BATCH));
  return out;
}

function keyText(keyColumns: readonly string[], row: Readonly<Row>): string | null {
  try {
    return keyColumns.map((column) => sqlLiteral(row[column])).join(",");
  } catch {
    return null;
  }
}

/** What a saved changeset reads back as: each row as now stored, and what differs from it. */
export interface SqliteReadBack {
  edited: Array<{ rowId: string; row: Row | null }>;
  inserted: Array<{ id: string; row: Row | null }>;
  differences: Array<ReadBackDifference & { row: string }>;
  /** Rows that were saved but not read back (past the cap, or a table without rowid). */
  unchecked: number;
}

/**
 * Reads every saved row back from the file, by its key after the save (or by the rowid an
 * insert was given), and lists the values the database holds differently from what was
 * written: a trigger, a type affinity or a default changed them. A deleted row must be gone.
 * Rows are read 100 per query (P6); a row the batch cannot match to its key (a key the file
 * stores in another type) is read on its own, as before.
 */
export async function readBackChangeset(
  run: RunQuery,
  table: string,
  keyColumns: readonly string[],
  staged: SqliteStaged,
  insertedRowIds: readonly (number | null)[],
): Promise<SqliteReadBack> {
  const result: SqliteReadBack = { edited: [], inserted: [], differences: [], unchecked: 0 };
  const name = quoteIdent(table);
  let budget = MAX_READ_BACK;

  function take<T>(items: readonly T[]): T[] {
    const taken = items.slice(0, Math.max(budget, 0));
    result.unchecked += items.length - taken.length;
    budget -= taken.length;
    return taken;
  }

  async function oneRow(where: string): Promise<Row | null> {
    return records(await run(`SELECT * FROM ${name} WHERE ${where} LIMIT 1`))[0] ?? null;
  }

  const edits = take([...staged.edits.values()]);
  for (const chunk of chunks(edits)) {
    const where = chunk.map((edit) => `(${keyCondition(keyColumns, savedKey(edit))})`);
    const byKey = new Map<string, Row>();
    for (const row of records(await run(`SELECT * FROM ${name} WHERE ${where.join(" OR ")}`))) {
      const key = keyText(keyColumns, row);
      if (key !== null && !byKey.has(key)) byKey.set(key, row);
    }
    for (const edit of chunk) {
      const expected = keyText(keyColumns, savedKey(edit));
      const row =
        (expected !== null ? byKey.get(expected) : undefined) ??
        (await oneRow(keyCondition(keyColumns, savedKey(edit))));
      result.edited.push({ rowId: edit.rowId, row });
      for (const difference of readBackDifferences(edit.values, row)) {
        result.differences.push({ ...difference, row: edit.rowId });
      }
    }
  }

  const deletes = take([...staged.deletes]);
  for (const chunk of chunks(deletes)) {
    const where = chunk.map(([, row]) => `(${keyCondition(keyColumns, row)})`).join(" OR ");
    const left = records(await run(`SELECT 1 AS present FROM ${name} WHERE ${where} LIMIT 1`));
    if (left.length === 0) continue;
    for (const [rowId, row] of chunk) {
      const still = records(
        await run(
          `SELECT 1 AS present FROM ${name} WHERE ${keyCondition(keyColumns, row)} LIMIT 1`,
        ),
      );
      if (still.length > 0) {
        result.differences.push({
          column: "(row)",
          wrote: "deleted",
          reads: "still there",
          row: rowId,
        });
      }
    }
  }

  const rowIds = insertedRowIds.slice(insertedRowIds.length - staged.inserts.length);
  const known: Array<{ id: string; values: Readonly<Row>; rowId: number }> = [];
  [...staged.inserts].reverse().forEach((insert, index) => {
    const rowId = rowIds[index];
    if (rowId === null || rowId === undefined) result.unchecked += 1;
    else known.push({ id: insert.id, values: insert.values, rowId });
  });
  for (const chunk of chunks(take(known))) {
    let byRowId = new Map<number, Row>();
    try {
      const rows = records(
        await run(
          `SELECT rowid AS "${ROWID_COLUMN}", * FROM ${name} WHERE rowid IN (${chunk.map((entry) => entry.rowId).join(", ")})`,
        ),
      );
      byRowId = new Map(
        rows.flatMap((row) => {
          const { [ROWID_COLUMN]: rowId, ...rest } = row;
          return typeof rowId === "number" ? [[rowId, rest] as const] : [];
        }),
      );
    } catch {
      result.unchecked += chunk.length;
      continue;
    }
    for (const entry of chunk) {
      const row = byRowId.get(entry.rowId) ?? (await oneRow(`rowid = ${entry.rowId}`));
      result.inserted.push({ id: entry.id, row });
      for (const difference of readBackDifferences(entry.values, row)) {
        result.differences.push({ ...difference, row: `new row ${entry.rowId}` });
      }
    }
  }
  return result;
}
