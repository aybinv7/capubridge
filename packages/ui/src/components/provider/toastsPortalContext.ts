import { inject, provide, ref, type Component, type InjectionKey, type Ref } from "vue";

import type { UiAccent } from "../../foundations/contracts.ts";

/**
 * Shape of a queued toast in the imperative toast portal. Mirrors `Toast`'s props but adds an
 * `id` (used as the render key + lifecycle handle) and an internal `removed` flag.
 */
export interface ToastsPortalData {
  className?: string;
  /** Render the auto close button. Default `true` (in `Toast`). */
  closeButton?: boolean;
  color?: UiAccent;
  /** Icon component rendered before the text content. Receives `iconProps`. */
  icon?: Component;
  iconProps?: Record<string, unknown>;
  /** Stable identifier — also used as the render key for the toast list. */
  id: string;
  /** Fires after the close transition completes. */
  onClosed?: (closed: boolean) => void;
  /** Internal flag set after `onClosed` fires once — prevents double-removal from the queue. */
  removed?: boolean;
  text: string;
  /** Auto-close timeout in ms (`0` disables). */
  timeout?: number;
  title: string;
}

export interface ToastsPortalContext {
  data: Ref<ToastsPortalData[]>;
  state: Ref<Record<string, boolean>>;
}

const toastsPortalContextKey: InjectionKey<ToastsPortalContext> = Symbol("cui-toasts-portal");

const fallback: ToastsPortalContext = {
  data: ref<ToastsPortalData[]>([]),
  state: ref<Record<string, boolean>>({}),
};

export function provideToastsPortalContext(): ToastsPortalContext {
  const context: ToastsPortalContext = {
    data: ref<ToastsPortalData[]>([]),
    state: ref<Record<string, boolean>>({}),
  };
  provide(toastsPortalContextKey, context);
  return context;
}

export function useToastsPortalContext(): ToastsPortalContext {
  return inject(toastsPortalContextKey, fallback);
}
