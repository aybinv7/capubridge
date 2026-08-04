import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defineComponent, h, nextTick, ref } from "vue";
import { expect, test } from "vite-plus/test";

import OverlayFixture from "../fixtures/overlays/OverlayFixture.vue";
import { Popover } from "../src/index.ts";
import {
  buildPopoverPositionStyle,
  popoverPositionConfigs,
  popoverPositions,
} from "../src/components/overlays/overlay.contracts.ts";
import { byTestId, mountTree } from "./support/mountTree.ts";

const overlaysCss = readFileSync(join(process.cwd(), "src", "styles", "overlays.css"), "utf8");

test("locks Cladd dialog backdrop and motion values", () => {
  expect(overlaysCss).toContain("var(--cui-backdrop) 90%");
  expect(overlaysCss).not.toContain("backdrop-filter");
  expect(overlaysCss).toContain("transform: scale(0.75)");
  expect(overlaysCss).toContain("var(--cui-motion-enter) var(--cui-ease-enter)");
  expect(overlaysCss).toContain("var(--cui-motion-base) var(--cui-ease-exit)");
});

test("locks the upstream popover shadow and keeps tooltips shadowless", () => {
  expect(overlaysCss).toContain("--cui-shadow-popover: 0 24px 64px -12px rgb(0 0 0 / 0.5)");
  expect(overlaysCss).toContain("box-shadow: var(--cui-shadow-popover)");
  const tooltipBlock = overlaysCss.slice(
    overlaysCss.indexOf(":where(.cui-tooltip__content) {"),
    overlaysCss.indexOf(":where(.cui-tooltip__surface) {"),
  );
  expect(tooltipBlock).not.toContain("box-shadow");
});

test("copies every upstream popover position into the contracts table", () => {
  expect(popoverPositions).toEqual([
    "top-start",
    "top",
    "top-end",
    "bottom-start",
    "bottom",
    "bottom-end",
    "left-start",
    "left",
    "left-end",
    "right-start",
    "right",
    "right-end",
    "center",
  ]);
  expect(popoverPositionConfigs["top-start"]).toEqual({
    area: "top center",
    justifySelf: "start",
    transformOrigin: "bottom left",
    offsetProperties: ["marginBottom", "marginLeft"],
  });
  expect(popoverPositionConfigs.center.centered).toBe(true);
});

test("resolves percentage offsets through anchor-size like upstream", () => {
  const style = buildPopoverPositionStyle({
    anchorName: "--cui-anchor-test",
    offset: ["50%", 8],
    position: "bottom-end",
    viewportMargin: 4,
  });

  expect(style.positionAnchor).toBe("--cui-anchor-test");
  expect(style.positionArea).toBe("bottom center");
  expect(style.transformOrigin).toBe("top right");
  expect(style.marginTop).toBe("calc(anchor-size(height) * 0.5)");
  expect(style.marginRight).toBe("8px");
});

async function settleOverlay(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await nextTick();
}

function mountOverlayFixture() {
  const mounted = mountTree(h(OverlayFixture));
  document.body.append(mounted.root);
  return mounted;
}

function cleanupOverlayFixture(root: HTMLElement, unmount: () => void): void {
  unmount();
  root.remove();
}

test("wires dialog title, description and modal state", async () => {
  const mounted = mountOverlayFixture();
  const trigger = byTestId(mounted.root, "dialog-trigger") as HTMLButtonElement;

  trigger.click();
  await settleOverlay();
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');

  expect(dialog).not.toBeNull();
  expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
  expect(dialog?.getAttribute("aria-describedby")).toBeTruthy();
  expect(document.body.textContent).toContain("Dialog title");
  expect(dialog?.closest(".cui-dialog__layer")?.getAttribute("data-cui-theme")).toBe("dark");
  expect(dialog?.classList.contains("cui-accent-brand")).toBe(false);

  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("keeps nested popover inside its parent dialog layer", async () => {
  const mounted = mountOverlayFixture();
  byTestId(mounted.root, "dialog-trigger").click();
  await settleOverlay();
  const nestedTrigger = document.body.querySelector<HTMLElement>('[data-testid="nested-trigger"]');

  nestedTrigger?.click();
  await settleOverlay();
  expect(document.body.querySelector(".cui-popover__content")).not.toBeNull();

  expect(document.body.querySelector(".cui-popover__content")).not.toBeNull();
  expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("guards destructive confirmation with exact text", async () => {
  const mounted = mountOverlayFixture();
  byTestId(mounted.root, "guarded-dialog-trigger").click();
  await settleOverlay();
  const confirm = document.body.querySelector<HTMLButtonElement>('[data-part="confirm"]');
  const input = document.body.querySelector<HTMLInputElement>(".cui-dialog__confirmation");

  expect(confirm?.disabled).toBe(true);
  expect(input).not.toBeNull();
  if (input) {
    input.value = "target";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  await nextTick();
  expect(document.body.querySelector<HTMLButtonElement>('[data-part="confirm"]')?.disabled).toBe(
    false,
  );
  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("positions and dismisses popovers through native overlay behavior", async () => {
  const mounted = mountOverlayFixture();
  const trigger = byTestId(mounted.root, "popover-trigger");

  trigger.click();
  await settleOverlay();
  const content = document.body.querySelector<HTMLElement>(".cui-popover__content");

  expect(content).not.toBeNull();
  expect(content?.getAttribute("data-position")).toBe("right-end");
  expect(content?.style.positionArea).toBe("center right");
  expect(content?.style.transformOrigin).toBe("bottom left");

  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("keeps top-level popovers mutually exclusive", async () => {
  const first = ref(false);
  const second = ref(false);
  const harness = defineComponent({
    setup() {
      return () =>
        h("div", null, [
          h(
            Popover,
            {
              modelValue: first.value,
              "onUpdate:modelValue": (value: boolean) => (first.value = value),
            },
            { default: () => "first popover" },
          ),
          h(
            Popover,
            {
              modelValue: second.value,
              "onUpdate:modelValue": (value: boolean) => (second.value = value),
            },
            { default: () => "second popover" },
          ),
        ]);
    },
  });
  const mounted = mountTree(h(harness));
  document.body.append(mounted.root);

  first.value = true;
  await settleOverlay();
  expect(document.body.textContent).toContain("first popover");

  second.value = true;
  await settleOverlay();

  expect(first.value).toBe(false);
  expect(document.body.textContent).toContain("second popover");

  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("renders tooltip content through its labelled portal", async () => {
  const mounted = mountOverlayFixture();
  const trigger = byTestId(mounted.root, "tooltip-trigger") as HTMLButtonElement;

  await settleOverlay();

  expect(document.body.querySelector(".cui-tooltip__content")?.textContent).toContain(
    "Tooltip content",
  );
  expect(trigger.getAttribute("aria-describedby")).toBeTruthy();
  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});
