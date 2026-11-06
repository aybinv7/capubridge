import type { Ref } from "vue";
import { toast } from "vue-sonner";
import { buildRowKeyFromNames } from "@/modules/storage/changes/sqliteRowKey";
import type { RowTarget } from "../quick/sqliteKeyInput";
import type { SqliteAddress } from "../sqliteAddress";
import { runQuery } from "../sqliteReads";
import { predicate } from "./sqliteQuery";
import { recordKeyLabel } from "./sqliteRecordTitle";
import { locateRow } from "./sqliteRowLocate";
import type { SqliteRowOrder } from "./sqliteRowOrder";
import type { SqliteTableQuery } from "./useSqliteTableQuery";

/** Where the grid should land once the page is read: a row by its id, or by its place. */
export type SqliteRowReveal = { rowId: string } | { index: number };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Go to a row of the open table: by its key, by any condition (a link from another table), or
 * by its number. The row is found under the current order and filters (one query), its page is
 * read, and the grid lands on it. A row the filters hide offers to clear them and go.
 */
export function useSqliteGoToRow(options: {
  address: Ref<SqliteAddress | null>;
  table: Ref<string>;
  query: SqliteTableQuery;
  rowOrder: Ref<SqliteRowOrder>;
  keyColumns: Ref<readonly string[]>;
  reveal: (target: SqliteRowReveal) => void;
}) {
  const { query } = options;

  function landAt(position: number, target: SqliteRowReveal) {
    const size = query.pageSize.value;
    if (query.groupBy.value) query.setGroupBy(null);
    query.page.value = Math.floor(position / size);
    options.reveal(target);
  }

  /** Goes to the first row matching `match` (SQL); `label` names it in messages. */
  async function goToMatch(match: string, label: string): Promise<void> {
    const address = options.address.value;
    if (!address) return;
    const keys = options.keyColumns.value;
    try {
      if (query.groupBy.value) query.setGroupBy(null);
      const found = await locateRow((sql) => runQuery(address, sql), {
        table: options.table.value,
        where: query.effectiveWhere.value,
        orderBy: query.orderBy.value,
        direction: query.orderDir.value,
        rowOrder: options.rowOrder.value,
        match,
        keyColumns: keys,
      });
      if (found.status === "found") {
        const rowId = keys.length ? buildRowKeyFromNames([...keys], found.key) : "";
        landAt(
          found.position,
          rowId ? { rowId } : { index: found.position % query.pageSize.value },
        );
      } else if (found.status === "hidden") {
        toast.info(`The row with ${label} is hidden by the filters`, {
          action: {
            label: "Clear them and go",
            onClick: () => {
              query.clearFilters();
              void goToMatch(match, label);
            },
          },
        });
      } else if (found.status === "missing") {
        toast.info(`No row of “${options.table.value}” has ${label}`);
      } else {
        toast.info("Cannot go to that row", { description: found.reason });
      }
    } catch (error) {
      toast.error("Could not find the row", { description: describe(error) });
    }
  }

  /** Goes to a row by its key (in key order) or by its number in the current order. */
  async function goTo(target: RowTarget): Promise<void> {
    if (target.kind === "number") {
      landAt(target.row - 1, { index: (target.row - 1) % query.pageSize.value });
      return;
    }
    const keys = options.keyColumns.value;
    if (keys.length !== target.values.length) return;
    let match: string;
    try {
      match = keys
        .map((column, index) => predicate(column, "=", target.values[index]))
        .join(" AND ");
    } catch (error) {
      toast.error("Cannot look for that key", { description: describe(error) });
      return;
    }
    const label =
      recordKeyLabel(
        keys,
        Object.fromEntries(keys.map((column, at) => [column, target.values[at]])),
      ) ?? "that key";
    await goToMatch(match, label);
  }

  return { goTo, goToMatch };
}
