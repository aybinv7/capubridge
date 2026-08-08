import type { Component } from "vue";

import { useToastsPortalContext } from "../components/provider/toastsPortalContext.ts";
import type { UiAccent } from "../foundations/contracts.ts";

export interface UseToastOptions {
  /** Extra classes applied to the toast root `Surface`. */
  className?: string;
  /** Render the auto close button on the right. Default `true`. */
  closeButton?: boolean;
  /** Accent color token. Default `'neutral'`. */
  color?: UiAccent;
  /** Icon component rendered before the text content. Receives `iconProps`. */
  icon?: Component;
  iconProps?: Record<string, unknown>;
  /** Fires after the close transition completes — use for unmount cleanup. */
  onClosed?: (closed: boolean) => void;
  /** Toast body text — smaller line under `title`. */
  text?: string;
  /** Auto-close after this many ms. Pass `0` to disable auto-close. Default `5000`. */
  timeout?: number;
  /** Toast title — bold line above `text`. */
  title?: string;
}

/** Imperative handle onto the `ToastsPortal` that `UiProvider` renders. */
export function useToast(): (options: UseToastOptions) => void {
  const { data, state } = useToastsPortalContext();

  return ({
    className,
    closeButton,
    color,
    icon,
    iconProps,
    onClosed,
    text,
    timeout,
    title,
  }: UseToastOptions) => {
    const id = Math.random().toString(36).slice(2, 11);
    data.value = [
      ...data.value,
      {
        className,
        closeButton,
        color,
        icon,
        iconProps,
        id,
        onClosed,
        text: text as string,
        timeout,
        title: title as string,
      },
    ];
    state.value = { ...state.value, [id]: true };
  };
}
