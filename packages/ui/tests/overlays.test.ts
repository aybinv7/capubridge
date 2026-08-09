import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defineComponent, h, nextTick, ref } from "vue";
import { expect, test } from "vite-plus/test";

import OverlayFixture from "../fixtures/overlays/OverlayFixture.vue";
import { Popover } from "../src/index.ts";
import {
  backdropClasses,
  buildPopoverPositionStyle,
  dialogContentClasses,
  dialogHiddenClasses,
  dialogOpenedClasses,
  dialogSurfaceClasses,
  popoverContentClasses,
  popoverPositionConfigs,
  popoverPositions,
  popoverSurfaceClasses,
  tooltipOrigins,
  tooltipSurfaceClasses,
} from "../src/components/overlays/overlay.contracts.ts";
import {
  popupCardClasses,
  popupCardContentClasses,
  popupContainerClasses,
  popupContentClasses,
  popupStackTransform,
  popupWrapperClasses,
  popupWrapperClosedClasses,
  popupWrapperOpenedClasses,
} from "../src/components/overlays/popup.contracts.ts";
import { byTestId, click, mountTree } from "./support/mountTree.ts";

const colorsCss = readFileSync(join(process.cwd(), "src", "styles", "colors.css"), "utf8");
const stylesIndex = readFileSync(join(process.cwd(), "src", "styles", "index.css"), "utf8");
const safeAreasCss = readFileSync(join(process.cwd(), "src", "styles", "safe-areas.css"), "utf8");

test("keeps the overlay families off hand-authored CSS", () => {
  expect(stylesIndex).not.toContain("overlays.css");
});

test("locks the Cladd backdrop and dialog motion utility strings", () => {
  expect(backdropClasses).toBe("cui-backdrop fixed inset-0 z-50 bg-cui-backdrop/90");
  expect(dialogSurfaceClasses).toBe(
    "fixed top-1/2 left-1/2 z-50 w-80 max-w-full -translate-x-1/2 -translate-y-1/2 rounded-cui-dialog",
  );
  expect(dialogHiddenClasses).toBe("scale-75 opacity-0 duration-200 ease-out!");
  expect(dialogOpenedClasses).toBe(
    "scale-100 opacity-100 duration-500 ease-[cubic-bezier(0,1,0.2,1.1)]",
  );
  expect(dialogContentClasses).toBe("flex flex-col gap-4 p-4");
});

test("locks the upstream popover shadow and keeps tooltips shadowless", () => {
  expect(colorsCss).toContain("--shadow-cui-popover: 0 24px 64px -12px rgb(0 0 0 / 0.5);");
  expect(popoverSurfaceClasses).toBe(
    "pointer-events-auto absolute z-50 flex w-40 max-w-[calc(100vw-16px)] rounded-cui-popover shadow-cui-popover transition-[opacity,transform,scale] duration-0",
  );
  expect(popoverContentClasses).toBe("h-auto max-h-[70vh] w-full overflow-auto");
  expect(tooltipSurfaceClasses).not.toContain("shadow");
  expect(tooltipSurfaceClasses).toBe(
    "pointer-events-none fixed max-h-[50vh] w-max max-w-50 overflow-auto rounded-cui-tooltip text-cui-xs leading-normal font-medium transition-[opacity,transform,scale]",
  );
  expect(tooltipOrigins).toEqual({ top: "origin-bottom", bottom: "origin-top" });
});

test("locks the Cladd popup layer, wrapper and card utility strings", () => {
  expect(popupContainerClasses).toBe(
    "cui-popup fixed inset-0 z-50 flex flex-col justify-center overflow-hidden",
  );
  expect(popupWrapperClasses).toBe(
    "cui-popup-wrapper absolute inset-0 z-50 h-fit max-h-full self-center overflow-auto pt-safe-12 pb-safe-12",
  );
  expect(popupWrapperOpenedClasses).toBe("duration-500 ease-[cubic-bezier(0,1,0.2,1)]");
  expect(popupWrapperClosedClasses).toBe(
    "translate-y-[100vh] scale-x-65 duration-200 ease-[ease-in]",
  );
  expect(popupContentClasses).toBe(
    "cui-popup-content pointer-events-auto relative mx-auto flex min-h-full w-full max-w-162 flex-col justify-center gap-2",
  );
  expect(popupCardClasses).toBe("rounded-cui-popup");
  expect(popupCardContentClasses).toBe("!h-auto w-full p-4");
  // Stacked popups step back 16px and 10% per level behind the top one.
  expect(popupStackTransform(1)).toBe("translateY(-16px) scale(0.9)");
  expect(popupStackTransform(2)).toBe("translateY(-32px) scale(0.8)");
  // The numbered safe-area utilities the wrapper depends on are hand-authored upstream too.
  expect(safeAreasCss).toContain("@utility pt-safe-*");
  expect(safeAreasCss).toContain("@utility pb-safe-*");
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
    origin: "origin-bottom-left",
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
  expect(style.transformOrigin).toBeUndefined();
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

  await click(trigger);
  await settleOverlay();
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');

  expect(dialog).not.toBeNull();
  expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
  expect(dialog?.getAttribute("aria-describedby")).toBeTruthy();
  expect(document.body.textContent).toContain("Dialog title");
  // The dialog carries no theme hook of its own: it teleports into the overlays root, which is
  // inside the app's themed element, so the cascade reaches it.
  expect(dialog?.getAttribute("data-cui-theme")).toBeNull();
  expect(dialog?.classList.contains("cui-color-brand")).toBe(false);
  expect(dialog?.closest("#app")).not.toBeNull();

  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("keeps nested popover inside its parent dialog layer", async () => {
  const mounted = mountOverlayFixture();
  await click(byTestId(mounted.root, "dialog-trigger"));
  await settleOverlay();
  const nestedTrigger = document.body.querySelector<HTMLElement>('[data-testid="nested-trigger"]');

  if (nestedTrigger) await click(nestedTrigger);
  await settleOverlay();

  expect(document.body.querySelector('.cui-popover [data-part="content"]')).not.toBeNull();
  expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});

test("guards destructive confirmation with exact text", async () => {
  const mounted = mountOverlayFixture();
  await click(byTestId(mounted.root, "guarded-dialog-trigger"));
  await settleOverlay();
  const confirm = document.body.querySelector<HTMLButtonElement>('[data-part="confirm"]');
  const input = document.body.querySelector<HTMLInputElement>('[data-part="input"] input');

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

  await click(trigger);
  await settleOverlay();
  const content = document.body.querySelector<HTMLElement>('.cui-popover [data-part="content"]');

  expect(content).not.toBeNull();
  expect(content?.getAttribute("data-position")).toBe("right-end");
  expect(content?.style.positionArea).toBe("center right");
  expect(content?.classList.contains("origin-bottom-left")).toBe(true);

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
              open: first.value,
              "onUpdate:open": (value: boolean) => (first.value = value),
            },
            { default: () => "first popover" },
          ),
          h(
            Popover,
            {
              open: second.value,
              "onUpdate:open": (value: boolean) => (second.value = value),
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

  expect(document.body.querySelector(".cui-tooltip")?.textContent).toContain("Tooltip content");
  expect(trigger.getAttribute("aria-describedby")).toBeTruthy();
  cleanupOverlayFixture(mounted.root, () => mounted.app.unmount());
});
