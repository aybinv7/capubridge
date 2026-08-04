import { h } from "vue";
import { expect, test } from "vite-plus/test";

import ActionFixture from "../fixtures/actions/ActionFixture.vue";
import { Button, Chip, Shortcut, Spinner, buttonSpinnerSizes } from "../src/index.ts";
import { byTestId, mountTree } from "./support/mountTree.ts";

test("renders exact default button structure and loading replacement", () => {
  const mounted = mountTree(
    h(Button, { "data-testid": "button", loading: true }, { default: () => "Saving" }),
  );
  const button = byTestId(mounted.root, "button");

  expect(button.tagName).toBe("BUTTON");
  expect(button.classList.contains("cui-button--md")).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.textContent).toContain("Saving");
  expect(button.querySelector(".cui-spinner")?.getAttribute("data-cui-size")).toBe("sm");
  expect(button.querySelector('[data-part="focus-ring"]')).not.toBeNull();
  mounted.app.unmount();
});

test("blocks disabled and readonly button activation", () => {
  let activations = 0;
  const disabled = mountTree(
    h(Button, { disabled: true, onClick: () => activations++ }, { default: () => "Disabled" }),
  );
  const readonly = mountTree(
    h(
      Button,
      { as: "a", href: "#target", onClick: () => activations++, readOnly: true },
      { default: () => "Readonly" },
    ),
  );

  (disabled.root.querySelector("button") as HTMLButtonElement).click();
  (readonly.root.querySelector("a") as HTMLAnchorElement).click();
  expect(activations).toBe(0);
  expect(readonly.root.querySelector("a")?.getAttribute("aria-disabled")).toBe("true");
  expect(readonly.root.querySelector("a")?.classList.contains("cui-button--disabled")).toBe(false);
  expect(disabled.root.querySelector("button")?.classList.contains("cui-button--disabled")).toBe(
    true,
  );
  disabled.app.unmount();
  readonly.app.unmount();
});

test("matches Cladd button color and content layer API", () => {
  const mounted = mountTree(
    h(
      Button,
      {
        color: "orange",
        contentClassName: "button-content-contract",
        square: true,
      },
      { default: () => h("svg", { "data-testid": "button-icon" }) },
    ),
  );
  const button = mounted.root.querySelector(".cui-button") as HTMLElement;

  expect(button.getAttribute("data-cui-accent")).toBe("orange");
  expect(button.querySelector(".button-content-contract")).not.toBeNull();
  expect(button.querySelector('[data-testid="button-icon"]')).not.toBeNull();
  expect(button.hasAttribute("aria-label")).toBe(false);
  mounted.app.unmount();
});

test("emits the Cladd button state attributes", () => {
  const mounted = mountTree(h(Button, { loading: true, pressed: true, readOnly: true }));
  const button = mounted.root.querySelector(".cui-button") as HTMLElement;

  expect(button.getAttribute("data-pressed")).toBe("true");
  expect(button.getAttribute("data-loading")).toBe("true");
  expect(button.getAttribute("data-readonly")).toBe("true");
  mounted.app.unmount();
});

test("scopes the accent text hook to non-neutral colors like Cladd", () => {
  const neutral = mountTree(h(Button, { color: "neutral" }));
  const accented = mountTree(h(Button, { color: "orange" }));
  const inherited = mountTree(h(Button));

  expect(neutral.root.querySelector(".cui-button")?.hasAttribute("data-cui-explicit-accent")).toBe(
    false,
  );
  expect(accented.root.querySelector(".cui-button")?.getAttribute("data-cui-explicit-accent")).toBe(
    "true",
  );
  expect(
    inherited.root.querySelector(".cui-button")?.hasAttribute("data-cui-explicit-accent"),
  ).toBe(false);

  neutral.app.unmount();
  accented.app.unmount();
  inherited.app.unmount();
});

test("maps every button size to Cladd spinner geometry", () => {
  expect(buttonSpinnerSizes).toEqual({
    "2xs": "2xs",
    xs: "2xs",
    sm: "xs",
    md: "sm",
    lg: "md",
    xl: "lg",
    "2xl": "xl",
  });
});

test("makes anchor and button chips interactive automatically", () => {
  const mounted = mountTree(
    h("div", null, [
      h(Chip, { as: "a", "data-testid": "anchor", href: "#target" }, () => "Docs"),
      h(Chip, { "data-testid": "label" }, () => "Draft"),
    ]),
  );

  expect(byTestId(mounted.root, "anchor").classList.contains("cui-surface--clickable")).toBe(true);
  expect(byTestId(mounted.root, "label").classList.contains("cui-surface--clickable")).toBe(false);
  mounted.app.unmount();
});

test("matches Cladd chip API and geometry contracts", () => {
  const mounted = mountTree(
    h(
      Chip,
      {
        as: "button",
        color: "green",
        contentClassName: "chip-content-contract",
        disabled: true,
        icon: { render: () => h("svg", { "data-testid": "chip-icon" }) },
        rounded: true,
      },
      () => "Verified",
    ),
  );
  const chip = mounted.root.querySelector(".cui-chip") as HTMLElement;

  expect(chip.tagName).toBe("BUTTON");
  expect(chip.classList.contains("cui-chip--rounded")).toBe(true);
  expect(chip.classList.contains("cui-chip--disabled")).toBe(false);
  expect(chip.hasAttribute("disabled")).toBe(false);
  expect(chip.querySelector(".chip-content-contract")).not.toBeNull();
  expect(chip.querySelector('[data-testid="chip-icon"]')).not.toBeNull();
  expect(chip.getAttribute("data-cui-accent")).toBe("green");
  mounted.app.unmount();
});

test("matches Cladd spinner API and SVG contract", () => {
  const mounted = mountTree(
    h(Spinner, {
      class: "spinner-contract",
      color: "purple",
      size: "2xl",
    }),
  );
  const spinner = mounted.root.querySelector(".cui-spinner") as HTMLElement;

  expect(spinner.classList.contains("spinner-contract")).toBe(true);
  expect(spinner.classList.contains("cui-accent-purple")).toBe(true);
  expect(spinner.getAttribute("data-cui-size")).toBe("2xl");
  expect(spinner.hasAttribute("aria-hidden")).toBe(false);
  expect(spinner.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 20 20");
  expect(spinner.querySelector("path")?.getAttribute("d")).toContain("M9.045 2.078");
  mounted.app.unmount();
});

test("splits shortcuts and renders platform key treatment", () => {
  const mounted = mountTree(h(Shortcut, { "data-testid": "shortcut" }, () => "ctrl shift k"));
  const shortcut = byTestId(mounted.root, "shortcut");
  const keys = shortcut.querySelectorAll('[data-part="key"]');

  expect(keys).toHaveLength(3);
  expect(keys[0]?.textContent).toBe("CTRL");
  expect(keys[1]?.querySelector("svg")).not.toBeNull();
  expect(keys[2]?.textContent).toBe("K");
  mounted.app.unmount();
});

test("matches Cladd shortcut key customization and fill contracts", () => {
  const mounted = mountTree(
    h(
      Shortcut,
      {
        color: "brand",
        iconClassName: "shortcut-icon-contract",
        keyClassName: "shortcut-key-contract",
        keyContentClassName: "shortcut-content-contract",
        variant: "solid-fill",
      },
      () => "shift k",
    ),
  );
  const keys = mounted.root.querySelectorAll<HTMLElement>(".cui-shortcut__key");

  expect(keys).toHaveLength(2);
  expect(keys[0]?.classList.contains("shortcut-key-contract")).toBe(true);
  expect(keys[0]?.getAttribute("data-cui-accent")).toBe("brand");
  expect(keys[0]?.querySelector(".shortcut-content-contract")).not.toBeNull();
  expect(keys[0]?.querySelector(".shortcut-icon-contract")).not.toBeNull();
  expect(keys[0]?.classList.contains("cui-surface--fill")).toBe(true);
  mounted.app.unmount();
});

test("renders every pixel-contract fixture size and state", () => {
  const mounted = mountTree(h(ActionFixture));

  expect(mounted.root.querySelectorAll(".cui-action-fixture__row")).toHaveLength(8);
  expect(mounted.root.querySelectorAll(".cui-button").length).toBeGreaterThan(20);
  expect(mounted.root.querySelectorAll(".cui-chip")).toHaveLength(7);
  expect(mounted.root.querySelectorAll(".cui-shortcut")).toHaveLength(7);
  expect(mounted.root.querySelectorAll(".cui-spinner").length).toBeGreaterThan(7);
  expect(mounted.root.querySelectorAll('[data-cui-surface-level="5"]').length).toBeGreaterThan(1);
  mounted.app.unmount();
});
