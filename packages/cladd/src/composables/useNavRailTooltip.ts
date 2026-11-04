import { onUnmounted, shallowRef, watch, type Ref } from 'vue';

import {
  clearTooltipGlobalTimeout,
  collapseTooltipGlobalTimeout,
  getTooltipGlobalTimeout,
  scheduleTooltipGlobalTimeoutReset,
} from '../components/tooltipTimeout.ts';

export interface NavRailTooltipTrigger {
  open: Ref<boolean>;
  onFocusin: (event: FocusEvent) => void;
  onFocusout: () => void;
  onKeydown: (event: KeyboardEvent) => void;
  onPointerdown: () => void;
  onPointerenter: (event: PointerEvent) => void;
  onPointerleave: () => void;
}

function isFocusVisible(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * Hover and keyboard-focus behaviour of a rail item's side tooltip. Pointer hover shares Cladd's
 * global tooltip delay, so moving down the rail after the first tooltip shows the next one at
 * once; keyboard focus shows it immediately; a press, Escape or leaving hides it.
 */
export function useNavRailTooltip(
  enabled: Readonly<Ref<boolean>>,
): NavRailTooltipTrigger {
  const open = shallowRef(false);
  let timer: number | undefined;

  function cancelTimer(): void {
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timer = undefined;
  }

  function show(delay: number): void {
    if (!enabled.value) return;
    clearTooltipGlobalTimeout();
    cancelTimer();
    timer = window.setTimeout(() => {
      timer = undefined;
      open.value = true;
      collapseTooltipGlobalTimeout();
    }, delay);
  }

  function hide(): void {
    cancelTimer();
    if (!open.value) return;
    open.value = false;
    scheduleTooltipGlobalTimeoutReset();
  }

  watch(enabled, (value) => {
    if (!value) hide();
  });

  onUnmounted(cancelTimer);

  return {
    open,
    onFocusin: (event) => {
      if (isFocusVisible(event.target)) show(0);
    },
    onFocusout: hide,
    onKeydown: (event) => {
      if (event.key === 'Escape') hide();
    },
    onPointerdown: hide,
    onPointerenter: (event) => {
      if (event.pointerType === 'mouse') show(getTooltipGlobalTimeout());
    },
    onPointerleave: hide,
  };
}
