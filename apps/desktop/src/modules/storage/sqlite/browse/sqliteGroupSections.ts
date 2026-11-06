import type { GridRow } from "@/shared/components/data/grid";
import type { SqliteColumnInfo, SqliteQueryResult } from "@/types/sqlite.types";
import { isSqliteBlob, isWideInteger } from "../sqlText";
import { toGridRows } from "./sqliteGrid";

/** Rows read at a time when a group opens, and again for each "Show more". */
export const GROUP_CHUNK = 100;

/** One distinct value of the grouped column, with how many rows hold it. */
export interface SqliteGroup {
  key: string;
  value: unknown;
  count: number | null;
}

/** What is read of one open group so far. */
export interface SqliteGroupChildren {
  rows: readonly GridRow[];
  /** A chunk of its rows is being read. */
  loading: boolean;
  error: string | null;
  /** More rows follow the ones read. */
  hasMore: boolean;
}

/**
 * A stable key for a group's value, the same across reads: NULL, numbers (wide integers by
 * their digits), text and BLOBs never collide with one another.
 */
export function groupValueKey(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "bigint") return `n:${String(value)}`;
  if (typeof value === "boolean") return `n:${value ? 1 : 0}`;
  if (isWideInteger(value)) return `n:${value.value}`;
  if (typeof value === "string") return `s:${value}`;
  if (isSqliteBlob(value)) return `b:${value.size}:${value.hex}${value.complete ? "" : "…"}`;
  return `j:${JSON.stringify(value)}`;
}

/** The groups of a grouped page: `[value, count]` rows, in the order the database gave. */
export function groupsOf(result: Pick<SqliteQueryResult, "rows"> | null): SqliteGroup[] {
  if (!result) return [];
  return result.rows.map((row) => {
    const value = row[0];
    const count = row[1];
    return { key: groupValueKey(value), value, count: typeof count === "number" ? count : null };
  });
}

export function sectionRowId(key: string): string {
  return `group:${key}`;
}

const NOTE_MORE = "note:more:";
const NOTE_ERROR = "note:error:";

/** Which group a note row belongs to and what it asks for, or `null` for another row. */
export function noteOf(rowId: string): { key: string; kind: "more" | "retry" } | null {
  if (rowId.startsWith(NOTE_MORE)) return { key: rowId.slice(NOTE_MORE.length), kind: "more" };
  if (rowId.startsWith(NOTE_ERROR)) return { key: rowId.slice(NOTE_ERROR.length), kind: "retry" };
  return null;
}

/**
 * One chunk of a group's rows as grid rows. Rows keep their primary-key ids, so change overlays
 * and the record pane find them; a table without a key numbers them inside their group, so two
 * groups never share an id.
 */
export function groupChildRows(
  result: Pick<SqliteQueryResult, "columns" | "rows">,
  info: readonly SqliteColumnInfo[],
  key: string,
  offset: number,
): GridRow[] {
  const mapped = toGridRows(result, info, offset);
  if (mapped.identified) return mapped.rows;
  return mapped.rows.map((row, index) => ({ ...row, id: `row:${offset + index}:${key}` }));
}

function note(id: string, text: string, extra: Omit<NonNullable<GridRow["note"]>, "text"> = {}) {
  return { id, cells: {}, note: { text, depth: 1, ...extra } };
}

function childLines(group: SqliteGroup, children: SqliteGroupChildren | undefined): GridRow[] {
  if (!children || (children.rows.length === 0 && children.loading)) {
    return [note(`note:reading:${group.key}`, "Reading rows…", { busy: true })];
  }
  const lines: GridRow[] = [...children.rows];
  if (children.error) {
    lines.push(
      note(`${NOTE_ERROR}${group.key}`, `Could not read these rows: ${children.error}`, {
        tone: "error",
        action: "Try again",
      }),
    );
  } else if (children.rows.length === 0) {
    lines.push(
      note(`note:none:${group.key}`, "No rows hold this value any more. Read again to update."),
    );
  } else if (children.loading) {
    lines.push(note(`${NOTE_MORE}${group.key}`, "Reading more rows…", { busy: true }));
  } else if (children.hasMore) {
    const left = group.count === null ? null : group.count - children.rows.length;
    const next = left !== null && left > 0 ? Math.min(GROUP_CHUNK, left) : GROUP_CHUNK;
    lines.push(
      note(
        `${NOTE_MORE}${group.key}`,
        left !== null && left > 0 ? `${left.toLocaleString("en-US")} more` : "More rows",
        { action: `Show ${next} more` },
      ),
    );
  }
  return lines;
}

/**
 * The grouped grid: each group as a section header, followed by the rows read of it while it
 * is open, then a note for a read in progress, an error or the rows that follow.
 */
export function buildSectionRows(options: {
  column: string;
  groups: readonly SqliteGroup[];
  open: ReadonlySet<string>;
  children: ReadonlyMap<string, SqliteGroupChildren>;
}): GridRow[] {
  const rows: GridRow[] = [];
  for (const group of options.groups) {
    const open = options.open.has(group.key);
    rows.push({
      id: sectionRowId(group.key),
      cells: {},
      section: {
        key: group.key,
        label: options.column,
        value: group.value,
        count: group.count,
        open,
        depth: 0,
      },
    });
    if (open) rows.push(...childLines(group, options.children.get(group.key)));
  }
  return rows;
}
