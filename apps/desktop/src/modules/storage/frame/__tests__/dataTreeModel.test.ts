import { describe, expect, test } from "vite-plus/test";
import { buildDataTree } from "../dataTreeModel";
import type { DataSection, DataSourceNode } from "../dataFrame.types";

function source(id: string, extra: Partial<DataSourceNode> = {}): DataSourceNode {
  return {
    id,
    label: id,
    provenance: "live",
    expanded: true,
    collections: [
      { id: "orders", label: "orders" },
      { id: "clients", label: "clients" },
    ],
    ...extra,
  };
}

const live: DataSection = {
  id: "live",
  label: "On the phone",
  sources: [source("shop"), source("auth")],
};

describe("buildDataTree", () => {
  test("pinned sources come first, then by name, with collections sorted", () => {
    const tree = buildDataTree(
      [{ ...live, sources: [source("auth"), source("shop", { pinned: true })] }],
      { search: "", showHidden: false },
    );
    expect(tree.rows.map((row) => row.key)).toEqual([
      "s:shop",
      "c:shop\u0000clients",
      "c:shop\u0000orders",
      "s:auth",
      "c:auth\u0000clients",
      "c:auth\u0000orders",
    ]);
  });

  test("search keeps matching collections and opens their source", () => {
    const tree = buildDataTree(
      [{ ...live, sources: [source("shop", { expanded: false }), source("auth")] }],
      { search: "ORD", showHidden: false },
    );
    expect(tree.rows.filter((row) => row.kind === "collection").map((row) => row.key)).toEqual([
      "c:auth\u0000orders",
      "c:shop\u0000orders",
    ]);
  });

  test("hidden entries are counted and skipped until shown", () => {
    const sections = [
      {
        ...live,
        sources: [
          source("shop", { hidden: true }),
          source("auth", { collections: [{ id: "x", label: "x", hidden: true }] }),
        ],
      },
    ];
    const tree = buildDataTree(sections, { search: "", showHidden: false });
    expect(tree.hiddenSources).toBe(1);
    expect(tree.hiddenCollections).toBe(1);
    expect(tree.rows.map((row) => row.key)).toEqual(["s:auth"]);
    expect(buildDataTree(sections, { search: "", showHidden: true }).rows).toHaveLength(5);
  });

  test("section headings appear only when there is more than one section", () => {
    const files: DataSection = { id: "files", label: "Opened files", sources: [], empty: "None" };
    const tree = buildDataTree([live, files], { search: "", showHidden: false });
    expect(tree.rows[0]).toMatchObject({ kind: "section", key: "h:live" });
    expect(tree.rows.at(-1)).toMatchObject({ kind: "note", text: "None" });
  });

  test("a search that matches nothing says so", () => {
    expect(buildDataTree([live], { search: "zzz", showHidden: false }).noMatch).toBe(true);
  });
});
