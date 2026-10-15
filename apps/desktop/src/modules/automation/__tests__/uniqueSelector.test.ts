// @vitest-environment happy-dom
import { runInThisContext } from "node:vm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { resolveUnique, uniqueSelector } from "../uniqueSelector";

/**
 * Framework7 keeps every visited page mounted, and its pages share one navbar
 * structure. Measured on Presalio, a 5-level positional selector for the Stock
 * search icon matched 3 elements, and `querySelector` returned a hidden Home
 * page's navbar button, which opened Messages.
 */
function framework7Stack(): void {
  const page = (title: string, href: string) => `
    <div class="page">
      <div class="navbar"><div class="navbar-inner"><div class="right">
        <div><a class="link icon-only" href="${href}"><svg></svg></a><a class="link icon-only" href="#"><svg></svg></a></div>
      </div></div></div>
      <div class="page-content"><h1>${title}</h1><input placeholder="Search ${title}"></div>
    </div>`;
  document.body.innerHTML = `<div id="app"><div class="view">${page("Home", "#")}${page(
    "Dashboard",
    "#",
  )}${page("Stock", "/stock/search/")}</div></div>`;
}

describe("uniqueSelector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("structurally identical pages get distinct selectors that each match exactly one element", () => {
    framework7Stack();
    const links = [...document.querySelectorAll("a")];
    const selectors = links.map((link) => uniqueSelector(link));
    expect(new Set(selectors).size).toBe(links.length);
    for (const [index, selector] of selectors.entries()) {
      expect(document.querySelectorAll(selector)).toHaveLength(1);
      expect(document.querySelector(selector)).toBe(links[index]);
    }
  });

  test("the Stock search icon resolves to the Stock page, not the first page in the stack", () => {
    framework7Stack();
    const stockSearch = document.querySelector('a[href="/stock/search/"]');
    if (stockSearch === null) {
      throw new Error("fixture must contain the stock search link");
    }
    expect(document.querySelector(uniqueSelector(stockSearch))).toBe(stockSearch);
  });

  test("every element in the tree round-trips through its selector", () => {
    framework7Stack();
    for (const element of document.querySelectorAll("body *")) {
      expect(document.querySelector(uniqueSelector(element))).toBe(element);
    }
  });

  test("a unique id is used directly", () => {
    document.body.innerHTML = `<div><button id="save">Save</button></div>`;
    const button = document.querySelector("button");
    expect(button === null ? null : uniqueSelector(button)).toBe("#save");
  });

  test("a duplicated id is not trusted and falls back to a unique path", () => {
    document.body.innerHTML = `<div><button id="dup">A</button></div><div><button id="dup">B</button></div>`;
    const second = document.querySelectorAll("button")[1];
    if (second === undefined) {
      throw new Error("fixture must contain two buttons");
    }
    const selector = uniqueSelector(second);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(second);
  });

  test("a unique data-testid is preferred over a positional path", () => {
    document.body.innerHTML = `<div><div><a data-testid="open-cart">Cart</a></div></div>`;
    const link = document.querySelector("a");
    expect(link === null ? null : uniqueSelector(link)).toBe('[data-testid="open-cart"]');
  });

  test("the serialized function runs standalone, as it does inside the page", () => {
    framework7Stack();
    const injected = runInThisContext(`(${uniqueSelector.toString()})`) as (
      element: Element,
    ) => string;
    const stockSearch = document.querySelector('a[href="/stock/search/"]');
    if (stockSearch === null) {
      throw new Error("fixture must contain the stock search link");
    }
    expect(document.querySelector(injected(stockSearch))).toBe(stockSearch);
  });
});

describe("resolveUnique", () => {
  test("an ambiguous selector resolves to nothing rather than the first match", () => {
    framework7Stack();
    expect(resolveUnique(document, "div.right > div > a:nth-of-type(1)")).toBeNull();
  });

  test("a selector matching exactly one element resolves to it", () => {
    framework7Stack();
    const stockSearch = document.querySelector('a[href="/stock/search/"]');
    expect(resolveUnique(document, 'a[href="/stock/search/"]')).toBe(stockSearch);
  });

  test("an invalid selector resolves to nothing instead of throwing", () => {
    expect(resolveUnique(document, "a[[[")).toBeNull();
  });

  test("the serialized function runs standalone", () => {
    framework7Stack();
    const injected = runInThisContext(`(${resolveUnique.toString()})`) as (
      doc: Document,
      selector: string,
    ) => Element | null;
    expect(injected(document, "div.right > div > a:nth-of-type(1)")).toBeNull();
  });
});
