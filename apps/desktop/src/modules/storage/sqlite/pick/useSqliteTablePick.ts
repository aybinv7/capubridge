import { computed, shallowRef } from "vue";
import type { SqliteTableInfo } from "@/types/sqlite.types";
import type { TableChange } from "../opfsSqliteQuestions";

/** The tables a bulk change may pick from, of one database. */
export interface TablePickRequest {
  database: string;
  tables: readonly SqliteTableInfo[];
}

/** What the person picked: the change and the tables, never empty. */
export interface TablePick {
  change: TableChange;
  tables: SqliteTableInfo[];
}

interface PendingPick {
  request: TablePickRequest;
  settle: (pick: TablePick | null) => void;
}

/**
 * One table picker at a time for the SQLite tab, answered like a confirmation: it resolves the
 * pick once the person confirms, `null` when they cancel, close it, or pick nothing.
 */
export function useSqliteTablePick() {
  const pending = shallowRef<PendingPick | null>(null);

  function settle(pick: TablePick | null) {
    const current = pending.value;
    pending.value = null;
    current?.settle(pick && pick.tables.length > 0 ? pick : null);
  }

  const open = computed({
    get: () => pending.value !== null,
    set: (value: boolean) => {
      if (!value) settle(null);
    },
  });
  const request = computed(() => pending.value?.request ?? null);

  function pickAsync(next: TablePickRequest): Promise<TablePick | null> {
    settle(null);
    return new Promise((resolve) => {
      pending.value = { request: next, settle: resolve };
    });
  }

  return { open, request, pickAsync, choose: settle };
}
