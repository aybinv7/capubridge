import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { IDBDomain } from "@capubridge/cdp-protocol";
import {
  editorKindFor,
  editorText,
  parseCellEdit,
} from "@/shared/components/data/grid/editors/cellEdit";
import { useIdbStoreWrites } from "../useIdbStoreWrites";
import type { IdbOpenDatabase } from "../useIdbCatalog";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const open: IdbOpenDatabase = {
  mode: "live",
  id: "shop",
  name: "shop",
  version: 1,
  origin: "https://app",
  storeNames: ["notes"],
  file: null,
};

function writes() {
  return useIdbStoreWrites({
    open: ref(open),
    store: ref("notes"),
    domain: () => ({}) as IDBDomain,
    pending: ref(false),
    keyPath: ref("id"),
    afterWrite: () => undefined,
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("an IndexedDB field with line breaks (S1)", () => {
  test("opens the multi-line editor and an edit keeps its CRLF line breaks", () => {
    const record = { key: 1, value: { id: 1, note: "first\r\nsecond" } };
    expect(writes().cellReadOnlyReason(record, "note", undefined)).toBeNull();
    const kind = editorKindFor(record.value.note);
    expect(kind).toBe("multiline");
    if (kind !== "multiline") return;
    const parsed = parseCellEdit(
      record.value.note,
      kind,
      `${editorText(record.value.note, kind)}!`,
    );
    expect(parsed).toEqual({ ok: true, value: "first\r\nsecond!", changed: true });
  });

  test("a field mixing two kinds of line break is left for the record pane", () => {
    const record = { key: 1, value: { id: 1, note: "a\r\nb\nc" } };
    expect(writes().cellReadOnlyReason(record, "note", undefined)).toMatch(
      /two kinds of line break/,
    );
  });
});
