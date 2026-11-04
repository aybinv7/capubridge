import { computed, shallowRef, type InjectionKey } from 'vue';

import {
  provideOverlayRootContext,
  type OverlayRootContext,
} from './overlayRootContext.ts';

export interface OverlayRootProps {
  /** Initial open state (uncontrolled). Default `false`. Ignored when `open` is provided. */
  defaultOpen?: boolean;
  /** Controlled open state. When provided, internal state is bypassed. */
  open?: boolean;
}

/**
 * Controlled/uncontrolled open state for the `*Root` compounds, matching upstream:
 * `open` provided means controlled (internal state bypassed), otherwise the Root owns the
 * state seeded from `defaultOpen`. Either way the change is announced so a consumer can
 * observe it.
 */
export function useOverlayRoot(
  key: InjectionKey<OverlayRootContext>,
  props: OverlayRootProps,
  onOpenChange: (open: boolean) => void,
): OverlayRootContext {
  const internalOpen = shallowRef(props.defaultOpen ?? false);
  const controlled = computed(() => props.open !== undefined);
  const open = computed(() =>
    props.open === undefined ? internalOpen.value : props.open,
  );

  function setOpen(next: boolean): void {
    if (!controlled.value) internalOpen.value = next;
    onOpenChange(next);
  }

  const context: OverlayRootContext = {
    anchor: shallowRef<HTMLElement>(),
    open,
    setOpen,
  };

  provideOverlayRootContext(key, context);

  return context;
}
