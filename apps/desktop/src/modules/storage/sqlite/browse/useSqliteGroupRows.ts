import { computed, nextTick, shallowRef, watch, type Ref } from "vue";
import { useQueries, useQueryClient, type QueryKey } from "@tanstack/vue-query";
import type { GridRow } from "@/shared/components/data/grid";
import { useSqliteOpenGroupsStore } from "@/modules/storage/stores/useSqliteOpenGroupsStore";
import type { SqliteColumnInfo, SqliteQueryResult } from "@/types/sqlite.types";
import type { SqliteAddress } from "../sqliteAddress";
import { runQuery } from "../sqliteReads";
import {
  GROUP_CHUNK,
  buildSectionRows,
  groupChildRows,
  groupsOf,
  noteOf,
  sectionRowId,
  type SqliteGroup,
  type SqliteGroupChildren,
} from "./sqliteGroupSections";
import { buildGroupRowsQuery } from "./sqliteQuery";
import type { SqliteRowOrder } from "./sqliteRowOrder";
import { sqliteQueryRoot } from "./useSqliteRows";
import type { SqliteTableQuery } from "./useSqliteTableQuery";

/** Groups "Open all" opens at most. */
export const OPEN_ALL_LIMIT = 50;

interface ChunkPage {
  result: SqliteQueryResult;
  hasMore: boolean;
}

interface PlannedChunk {
  key: string;
  index: number;
}

/**
 * The grouped view of a table as sections: each group of the page on screen is a header, and
 * an open group reads its rows (under the same search, filters and sort) 100 at a time. Read
 * rows stay cached while their group is open, are dropped when it closes or the grouping
 * changes, and are read again with everything else on "Read again". Open groups are kept per
 * table, by value.
 */
export function useSqliteGroupRows(options: {
  address: Ref<SqliteAddress | null>;
  table: Ref<string>;
  query: SqliteTableQuery;
  rowOrder: Ref<SqliteRowOrder>;
  columnInfo: Ref<readonly SqliteColumnInfo[]>;
  /** The page of groups: `[value, count]` rows. */
  groupPage: Ref<SqliteQueryResult | null>;
  /** What the open groups are kept under: the database's state key and the table. */
  stateKey: Ref<string>;
  active?: Ref<boolean>;
}) {
  const { address, table, query } = options;
  const store = useSqliteOpenGroupsStore();
  const client = useQueryClient();

  const column = computed(() => query.groupBy.value);
  const groups = computed<SqliteGroup[]>(() =>
    column.value ? groupsOf(options.groupPage.value) : [],
  );
  const openKeys = computed(() =>
    column.value ? store.openKeys(options.stateKey.value, column.value) : new Set<string>(),
  );

  /** Chunks asked for per open group; a group not listed reads its first chunk. */
  const chunks = shallowRef<ReadonlyMap<string, number>>(new Map());

  function groupKeyRoot(groupColumn: string, key?: string): QueryKey {
    return [
      ...sqliteQueryRoot(address.value),
      "group-rows",
      table.value,
      groupColumn,
      ...(key === undefined ? [] : [key]),
    ];
  }

  const shape = computed(() =>
    JSON.stringify([
      table.value,
      column.value,
      query.effectiveWhere.value,
      query.orderBy.value,
      query.orderDir.value,
    ]),
  );
  watch(shape, () => (chunks.value = new Map()));

  watch([table, column], ([nextTable, nextColumn], [previousTable, previousColumn]) => {
    if (!previousColumn || (previousColumn === nextColumn && previousTable === nextTable)) return;
    const stale = [...sqliteQueryRoot(address.value), "group-rows", previousTable, previousColumn];
    void nextTick(() => client.removeQueries({ queryKey: stale }));
  });

  const plan = computed<PlannedChunk[]>(() => {
    const open = openKeys.value;
    return groups.value
      .filter((group) => open.has(group.key))
      .flatMap((group) =>
        Array.from({ length: chunks.value.get(group.key) ?? 1 }, (_, index) => ({
          key: group.key,
          index,
        })),
      );
  });

  const byKey = computed(() => new Map(groups.value.map((group) => [group.key, group])));

  const results = useQueries({
    queries: computed(() =>
      plan.value.map((chunk) => {
        const groupColumn = column.value ?? "";
        const value = byKey.value.get(chunk.key)?.value;
        const where = query.effectiveWhere.value;
        const orderBy = query.orderBy.value;
        const direction = query.orderDir.value;
        const rowOrder = options.rowOrder.value;
        return {
          queryKey: [
            ...groupKeyRoot(groupColumn, chunk.key),
            where,
            orderBy,
            direction,
            rowOrder,
            chunk.index,
          ],
          enabled: address.value !== null && options.active?.value !== false,
          staleTime: Infinity,
          gcTime: 15_000,
          retry: false,
          queryFn: async (): Promise<ChunkPage> => {
            const current = address.value;
            if (!current) throw new Error("No database is open");
            const result = await runQuery(
              current,
              buildGroupRowsQuery({
                table: table.value,
                where,
                orderBy,
                direction,
                rowOrder,
                column: groupColumn,
                value,
                offset: chunk.index * GROUP_CHUNK,
                limit: GROUP_CHUNK + 1,
              }),
            );
            const hasMore = result.rows.length > GROUP_CHUNK;
            const rows = hasMore ? result.rows.slice(0, GROUP_CHUNK) : result.rows;
            return { result: { ...result, rows, rowCount: rows.length }, hasMore };
          },
        };
      }),
    ),
  });

  /** Each open group's read rows, in order, up to the first chunk still read or failed. */
  const children = computed(() => {
    const map = new Map<string, SqliteGroupChildren>();
    const info = options.columnInfo.value;
    plan.value.forEach((chunk, position) => {
      const state = results.value[position];
      const entry = map.get(chunk.key) ?? { rows: [], loading: false, error: null, hasMore: false };
      if (entry.loading || entry.error) return;
      if (!state || state.isPending) {
        map.set(chunk.key, { ...entry, loading: true });
        return;
      }
      if (state.isError) {
        const failure = state.error;
        map.set(chunk.key, {
          ...entry,
          error: failure instanceof Error ? failure.message : String(failure),
        });
        return;
      }
      const page = state.data;
      map.set(chunk.key, {
        rows: [
          ...entry.rows,
          ...groupChildRows(page.result, info, chunk.key, chunk.index * GROUP_CHUNK),
        ],
        loading: false,
        error: null,
        hasMore: page.hasMore,
      });
    });
    return map;
  });

  const rows = computed<GridRow[]>(() =>
    column.value
      ? buildSectionRows({
          column: column.value,
          groups: groups.value,
          open: openKeys.value,
          children: children.value,
        })
      : [],
  );

  /** The rows that hold data, in display order, for the record pane. */
  const dataRows = computed(() => rows.value.filter((row) => !row.section && !row.note));

  /** Columns of the read rows, for a table whose column list is not known yet. */
  const readColumns = computed(() => {
    const first = results.value.find((state) => state.data);
    return first?.data?.result.columns ?? null;
  });

  const sectionIds = computed(
    () => new Map(groups.value.map((group) => [sectionRowId(group.key), group])),
  );

  /** The group a section header row stands for. */
  function groupOf(rowId: string | null): SqliteGroup | null {
    return rowId ? (sectionIds.value.get(rowId) ?? null) : null;
  }

  function setOpen(keys: readonly string[], open: boolean) {
    const groupColumn = column.value;
    if (!groupColumn || keys.length === 0) return;
    store.setOpen(options.stateKey.value, groupColumn, keys, open);
    if (open) return;
    const next = new Map(chunks.value);
    for (const key of keys) next.delete(key);
    chunks.value = next;
    void nextTick(() => {
      for (const key of keys) client.removeQueries({ queryKey: groupKeyRoot(groupColumn, key) });
    });
  }

  function toggle(rowId: string, open: boolean) {
    const group = groupOf(rowId);
    if (group) setOpen([group.key], open);
  }

  /** Runs a note's action: the next 100 rows, or reading a failed group again. */
  function noteAction(rowId: string) {
    const note = noteOf(rowId);
    const groupColumn = column.value;
    if (!note || !groupColumn) return;
    if (note.kind === "more") {
      const next = new Map(chunks.value);
      next.set(note.key, (next.get(note.key) ?? 1) + 1);
      chunks.value = next;
      return;
    }
    void client.refetchQueries({ queryKey: groupKeyRoot(groupColumn, note.key) });
  }

  /**
   * Opens the groups of the page on screen, at most `OPEN_ALL_LIMIT` of them, so one click never
   * starts hundreds of reads at once.
   */
  function openAll() {
    setOpen(
      groups.value.slice(0, OPEN_ALL_LIMIT).map((group) => group.key),
      true,
    );
  }

  function closeAll() {
    const groupColumn = column.value;
    if (!groupColumn) return;
    const keys = [...openKeys.value];
    store.closeAll(options.stateKey.value, groupColumn);
    chunks.value = new Map();
    void nextTick(() => {
      for (const key of keys) client.removeQueries({ queryKey: groupKeyRoot(groupColumn, key) });
    });
  }

  return {
    rows,
    dataRows,
    readColumns,
    openCount: computed(() => groups.value.filter((group) => openKeys.value.has(group.key)).length),
    groupCount: computed(() => groups.value.length),
    groupOf,
    toggle,
    noteAction,
    openAll,
    closeAll,
  };
}

export type SqliteGroupRows = ReturnType<typeof useSqliteGroupRows>;
