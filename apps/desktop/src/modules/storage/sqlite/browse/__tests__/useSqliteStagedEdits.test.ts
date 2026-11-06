import { describe, expect, test, vi } from "vite-plus/test";
import { effectScope, ref, shallowRef } from "vue";
import type { GridColumn, GridRow } from "@/shared/components/data/grid";
import { useSqliteStagedEdits } from "../useSqliteStagedEdits";
import type { SqliteStaged } from "../sqliteChangeset";

const toast = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

const columns: GridColumn[] = [
  { id: "id", title: "id", type: "integer", primaryKey: true },
  { id: "name", title: "name", type: "text" },
];
const rows: GridRow[] = [
  { id: "[1]", cells: { id: 1, name: "tea" } },
  { id: "[2]", cells: { id: 2, name: "cake" } },
];

function setup() {
  let finish: (saved: boolean) => void = () => undefined;
  const saves: SqliteStaged[] = [];
  const scope = effectScope();
  const staging = scope.run(() =>
    useSqliteStagedEdits({
      rows: ref(rows),
      columns: ref(columns),
      showAs: ref({}),
      writable: ref(true),
      save: (staged) => {
        saves.push(staged);
        return new Promise<boolean>((resolve) => (finish = resolve));
      },
    }),
  );
  if (!staging) throw new Error("no staging");
  return { staging, saves, finish: (saved: boolean) => finish(saved), scope };
}

describe("edits while a save is running (S5)", () => {
  test("are refused with a note, and the save keeps nothing it did not save", async () => {
    const { staging, saves, finish, scope } = setup();
    staging.startEdit("[1]", "name");
    staging.commit("green tea");
    expect(staging.pending.value).toBe(1);

    const saving = staging.save();
    expect(staging.saving.value).toBe(true);

    staging.startEdit("[2]", "name");
    expect(staging.editing.value).toBeNull();
    expect(staging.note.value).toMatch(/Saving the changes/);
    expect(staging.addRow()).toBeNull();

    finish(true);
    await saving;
    expect(saves).toHaveLength(1);
    expect(staging.pending.value).toBe(0);

    staging.startEdit("[2]", "name");
    staging.commit("scone");
    expect(staging.pending.value).toBe(1);
    scope.stop();
  });

  test("a save that fails keeps every staged change", async () => {
    const { staging, finish, scope } = setup();
    staging.startEdit("[1]", "name");
    staging.commit("green tea");
    const saving = staging.save();
    finish(false);
    await saving;
    expect(staging.pending.value).toBe(1);
    scope.stop();
  });
});

describe("deleting rows is staged like any edit (S6, U2)", () => {
  test("a deleted row is marked, cannot be edited, and Discard brings it back", () => {
    const { staging, scope } = setup();
    staging.startEdit("[1]", "name");
    staging.commit("green tea");
    staging.deleteRows(["[1]"]);
    expect(staging.states.value.get("[1]")).toBe("staged-delete");
    expect(staging.staged.value.edits.size).toBe(0);
    expect(staging.pending.value).toBe(1);
    staging.startEdit("[1]", "name");
    expect(staging.editing.value).toBeNull();
    staging.keepRows(["[1]"]);
    expect(staging.pending.value).toBe(0);
    staging.deleteRows(["[2]"]);
    staging.discard();
    expect(staging.states.value.size).toBe(0);
    scope.stop();
  });
});

describe("Discard from the edit bar (U8)", () => {
  test("drops every change, and Undo in its toast brings them back", () => {
    const { staging, scope } = setup();
    staging.startEdit("[1]", "name");
    staging.commit("green tea");
    staging.deleteRows(["[2]"]);
    toast.info.mockReset();
    staging.discardWithUndo();
    expect(staging.pending.value).toBe(0);
    const options = toast.info.mock.calls[0]?.[1] as { action: { onClick: () => void } };
    expect(toast.info.mock.calls[0]?.[0]).toBe("Dropped 2 changes");
    options.action.onClick();
    expect(staging.pending.value).toBe(2);
    scope.stop();
  });
});

describe("one cell at a time (U3)", () => {
  test("a cell can be set to NULL and one edited cell put back", () => {
    const { staging, scope } = setup();
    staging.startEdit("[1]", "name");
    staging.commit("green tea");
    expect(staging.cellChanged("[1]", "name")).toBe(true);
    staging.undoCell("[1]", "name");
    expect(staging.pending.value).toBe(0);
    staging.setNull("[2]", "name");
    expect(staging.staged.value.edits.get("[2]")?.values).toEqual({ name: null });
    scope.stop();
  });
});

describe("staged edits kept outside the component", () => {
  test("a remounted grid finds the edits it left", () => {
    const kept = shallowRef<SqliteStaged>({ edits: new Map(), inserts: [], deletes: new Map() });
    const store = {
      read: () => kept.value,
      write: (next: SqliteStaged) => {
        kept.value = next;
      },
    };
    const mount = () => {
      const scope = effectScope();
      const staging = scope.run(() =>
        useSqliteStagedEdits({
          rows: ref(rows),
          columns: ref(columns),
          showAs: ref({}),
          writable: ref(true),
          save: async () => true,
          store,
        }),
      );
      if (!staging) throw new Error("no staging");
      return { staging, scope };
    };
    const first = mount();
    first.staging.addRow();
    first.staging.deleteRows(["[2]"]);
    expect(first.staging.pending.value).toBe(2);
    first.scope.stop();
    const second = mount();
    expect(second.staging.pending.value).toBe(2);
    expect(second.staging.isDeleting("[2]")).toBe(true);
    second.scope.stop();
  });
});
