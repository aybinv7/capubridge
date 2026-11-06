import { describe, expect, test } from "vite-plus/test";
import { effectScope, ref } from "vue";
import type { GridColumn, GridRow } from "@/shared/components/data/grid";
import { useSqliteStagedEdits } from "../useSqliteStagedEdits";
import type { SqliteStaged } from "../sqliteChangeset";

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
