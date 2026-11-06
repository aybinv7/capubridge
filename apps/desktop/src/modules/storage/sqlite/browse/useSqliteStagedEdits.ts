import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from "vue";
import type {
  GridColumn,
  GridColumnType,
  GridEditingCell,
  GridRow,
  GridRowState,
} from "@/shared/components/data/grid";
import { editorKindFor, type CellEditorKind } from "@/shared/components/data/grid/editors/cellEdit";
import {
  EMPTY_STAGED,
  NEW_ROW_PREFIX,
  addInsert,
  removeInserts,
  stageCell,
  stageInsertCell,
  stagedCount,
  uneditableReason,
  type SqliteStaged,
} from "./sqliteChangeset";

const NOTE_MS = 4000;

interface StagedEditsInput {
  /** The rows of the page as read from the file. */
  rows: Ref<readonly GridRow[]>;
  columns: Ref<readonly GridColumn[]>;
  showAs: Ref<Readonly<Record<string, GridColumnType>>>;
  /** Only an opened file whose table has a primary key is edited. */
  writable: Ref<boolean>;
  save: (staged: SqliteStaged) => Promise<boolean>;
}

/**
 * Cell edits and new rows of one table, kept on screen until saved together: the grid shows
 * them over the rows as read, nothing reaches the file before Save, and Discard drops them.
 */
export function useSqliteStagedEdits(input: StagedEditsInput) {
  const staged = shallowRef<SqliteStaged>(EMPTY_STAGED);
  const editing = ref<GridEditingCell | null>(null);
  const saving = ref(false);
  const note = ref<string | null>(null);
  let noteTimer: ReturnType<typeof setTimeout> | null = null;
  let counter = 0;

  const pending = computed(() => stagedCount(staged.value));

  const blank = computed(() =>
    Object.fromEntries(input.columns.value.map((column) => [column.id, null])),
  );

  const rows = computed<GridRow[]>(() => {
    const edits = staged.value.edits;
    const added = staged.value.inserts.map((insert) => ({
      id: insert.id,
      cells: { ...blank.value, ...insert.values },
    }));
    const read = input.rows.value.map((row) => {
      const edit = edits.get(row.id);
      return edit ? { ...row, cells: { ...row.cells, ...edit.values } } : row;
    });
    return [...added, ...read];
  });

  const states = computed(() => {
    const map = new Map<string, GridRowState>();
    for (const insert of staged.value.inserts) map.set(insert.id, "staged-insert");
    for (const row of input.rows.value) {
      if (staged.value.edits.has(row.id)) map.set(row.id, "staged-edit");
    }
    return map;
  });

  function say(text: string) {
    note.value = text;
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note.value = null), NOTE_MS);
  }

  onBeforeUnmount(() => {
    if (noteTimer) clearTimeout(noteTimer);
  });

  function displayed(rowId: string): GridRow | undefined {
    return rows.value.find((row) => row.id === rowId);
  }

  function sampleOf(columnId: string): unknown {
    for (const row of input.rows.value) {
      const value = row.cells[columnId];
      if (value !== null && value !== undefined) return value;
    }
    return undefined;
  }

  /** The editor a cell opens with: by its value, else another value of its column, else its type. */
  function editorKind(columnId: string, value: unknown): CellEditorKind {
    const like = sampleOf(columnId);
    const known = editorKindFor(value, input.showAs.value[columnId], like);
    if (known && (value !== null || like !== undefined)) return known;
    const type = input.columns.value.find((column) => column.id === columnId)?.type;
    return type === "integer" || type === "real" ? "number" : (known ?? "text");
  }

  function startEdit(rowId: string, columnId: string) {
    if (!input.writable.value) return;
    const value = displayed(rowId)?.cells[columnId];
    const reason = uneditableReason(value);
    if (reason) {
      say(reason);
      return;
    }
    editing.value = { rowId, columnId };
  }

  function commit(value: unknown) {
    const target = editing.value;
    editing.value = null;
    if (!target) return;
    if (target.rowId.startsWith(NEW_ROW_PREFIX)) {
      staged.value = stageInsertCell(staged.value, target.rowId, target.columnId, value);
      return;
    }
    const row = input.rows.value.find((entry) => entry.id === target.rowId);
    if (row) staged.value = stageCell(staged.value, row, target.columnId, value);
  }

  function cancel() {
    editing.value = null;
  }

  /** Adds a new row at the top and opens its first column for typing. */
  function addRow(): string | null {
    if (!input.writable.value) return null;
    counter += 1;
    const id = `${NEW_ROW_PREFIX}${counter}`;
    staged.value = addInsert(staged.value, id);
    const first = input.columns.value[0];
    if (first) editing.value = { rowId: id, columnId: first.id };
    return id;
  }

  /** Drops new rows among `ids`; returns the ids of rows that are already in the file. */
  function dropNewRows(ids: readonly string[]): string[] {
    const fresh = new Set(ids.filter((id) => id.startsWith(NEW_ROW_PREFIX)));
    if (fresh.size > 0) staged.value = removeInserts(staged.value, fresh);
    return ids.filter((id) => !fresh.has(id));
  }

  function discard() {
    editing.value = null;
    staged.value = EMPTY_STAGED;
  }

  async function save() {
    if (saving.value || pending.value === 0) return;
    editing.value = null;
    saving.value = true;
    try {
      if (await input.save(staged.value)) staged.value = EMPTY_STAGED;
    } finally {
      saving.value = false;
    }
  }

  return {
    staged,
    pending,
    rows,
    states,
    editing,
    saving,
    note,
    editorKind,
    sampleOf,
    startEdit,
    commit,
    cancel,
    addRow,
    dropNewRows,
    discard,
    save,
  };
}
