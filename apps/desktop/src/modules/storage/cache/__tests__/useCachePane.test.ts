import { describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import { recordPaneOpen } from "@/modules/storage/frame/recordPaneOpen";
import { toRow, type CacheRow } from "../cacheModel";
import { useCachePane } from "../useCachePane";
import { entry } from "./cacheFixtures";

function rowsOf(...ids: string[]): CacheRow[] {
  return ids.map((id) => toRow(entry({ id, url: `https://app.test/${id}` })));
}

describe("the pane follows an entry by id, never by position", () => {
  test("after a read without the shown entry, the pane closes instead of showing a neighbour", () => {
    const rows = ref<readonly CacheRow[]>(rowsOf("a", "b", "c"));
    const pane = useCachePane({
      rows,
      order: ref(["a", "b", "c"]),
      grid: ref({ focusRow: vi.fn(), focus: vi.fn() }),
    });
    recordPaneOpen.value = true;
    pane.show("b");
    expect(pane.row.value?.id).toBe("b");
    rows.value = rowsOf("a", "c");
    expect(pane.row.value).toBeNull();
    expect(pane.visible.value).toBe(false);
  });

  test("previous and next move through the rows as shown", () => {
    const focusRow = vi.fn();
    const pane = useCachePane({
      rows: ref(rowsOf("a", "b", "c")),
      order: ref(["c", "b", "a"]),
      grid: ref({ focusRow, focus: vi.fn() }),
    });
    pane.show("c");
    expect(pane.canPrev.value).toBe(false);
    pane.step(1);
    expect(pane.row.value?.id).toBe("b");
    expect(focusRow).toHaveBeenCalledWith("b");
  });
});
