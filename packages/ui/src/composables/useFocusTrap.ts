import { watchEffect, type Ref } from "vue";

import { getFocusTrapFocusable, isTopmostModalLayer } from "./focusTrap.contracts.ts";

export type FocusTrapInitialFocus =
  | (() => HTMLElement | null | undefined)
  | Ref<HTMLElement | null | undefined>;

export interface FocusTrapOptions {
  active: Readonly<Ref<boolean>>;
  container: Ref<HTMLElement | undefined>;
  initialFocus?: FocusTrapInitialFocus;
  restoreFocus?: boolean;
  setInitialFocus?: boolean;
}

export function useFocusTrap(options: FocusTrapOptions): void {
  const { restoreFocus = true, setInitialFocus = true } = options;

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

  watchEffect(
    (onCleanup) => {
      if (!options.active.value) return;
      const resolved = options.container.value;
      if (!resolved) return;
      const container: HTMLElement = resolved;

      const previouslyFocused = document.activeElement as HTMLElement | null;

      if (!container.contains(document.activeElement) && setInitialFocus) {
        focusInitial(container);
      }

      function onKeydown(event: KeyboardEvent): void {
        if (event.key !== "Tab") return;
        if (!container.isConnected) return;
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

      document.addEventListener("keydown", onKeydown);

      onCleanup(() => {
        document.removeEventListener("keydown", onKeydown);
        if (!restoreFocus || !previouslyFocused) return;
        if (typeof previouslyFocused.focus !== "function") return;
        if (!document.contains(previouslyFocused)) return;
        previouslyFocused.focus();
      });
    },
    { flush: "post" },
  );
}
