import { describe, expect, test } from "vite-plus/test";
import { accessibleName, hrefName } from "../accessibleName";
import type { NameSources } from "../accessibleName";

function sources(overrides: Partial<NameSources> = {}): NameSources {
  return {
    ariaLabel: null,
    labelledBy: null,
    title: null,
    svgTitle: null,
    placeholder: null,
    href: null,
    ...overrides,
  };
}

describe("hrefName", () => {
  test("the Presalio search icon is named by its route", () => {
    expect(hrefName("/stock/search/")).toBe("search");
  });

  test("hash routes are read like paths", () => {
    expect(hrefName("#/orders/new-order")).toBe("new order");
  });

  test("a bare anchor, a script link and an empty href carry no name", () => {
    expect(hrefName("#")).toBeNull();
    expect(hrefName("javascript:void(0)")).toBeNull();
    expect(hrefName("")).toBeNull();
    expect(hrefName(null)).toBeNull();
  });

  test("record ids never become names, so data does not leak into labels", () => {
    expect(hrefName("/client/12345")).toBeNull();
    expect(hrefName("/order/5f3c9a1e-2b7d-4c8e-9f10-aa21b3c4d5e6")).toBeNull();
    expect(hrefName("/stock/SKU-CC1566")).toBeNull();
  });

  test("an absolute URL uses its path, not its host", () => {
    expect(hrefName("https://localhost/stock/search/?q=1")).toBe("search");
  });
});

describe("accessibleName", () => {
  test("an explicit aria-label wins over every weaker source", () => {
    expect(
      accessibleName(sources({ ariaLabel: "Search stock", title: "t", href: "/stock/search/" })),
    ).toBe("Search stock");
  });

  test("sources are tried in accessibility order", () => {
    expect(accessibleName(sources({ labelledBy: "Scan", title: "t" }))).toBe("Scan");
    expect(accessibleName(sources({ title: "Filter", svgTitle: "x" }))).toBe("Filter");
    expect(accessibleName(sources({ svgTitle: "Scan barcode", placeholder: "p" }))).toBe(
      "Scan barcode",
    );
    expect(accessibleName(sources({ placeholder: "Search products", href: "/x/y" }))).toBe(
      "Search products",
    );
  });

  test("an icon-only link with nothing but a route is named from the route", () => {
    expect(accessibleName(sources({ href: "/stock/search/" }))).toBe("search");
  });

  test("whitespace is collapsed and blank sources are skipped", () => {
    expect(accessibleName(sources({ ariaLabel: "   ", title: "  Open \n  menu " }))).toBe(
      "Open menu",
    );
  });

  test("an element with no source has an empty name", () => {
    expect(accessibleName(sources({ href: "#" }))).toBe("");
  });

  test("a runaway name is capped", () => {
    expect(accessibleName(sources({ ariaLabel: "x".repeat(300) })).length).toBeLessThanOrEqual(80);
  });
});
