import type { SqliteQueryResult } from "@/types/sqlite.types";
import { quoteIdent } from "../sqlText";
import {
  keyCondition,
  readBackDifferences,
  savedKey,
  type ReadBackDifference,
  type SqliteStaged,
} from "./sqliteChangeset";

const MAX_READ_BACK = 200;

type RunQuery = (sql: string) => Promise<SqliteQueryResult>;

function firstRecord(result: SqliteQueryResult): Record<string, unknown> | null {
  const values = result.rows[0];
  if (!values) return null;
  const record: Record<string, unknown> = {};
  result.columns.forEach((column, index) => (record[column] = values[index]));
  return record;
}

/** What a saved changeset reads back as: each row as now stored, and what differs from it. */
export interface SqliteReadBack {
  edited: Array<{ rowId: string; row: Record<string, unknown> | null }>;
  inserted: Array<{ id: string; row: Record<string, unknown> | null }>;
  differences: Array<ReadBackDifference & { row: string }>;
  /** Rows that were saved but not read back (past the cap, or a table without rowid). */
  unchecked: number;
}

/**
 * Reads every saved row back from the file, by its key after the save (or by the rowid an
 * insert was given), and lists the values the database holds differently from what was
 * written: a trigger, a type affinity or a default changed them. A deleted row must be gone.
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

  for (const edit of staged.edits.values()) {
    if (budget <= 0) {
      result.unchecked += 1;
      continue;
    }
    budget -= 1;
    const row = firstRecord(
      await run(`SELECT * FROM ${name} WHERE ${keyCondition(keyColumns, savedKey(edit))} LIMIT 1`),
    );
    result.edited.push({ rowId: edit.rowId, row });
    for (const difference of readBackDifferences(edit.values, row)) {
      result.differences.push({ ...difference, row: edit.rowId });
    }
  }

  for (const [rowId, row] of staged.deletes) {
    if (budget <= 0) {
      result.unchecked += 1;
      continue;
    }
    budget -= 1;
    const still = firstRecord(
      await run(`SELECT 1 AS present FROM ${name} WHERE ${keyCondition(keyColumns, row)} LIMIT 1`),
    );
    if (still) {
      result.differences.push({
        column: "(row)",
        wrote: "deleted",
        reads: "still there",
        row: rowId,
      });
    }
  }

  const rowIds = insertedRowIds.slice(insertedRowIds.length - staged.inserts.length);
  const inserts = [...staged.inserts].reverse();
  for (const [index, insert] of inserts.entries()) {
    const rowId = rowIds[index];
    if (budget <= 0 || rowId === null || rowId === undefined) {
      result.unchecked += 1;
      continue;
    }
    budget -= 1;
    let row: Record<string, unknown> | null;
    try {
      row = firstRecord(await run(`SELECT * FROM ${name} WHERE rowid = ${rowId} LIMIT 1`));
    } catch {
      result.unchecked += 1;
      continue;
    }
    result.inserted.push({ id: insert.id, row });
    for (const difference of readBackDifferences(insert.values, row)) {
      result.differences.push({ ...difference, row: `new row ${rowId}` });
    }
  }
  return result;
}
