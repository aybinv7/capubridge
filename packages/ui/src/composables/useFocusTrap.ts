import { onMounted, onUnmounted, shallowRef, watch, type Ref } from "vue";

import { getFocusTrapFocusable, isTopmostModalLayer } from "./focusTrap.contracts.ts";

export type FocusTrapInitialFocus =
  | (() => HTMLElement | null | undefined)
  | Ref<HTMLElement | null | undefined>;

export interface FocusTrapOptions {
  container: Ref<HTMLElement | undefined>;
  initialFocus?: FocusTrapInitialFocus;
  open: Ref<boolean>;
  restoreFocus?: boolean;
  setInitialFocus?: boolean;
}

export function useFocusTrap(options: FocusTrapOptions): void {
  const { restoreFocus = true, setInitialFocus = true } = options;
  const trapped = shallowRef<HTMLElement>();
  const previouslyFocused = shallowRef<HTMLElement>();

  function resolveInitialFocus(): HTMLElement | null | undefined {
    const initialFocus = options.initialFocus;
    if (!initialFocus) return undefined;
    return typeof initialFocus === "function" ? initialFocus() : initialFocus.value;
  }

  function focusInitial(container: HTMLElement): void {
    const initial = resolveInitialFocus();
    if (initial && container.contains(initial)) {
      initial.focus();
      return;
    }

    const focusable = getFocusTrapFocusable(container);
    if (focusable.length > 0) {
      focusable[0].focus();
      return;
    }

    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    container.focus();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab") return;
    const container = trapped.value;
    if (!container || !container.isConnected) return;
    if (!isTopmostModalLayer(container)) return;

    const focusable = getFocusTrapFocusable(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  function activate(): void {
    if (trapped.value) return;
    const container = options.container.value;
    if (!container) return;

    trapped.value = container;
    previouslyFocused.value = (document.activeElement as HTMLElement | null) ?? undefined;

    if (setInitialFocus && !container.contains(document.activeElement)) {
      focusInitial(container);
    }

    document.addEventListener("keydown", onKeydown);
  }

  function deactivate(): void {
    if (!trapped.value) return;
    trapped.value = undefined;
    document.removeEventListener("keydown", onKeydown);

    const previous = previouslyFocused.value;
    previouslyFocused.value = undefined;
    if (!restoreFocus || !previous) return;
    if (typeof previous.focus !== "function" || !document.contains(previous)) return;
    previous.focus();
  }

  function sync(open: boolean): void {
    if (open) {
      activate();
      return;
    }
    deactivate();
  }

  watch(options.open, sync, { flush: "post" });
  onMounted(() => sync(options.open.value));
  onUnmounted(deactivate);
}
