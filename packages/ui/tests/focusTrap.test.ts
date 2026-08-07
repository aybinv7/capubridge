import {
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
  shallowRef,
  type Ref,
  type VNode,
} from "vue";
import { expect, test } from "vite-plus/test";

import {
  focusTrapFocusableSelector,
  focusTrapFocusableSelectors,
  focusTrapTopmostModalSelector,
  getFocusTrapFocusable,
  isFocusTrapVisible,
} from "../src/composables/focusTrap.contracts.ts";
import { useFocusTrap } from "../src/composables/useFocusTrap.ts";
import { byTestId, type MountedTree } from "./support/mountTree.ts";

interface TrapHarnessConfig {
  children?: () => VNode[];
  containerClass?: string;
  containerTabindex?: string;
  initialFocusSelector?: string;
  open: Ref<boolean>;
  restoreFocus?: boolean;
  setInitialFocus?: boolean;
}

function defaultChildren(): VNode[] {
  return ["first", "middle", "last"].map((label) =>
    h("button", { "data-label": label, type: "button" }, label),
  );
}

function createTrapHarness(config: TrapHarnessConfig) {
  return defineComponent({
    setup() {
      const container = shallowRef<HTMLElement>();
      const initialFocusSelector = config.initialFocusSelector;

      useFocusTrap({
        container,
        initialFocus: initialFocusSelector
          ? () => container.value?.querySelector<HTMLElement>(initialFocusSelector)
          : undefined,
        open: config.open,
        restoreFocus: config.restoreFocus,
        setInitialFocus: config.setInitialFocus,
      });

      return () =>
        config.open.value
          ? h(
              "div",
              {
                class: config.containerClass ?? "cui-dialog__container",
                "data-testid": "trap-container",
                ref: container,
                tabindex: config.containerTabindex,
              },
              (config.children ?? defaultChildren)(),
            )
          : null;
    },
  });
}

function mountConnectedTree(vnode: VNode): MountedTree {
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp({ render: () => vnode });
  app.mount(root);
  return { app, root };
}

function mountHarness(config: TrapHarnessConfig): MountedTree {
  return mountConnectedTree(h(createTrapHarness(config)));
}

function cleanupTree(mounted: MountedTree): void {
  mounted.app.unmount();
  mounted.root.remove();
}

function appendTrigger(label: string): HTMLButtonElement {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.dataset.label = label;
  document.body.append(trigger);
  return trigger;
}

function trapContainer(mounted: MountedTree): HTMLElement {
  return byTestId(mounted.root, "trap-container");
}

function trapButton(mounted: MountedTree, label: string): HTMLButtonElement {
  const button = trapContainer(mounted).querySelector<HTMLButtonElement>(`[data-label="${label}"]`);

  if (!button) {
    throw new Error(`Missing trap button: ${label}`);
  }

  return button;
}

function pressTab(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Tab",
    shiftKey,
  });
  const target = (document.activeElement as HTMLElement | null) ?? document.body;
  target.dispatchEvent(event);
  return event;
}

test("locks the Cladd focusable selector list", () => {
  expect([...focusTrapFocusableSelectors]).toEqual([
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    "audio[controls]",
    "video[controls]",
    "iframe",
    "object",
    "embed",
    "summary",
  ]);
  expect(focusTrapFocusableSelector).toBe(focusTrapFocusableSelectors.join(","));
  expect(focusTrapTopmostModalSelector).toBe(".cui-dialog__container, .cui-popup__container");
});

test("filters focusable candidates through the Cladd visibility predicate", () => {
  const container = document.createElement("div");
  container.innerHTML = [
    '<a href="#anchor" data-label="anchor">anchor</a>',
    '<button type="button" hidden data-label="hidden">hidden</button>',
    '<button type="button" aria-hidden="true" data-label="aria-hidden">aria</button>',
    '<input type="hidden" data-label="hidden-input" />',
    '<input type="text" disabled data-label="disabled-input" />',
    '<div contenteditable="true" data-label="editable">editable</div>',
    '<div tabindex="-1" data-label="excluded-tabindex">excluded</div>',
    '<summary data-label="summary">summary</summary>',
    '<iframe data-label="iframe"></iframe>',
  ].join("");
  document.body.append(container);

  expect(getFocusTrapFocusable(container).map((element) => element.dataset.label)).toEqual([
    "anchor",
    "editable",
    "summary",
    "iframe",
  ]);

  const anchor = container.querySelector<HTMLElement>('[data-label="anchor"]');
  const ariaHidden = container.querySelector<HTMLElement>('[data-label="aria-hidden"]');

  expect(anchor && isFocusTrapVisible(anchor)).toBe(true);
  expect(ariaHidden && isFocusTrapVisible(ariaHidden)).toBe(false);

  container.remove();
});

test("moves focus into the container when mounted already open", async () => {
  const outside = appendTrigger("outside");
  outside.focus();
  const mounted = mountHarness({ open: ref(true) });
  await nextTick();

  expect(document.activeElement).toBe(trapButton(mounted, "first"));

  cleanupTree(mounted);
  outside.remove();
});

test("honors the initial focus target inside the container", async () => {
  const mounted = mountHarness({
    initialFocusSelector: '[data-label="middle"]',
    open: ref(true),
  });
  await nextTick();

  expect(document.activeElement).toBe(trapButton(mounted, "middle"));

  cleanupTree(mounted);
});

test("leaves focus untouched when initial focus is disabled", async () => {
  const outside = appendTrigger("outside");
  outside.focus();
  const mounted = mountHarness({ open: ref(true), setInitialFocus: false });
  await nextTick();

  expect(document.activeElement).toBe(outside);

  cleanupTree(mounted);
  outside.remove();
});

test("wraps Tab and Shift+Tab at the container boundaries", async () => {
  const mounted = mountHarness({ open: ref(true) });
  await nextTick();

  trapButton(mounted, "last").focus();
  const forward = pressTab();

  expect(forward.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trapButton(mounted, "first"));

  const backward = pressTab(true);

  expect(backward.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trapButton(mounted, "last"));

  trapButton(mounted, "middle").focus();
  const untrapped = pressTab();

  expect(untrapped.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(trapButton(mounted, "middle"));

  cleanupTree(mounted);
});

test("pulls focus back inside when Tab arrives from outside the container", async () => {
  const outside = appendTrigger("outside");
  const mounted = mountHarness({ open: ref(true) });
  await nextTick();

  outside.focus();
  expect(pressTab().defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trapButton(mounted, "first"));

  outside.focus();
  expect(pressTab(true).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trapButton(mounted, "last"));

  cleanupTree(mounted);
  outside.remove();
});

test("falls back to the container when nothing inside is focusable", async () => {
  const mounted = mountHarness({
    children: () => [h("span", "no focusable content")],
    open: ref(true),
  });
  await nextTick();
  const container = trapContainer(mounted);

  expect(container.getAttribute("tabindex")).toBe("-1");
  expect(document.activeElement).toBe(container);

  const event = pressTab();

  expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(container);

  cleanupTree(mounted);
});

test("keeps a preset container tabindex untouched", async () => {
  const mounted = mountHarness({
    children: () => [h("span", "no focusable content")],
    containerTabindex: "0",
    open: ref(true),
  });
  await nextTick();
  const container = trapContainer(mounted);

  expect(container.getAttribute("tabindex")).toBe("0");
  expect(document.activeElement).toBe(container);

  cleanupTree(mounted);
});

test("skips trapping when the container is not the topmost modal layer", async () => {
  const mounted = mountHarness({ open: ref(true) });
  await nextTick();
  const laterModal = document.createElement("div");
  laterModal.className = "cui-popup__container";
  document.body.append(laterModal);

  trapButton(mounted, "last").focus();
  const event = pressTab();

  expect(event.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(trapButton(mounted, "last"));

  laterModal.remove();
  cleanupTree(mounted);
});

test("restores focus to the trigger when the trap closes", async () => {
  const trigger = appendTrigger("trigger");
  trigger.focus();
  const open = ref(true);
  const mounted = mountHarness({ open });
  await nextTick();

  expect(document.activeElement).toBe(trapButton(mounted, "first"));

  open.value = false;
  await nextTick();

  expect(document.activeElement).toBe(trigger);

  cleanupTree(mounted);
  trigger.remove();
});

test("keeps focus in place when focus restoration is disabled", async () => {
  const trigger = appendTrigger("trigger");
  trigger.focus();
  const open = ref(true);
  const mounted = mountHarness({ open, restoreFocus: false });
  await nextTick();

  expect(document.activeElement).toBe(trapButton(mounted, "first"));

  open.value = false;
  await nextTick();

  expect(document.activeElement).not.toBe(trigger);

  cleanupTree(mounted);
  trigger.remove();
});

test("skips restoration when the previously focused element left the document", async () => {
  const trigger = appendTrigger("trigger");
  trigger.focus();
  const open = ref(true);
  const mounted = mountHarness({ open });
  await nextTick();

  trigger.remove();
  open.value = false;
  await nextTick();

  expect(document.activeElement).not.toBe(trigger);
  expect(document.body.contains(document.activeElement)).toBe(true);

  cleanupTree(mounted);
});

test("restores focus and drops listeners on unmount", async () => {
  const trigger = appendTrigger("trigger");
  trigger.focus();
  const mounted = mountHarness({ open: ref(true) });
  await nextTick();

  cleanupTree(mounted);
  await nextTick();

  expect(document.activeElement).toBe(trigger);

  const event = pressTab();

  expect(event.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(trigger);

  trigger.remove();
});
