import { defineComponent, h, nextTick, ref } from "vue";
import { expect, test } from "vite-plus/test";

import {
  AccordionItem,
  AccordionPanel,
  AccordionRoot,
  AccordionTrigger,
  Button,
  Checkbox,
  Chip,
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger,
  Dialog,
  Input,
  Popover,
  Popup,
  PopupContent,
  Radio,
  SearchField,
  Segmented,
  SegmentedButton,
  Select,
  Shortcut,
  Slider,
  Spinner,
  Surface,
  Switch,
  Textarea,
  ToggleButton,
  ToggleGroup,
  Toolbar,
  ToolbarButton,
  TooltipPrimitive,
  UiProvider,
} from "../src/index.ts";
import type { ComponentDefaults } from "../src/index.ts";
import { byTestId, click, mountTree } from "./support/mountTree.ts";

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

test("threads defaults through Checkbox", () => {
  const mounted = mountWithDefaults(
    { Checkbox: { size: "md", thumbOutline: false } },
    h(Checkbox, { "data-testid": "checkbox" }),
  );
  const root = byTestId(mounted.root, "checkbox");

  // Built-in size is 'sm'; the provider default wins.
  expect(root.classList.contains("size-cui-thumb-md")).toBe(true);
  // Built-in thumbOutline is true; the provider turns it off.
  const thumb = root.querySelector('[data-part="thumb"]');
  expect(thumb?.classList.contains("shadow-cui-outline")).toBe(false);
  mounted.app.unmount();
});

test("threads defaults through Radio", () => {
  const mounted = mountWithDefaults(
    { Radio: { size: "md", thumbOutline: false } },
    h(Radio, { "data-testid": "radio" }),
  );
  const root = byTestId(mounted.root, "radio");

  expect(root.classList.contains("size-cui-thumb-md")).toBe(true);
  const thumb = root.querySelector('[data-part="thumb"]');
  expect(thumb?.classList.contains("shadow-cui-outline")).toBe(false);
  mounted.app.unmount();
});

test("threads defaults through Switch", () => {
  const mounted = mountWithDefaults(
    { Switch: { size: "sm", outline: false } },
    h(Switch, { "data-testid": "switch" }),
  );
  const root = byTestId(mounted.root, "switch");

  // Built-in size is 'md'; the provider default wins.
  expect(root.classList.contains("w-10")).toBe(true);
  const track = root.querySelector('[data-part="track"]');
  expect(track?.classList.contains("shadow-cui-outline")).toBe(false);
  mounted.app.unmount();
});

test("threads defaults through Input and Textarea", () => {
  const input = mountWithDefaults(
    { Input: { placeholder: "Filter targets", size: "sm" } },
    h(Input, { "data-testid": "input" }),
  );
  const inputControl = byTestId(input.root, "input").querySelector("input");
  expect(inputControl?.getAttribute("placeholder")).toBe("Filter targets");
  input.app.unmount();

  const textarea = mountWithDefaults(
    { Textarea: { placeholder: "Notes", size: "sm" } },
    h(Textarea, { "data-testid": "textarea" }),
  );
  const placeholder = byTestId(textarea.root, "textarea").querySelector(
    '[data-part="placeholder"]',
  );
  expect(placeholder?.textContent).toBe("Notes");
  textarea.app.unmount();
});

test("threads defaults through Slider", () => {
  const mounted = mountWithDefaults(
    { Slider: { max: 200, thumbOutline: false } },
    h(Slider, { "data-testid": "slider" }),
  );
  const root = byTestId(mounted.root, "slider");
  const control = root.querySelector('[data-part="input"]');

  // Built-in max is 100; the provider default wins.
  expect(control?.getAttribute("max")).toBe("200");
  const thumb = root.querySelector('[data-part="thumb"]');
  expect(thumb?.classList.contains("shadow-cui-outline")).toBe(false);
  mounted.app.unmount();
});

test("threads defaults through Select", () => {
  const mounted = mountWithDefaults(
    { Select: { placeholder: "Pick one", size: "sm" } },
    h(Select, { "data-testid": "select" }),
  );
  const value = byTestId(mounted.root, "select").querySelector('[data-part="value"]');

  expect(value?.textContent).toBe("Pick one");
  mounted.app.unmount();
});

async function settleOverlay(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await nextTick();
}

// Overlays resolve their `open` model reactively; a literal `open: true` passed at creation
// races the initial mount, so tests open them via a ref flipped after mount (mirrors how the
// overlay fixtures in overlays.test.ts drive them through a real trigger click). Every overlay
// teleports into the first DOM match for `#app, #__next, #root`; `app.unmount()` alone leaves the
// (now empty) `#app` div earlier tests mounted into still sitting in `document.body`, so a fresh
// mount's Teleport can resolve to that stale div instead of its own. Sweep leftovers before
// mounting and remove this test's own root on cleanup.
function mountOpenOverlay(
  defaults: ComponentDefaults,
  render: (open: ReturnType<typeof ref<boolean>>) => ReturnType<typeof h>,
) {
  document.querySelectorAll("#app, #__next, #root").forEach((el) => el.remove());
  const open = ref(false);
  const harness = defineComponent({
    setup() {
      return () => h(UiProvider, { defaults }, { default: () => render(open) });
    },
  });
  const mounted = mountTree(h(harness));
  return {
    mounted,
    open,
    cleanup: () => {
      mounted.app.unmount();
      mounted.root.remove();
    },
  };
}

test("threads defaults through Popover and TooltipPrimitive", async () => {
  const popover = mountOpenOverlay({ Popover: { position: "top-start" } }, (open) =>
    h(
      Popover,
      {
        "data-testid": "popover",
        open: open.value,
        "onUpdate:open": (v: boolean) => (open.value = v),
      },
      { default: () => "content" },
    ),
  );
  popover.open.value = true;
  await settleOverlay();
  // Attrs (including data-testid) land on the content Surface itself for Popover.
  expect(byTestId(popover.mounted.root, "popover").getAttribute("data-position")).toBe("top-start");
  popover.cleanup();

  const tooltip = mountOpenOverlay({ TooltipPrimitive: { position: "bottom" } }, (open) =>
    h(
      TooltipPrimitive,
      {
        "data-testid": "tooltip",
        open: open.value,
        "onUpdate:open": (v: boolean) => (open.value = v),
      },
      { default: () => "hint" },
    ),
  );
  tooltip.open.value = true;
  await settleOverlay();
  expect(byTestId(tooltip.mounted.root, "tooltip").getAttribute("data-position")).toBe("bottom");
  tooltip.cleanup();
});

test("threads defaults through Dialog", async () => {
  const dialog = mountOpenOverlay({ Dialog: { surfaceLevel: 3 } }, (open) =>
    h(
      Dialog,
      {
        "data-testid": "dialog",
        open: open.value,
        "onUpdate:open": (v: boolean) => (open.value = v),
      },
      { default: () => "content" },
    ),
  );
  dialog.open.value = true;
  await settleOverlay();
  const content = byTestId(dialog.mounted.root, "dialog").querySelector('[data-part="content"]');

  expect(content?.classList.contains("cui-surface-level-3")).toBe(true);
  dialog.cleanup();
});

test("threads defaults through Popup", async () => {
  const popup = mountOpenOverlay({ Popup: { header: false } }, (open) =>
    h(
      Popup,
      {
        "data-testid": "popup",
        open: open.value,
        "onUpdate:open": (v: boolean) => (open.value = v),
      },
      { default: () => "content" },
    ),
  );
  popup.open.value = true;
  await settleOverlay();
  const root = byTestId(popup.mounted.root, "popup");

  expect(root.querySelector('[data-part="header"]')).toBeNull();
  popup.cleanup();
});

test("threads defaults through PopupContent", () => {
  const mounted = mountWithDefaults(
    { PopupContent: { outline: false, variant: "gradient" } },
    h(PopupContent, { "data-testid": "popup-content" }, { default: () => "card" }),
  );
  const root = byTestId(mounted.root, "popup-content");

  // root IS the card Surface; the outline class rides on the root itself, not a descendant.
  expect(root.classList.contains("shadow-cui-outline")).toBe(false);
  mounted.app.unmount();
});

test("threads defaults through Segmented and Toolbar", () => {
  const segmented = mountWithDefaults(
    { Segmented: { size: "lg" } },
    h(Segmented, null, () => h(SegmentedButton, { "data-testid": "segment" }, () => "Grid")),
  );
  expect(byTestId(segmented.root, "segment").classList.contains("h-cui-lg")).toBe(true);
  segmented.app.unmount();

  const toolbar = mountWithDefaults(
    { Toolbar: { size: "sm" } },
    h(Toolbar, null, () => h(ToolbarButton, { "data-testid": "toolbar-btn" }, () => "Copy")),
  );
  expect(byTestId(toolbar.root, "toolbar-btn").classList.contains("h-cui-sm")).toBe(true);
  toolbar.app.unmount();
});

test("threads defaults through CollapsiblePanel and AccordionItem's own registry keys", async () => {
  const collapsible = mountWithDefaults(
    { CollapsibleRoot: { disabled: true } },
    h(CollapsibleRoot, null, () => [
      h(CollapsibleTrigger, null, () => h("button", { "data-testid": "trigger" }, "Toggle")),
      h(CollapsiblePanel, { "data-testid": "panel" }, () => "content"),
    ]),
  );
  await click(byTestId(collapsible.root, "trigger"));
  // `disabled` defaults to false; the provider default turns it on, so the click above no-ops.
  expect(collapsible.root.querySelector('[data-testid="panel"]')).toBeNull();
  collapsible.app.unmount();

  // Accordion re-exports the very same Collapsible* components, so the registry key an
  // AccordionPanel resolves defaults through is still "CollapsiblePanel" — not "AccordionPanel".
  const accordion = mountWithDefaults(
    { CollapsiblePanel: { keepMounted: true } },
    h(AccordionRoot, null, () =>
      h(AccordionItem, { value: "one" }, () => [
        h(AccordionTrigger, null, () => h("button", { "data-testid": "trigger" }, "One")),
        h(AccordionPanel, { "data-testid": "panel" }, () => "content"),
      ]),
    ),
  );
  // With keepMounted forced on, the closed panel still renders (data-open="false") instead of
  // being absent from the DOM entirely.
  expect(byTestId(accordion.root, "panel").getAttribute("data-open")).toBeNull();
  accordion.app.unmount();
});

test("threads defaults through ToggleGroup and ToggleButton", () => {
  const mounted = mountWithDefaults(
    { ToggleGroup: { size: "lg" } },
    h(ToggleGroup, null, () => h(ToggleButton, { "data-testid": "toggle" }, () => "Bold")),
  );
  expect(byTestId(mounted.root, "toggle").classList.contains("h-cui-lg")).toBe(true);
  mounted.app.unmount();
});

test("leaves components untouched when no defaults are registered", () => {
  const mounted = mountTree(
    h(UiProvider, null, { default: () => h(Spinner, { "data-testid": "spinner" }) }),
  );

  expect(byTestId(mounted.root, "spinner").classList.contains("size-cui-nested-sm")).toBe(true);
  mounted.app.unmount();
});
