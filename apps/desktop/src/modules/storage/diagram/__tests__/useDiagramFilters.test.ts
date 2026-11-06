import { describe, expect, test } from "vite-plus/test";
import { nextTick, ref } from "vue";
import type { StorageGraphNoteRecord } from "@/types/storageGraph.types";
import { useDiagramFilters } from "../useDiagramFilters";

function note(id: string, title: string, body: string): StorageGraphNoteRecord {
  return { id, title, note: body, accent: "blue", position: { x: 0, y: 0 } };
}

describe("finding in the Diagram", () => {
  test("a sticky note is found by its title or text, and hidden when it does not match", async () => {
    const filters = useDiagramFilters(
      {
        entities: ref([]),
        notes: ref([note("n1", "Sync", "orders flow"), note("n2", "Todo", "rename users")]),
        relationships: ref([]),
        schemaRelationships: ref([]),
        autoLayoutPositions: ref({}),
        schemaLayoutPositions: ref({}),
      },
      "schema",
    );
    expect(filters.filteredNotes.value.map((entry) => entry.id)).toEqual(["n1", "n2"]);
    filters.search.value = "orders";
    await new Promise((resolve) => setTimeout(resolve, 260));
    await nextTick();
    expect(filters.filteredNotes.value.map((entry) => entry.id)).toEqual(["n1"]);
  });
});
