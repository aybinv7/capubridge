import { describe, expect, test, vi } from "vite-plus/test";
import { ref, shallowRef } from "vue";

vi.mock("@/modules/storage/frame/recordPaneOpen", async () => {
  const { ref: vueRef } = await import("vue");
  return { recordPaneOpen: vueRef(true), toggleRecordPane: vi.fn() };
});

const { useKvPane } = await import("../useKvPane");
const { areaEntries } = await import("../kvModel");

function setup(values: Record<string, string>) {
  const entries = shallowRef(
    areaEntries(Object.entries(values).map(([key, value]) => ({ key, value }))),
  );
  const order = ref(entries.value.map((entry) => entry.id));
  const pane = useKvPane({ entries, order, grid: ref(null) });
  function phone(next: Record<string, string>) {
    entries.value = areaEntries(Object.entries(next).map(([key, value]) => ({ key, value })));
    order.value = entries.value.map((entry) => entry.id);
  }
  return { pane, phone };
}

describe("an unsaved edit is never swapped or dropped (S6)", () => {
  test("the app changing the key keeps the edit on what was read, and says so", () => {
    const { pane, phone } = setup({ a: "1", b: "2" });
    pane.show("k:a");
    pane.setDirty(true);
    phone({ a: "changed by the app", b: "2" });
    expect(pane.base.value?.stored).toBe("1");
    expect(pane.changedOnPhone.value).toBe(true);
  });

  test("the app deleting the key keeps the edit open, and says so", () => {
    const { pane, phone } = setup({ a: "1" });
    pane.show("k:a");
    pane.setDirty(true);
    phone({});
    expect(pane.visible.value).toBe(true);
    expect(pane.goneFromPhone.value).toBe(true);
  });

  test("moving in the grid does not move an unsaved edit", () => {
    const { pane } = setup({ a: "1", b: "2" });
    pane.show("k:a");
    pane.setDirty(true);
    pane.activeId.value = "k:b";
    pane.show("k:b");
    pane.step(1);
    expect(pane.base.value?.key).toBe("a");
    expect(pane.canNext.value).toBe(false);
  });

  test("after a save the pane follows the key under its new name", () => {
    const { pane, phone } = setup({ a: "1" });
    pane.show("k:a");
    pane.setDirty(true);
    pane.settle("k:renamed");
    phone({ renamed: "1" });
    expect(pane.base.value?.key).toBe("renamed");
    expect(pane.dirty.value).toBe(false);
  });
});
