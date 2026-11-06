import { inlineEditRefusal } from "@/shared/components/data/grid/editors/cellEdit";
import { quoteIdent, sqlLiteral, isSqliteBlob, isWideInteger } from "../sqlText";

/** Cell edits of one existing row, kept until saved: the row as read, and the new values. */
export interface StagedRowEdit {
  rowId: string;
  original: Readonly<Record<string, unknown>>;
  values: Readonly<Record<string, unknown>>;
}

/** A row to add, with the values set so far (unset columns take their defaults). */
export interface StagedRowInsert {
  id: string;
  values: Readonly<Record<string, unknown>>;
}

export interface SqliteStaged {
  edits: ReadonlyMap<string, StagedRowEdit>;
  inserts: readonly StagedRowInsert[];
}

export const EMPTY_STAGED: SqliteStaged = { edits: new Map(), inserts: [] };

export const NEW_ROW_PREFIX = "new:";

function sameValue(left: unknown, right: unknown): boolean {
  try {
    return sqlLiteral(left) === sqlLiteral(right);
  } catch {
    return false;
  }
}

/**
 * Why a cell cannot be edited inline, or `null`. A BLOB or an integer wider than a JavaScript
 * number would come back from a text field as something else, so they are left as they are.
 */
export function uneditableReason(value: unknown): string | null {
  if (isSqliteBlob(value)) return "A BLOB cannot be edited here.";
  if (isWideInteger(value)) {
    return "This integer is wider than the editor can hold without rounding it.";
  }
  if (typeof value === "object" && value !== null) return "This value cannot be edited here.";
  return inlineEditRefusal(value);
}

/** Stages one cell of an existing row; setting a cell back to what was read unstages it. */
export function stageCell(
  staged: SqliteStaged,
  row: { id: string; cells: Readonly<Record<string, unknown>> },
  column: string,
  value: unknown,
): SqliteStaged {
  const current = staged.edits.get(row.id);
  const original = current?.original ?? row.cells;
  const values = { ...current?.values };
  if (sameValue(original[column], value)) delete values[column];
  else values[column] = value;
  const edits = new Map(staged.edits);
  if (Object.keys(values).length === 0) edits.delete(row.id);
  else edits.set(row.id, { rowId: row.id, original, values });
  return { ...staged, edits };
}

export function addInsert(staged: SqliteStaged, id: string): SqliteStaged {
  return { ...staged, inserts: [{ id, values: {} }, ...staged.inserts] };
}

export function stageInsertCell(
  staged: SqliteStaged,
  id: string,
  column: string,
  value: unknown,
): SqliteStaged {
  return {
    ...staged,
    inserts: staged.inserts.map((insert) =>
      insert.id === id ? { ...insert, values: { ...insert.values, [column]: value } } : insert,
    ),
  };
}

export function removeInserts(staged: SqliteStaged, ids: ReadonlySet<string>): SqliteStaged {
  return { ...staged, inserts: staged.inserts.filter((insert) => !ids.has(insert.id)) };
}

export function stagedCount(staged: SqliteStaged): number {
  return staged.edits.size + staged.inserts.length;
}

/** `"a" IS 1 AND "b" IS 'x'`: the row as it was read, by its primary key (NULL-safe). */
export function keyCondition(
  keyColumns: readonly string[],
  record: Readonly<Record<string, unknown>>,
): string {
  if (keyColumns.length === 0) throw new Error("The table has no primary key.");
  return keyColumns
    .map((column) => `${quoteIdent(column)} IS ${sqlLiteral(record[column])}`)
    .join(" AND ");
}

/**
 * The statements that save a changeset: one `UPDATE` per edited row, found by the key it had
 * when it was read (so editing the key itself still reaches the same row), then one `INSERT`
 * per new row. Every value goes through `sqlLiteral`, so it reads back as written.
 */
export function changesetStatements(
  table: string,
  keyColumns: readonly string[],
  staged: SqliteStaged,
): string[] {
  const name = quoteIdent(table);
  const updates = [...staged.edits.values()].map((edit) => {
    const sets = Object.entries(edit.values)
      .map(([column, value]) => `${quoteIdent(column)} = ${sqlLiteral(value)}`)
      .join(", ");
    return `UPDATE ${name} SET ${sets} WHERE ${keyCondition(keyColumns, edit.original)}`;
  });
  const inserts = [...staged.inserts].reverse().map((insert) => {
    const entries = Object.entries(insert.values);
    if (entries.length === 0) return `INSERT INTO ${name} DEFAULT VALUES`;
    const columns = entries.map(([column]) => quoteIdent(column)).join(", ");
    const values = entries.map(([, value]) => sqlLiteral(value)).join(", ");
    return `INSERT INTO ${name} (${columns}) VALUES (${values})`;
  });
  return [...updates, ...inserts];
}

/** One saved value that the database holds differently (a trigger, a type affinity). */
export interface ReadBackDifference {
  column: string;
  wrote: string;
  reads: string;
}

/** The saved values that read back as something else; empty when every one matches. */
export function readBackDifferences(
  wrote: Readonly<Record<string, unknown>>,
  read: Readonly<Record<string, unknown>> | null,
): ReadBackDifference[] {
  if (!read) {
    return [{ column: "(row)", wrote: "a row", reads: "no row with that key" }];
  }
  return Object.entries(wrote).flatMap(([column, value]) => {
    const wroteText = sqlLiteral(value);
    let readsText: string;
    try {
      readsText = sqlLiteral(read[column]);
    } catch {
      return [];
    }
    return wroteText === readsText ? [] : [{ column, wrote: wroteText, reads: readsText }];
  });
}

/** Where an edited row is after the save: its key with any edited key column applied. */
export function savedKey(edit: StagedRowEdit): Record<string, unknown> {
  return { ...edit.original, ...edit.values };
}
