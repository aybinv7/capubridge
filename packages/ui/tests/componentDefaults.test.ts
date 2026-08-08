import { h } from "vue";
import { expect, test } from "vite-plus/test";

import { Button, Chip, SearchField, Shortcut, Spinner, Surface, UiProvider } from "../src/index.ts";
import type { ComponentDefaults } from "../src/index.ts";
import { byTestId, mountTree } from "./support/mountTree.ts";

function mountWithDefaults(defaults: ComponentDefaults, node: ReturnType<typeof h>) {
  return mountTree(h(UiProvider, { defaults }, { default: () => node }));
}

test("applies a provider default over the component's built-in default", () => {
  const mounted = mountWithDefaults(
    { Spinner: { size: "2xl" } },
    h(Spinner, { "data-testid": "spinner" }),
  );

  // Built-in is 'sm'; the provider default wins.
  expect(byTestId(mounted.root, "spinner").classList.contains("size-cui-nested-2xl")).toBe(true);
  mounted.app.unmount();
});

test("lets an explicit prop win over the provider default", () => {
  const mounted = mountWithDefaults(
    { Spinner: { size: "2xl" } },
    h(Spinner, { "data-testid": "spinner", size: "xs" }),
  );

  expect(byTestId(mounted.root, "spinner").classList.contains("size-cui-nested-xs")).toBe(true);
  mounted.app.unmount();
});

test("falls back to the provider default when a prop is forwarded as undefined", () => {
  const mounted = mountWithDefaults(
    { Spinner: { size: "2xl" } },
    h(Spinner, { "data-testid": "spinner", size: undefined }),
  );

  // Wrapper components forward `:size="size"` even when unset — that must not clobber the default.
  expect(byTestId(mounted.root, "spinner").classList.contains("size-cui-nested-2xl")).toBe(true);
  mounted.app.unmount();
});

test("carries boolean provider defaults, which Vue's absent-boolean cast would swallow", () => {
  const mounted = mountWithDefaults(
    { Chip: { outline: false, rounded: true } },
    h(Chip, { "data-testid": "chip" }, { default: () => "Connected" }),
  );
  const chip = byTestId(mounted.root, "chip");

  // `outline` defaults to true built-in; the provider turns it off, so no outline ring class.
  expect(chip.querySelector(".shadow-cui-outline")).toBeNull();
  // `rounded` defaults to false built-in; the provider turns it on.
  expect(chip.className).toContain("rounded-full");
  mounted.app.unmount();
});

test("keeps an explicit false when the provider default is true", () => {
  const mounted = mountWithDefaults(
    { Chip: { rounded: true } },
    h(Chip, { "data-testid": "chip", rounded: false }, { default: () => "Connected" }),
  );

  expect(byTestId(mounted.root, "chip").className).not.toContain("rounded-full");
  mounted.app.unmount();
});

test("threads defaults through Shortcut and SearchField too", () => {
  const shortcut = mountWithDefaults(
    { Shortcut: { size: "2xl" } },
    h(Shortcut, { "data-testid": "shortcut" }, { default: () => "K" }),
  );
  expect(byTestId(shortcut.root, "shortcut").querySelector(".text-cui-md")).not.toBeNull();
  shortcut.app.unmount();

  const search = mountWithDefaults(
    { SearchField: { placeholder: "Filter targets", rounded: false } },
    h(SearchField, { "data-testid": "search" }),
  );
  const input = byTestId(search.root, "search").querySelector("input");
  expect(input?.getAttribute("placeholder")).toBe("Filter targets");
  search.app.unmount();
});

test("threads defaults through Button and Surface", () => {
  const button = mountWithDefaults(
    { Button: { outline: false, rounded: true, size: "2xl" } },
    h(Button, { "data-testid": "button" }, { default: () => "Save" }),
  );
  const root = byTestId(button.root, "button");

  expect(root.classList.contains("h-cui-2xl")).toBe(true);
  expect(root.className).toContain("rounded-full");
  expect(root.querySelector(".shadow-cui-outline")).toBeNull();
  button.app.unmount();

  const surface = mountWithDefaults(
    { Surface: { outline: true, variant: "gradient" } },
    h(Surface, { "data-testid": "surface" }, { default: () => "panel" }),
  );
  const background = byTestId(surface.root, "surface").querySelector(".cui-surface__background");

  expect(background?.classList.contains("shadow-cui-outline")).toBe(true);
  expect(background?.classList.contains("from-cui-surface-highlight")).toBe(true);
  surface.app.unmount();
});

test("leaves components untouched when no defaults are registered", () => {
  const mounted = mountTree(
    h(UiProvider, null, { default: () => h(Spinner, { "data-testid": "spinner" }) }),
  );

  expect(byTestId(mounted.root, "spinner").classList.contains("size-cui-nested-sm")).toBe(true);
  mounted.app.unmount();
});
