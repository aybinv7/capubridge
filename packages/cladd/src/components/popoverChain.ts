import {
  inject,
  onUnmounted,
  provide,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue';

import type { OverlayPhase } from '../foundations/contracts.ts';

export interface PopoverChainContext {
  register: (close: () => void) => () => void;
}

const popoverChainKey: InjectionKey<PopoverChainContext> = Symbol(
  'cladd-popover-chain',
);
const openTopLevelPopovers = new Set<() => void>();

export function usePopoverChain(options: {
  close: () => void;
  phase: Readonly<Ref<OverlayPhase>>;
}): void {
  const parent = inject(popoverChainKey, undefined);
  const childCloses = new Set<() => void>();
  let unregisterFromParent: (() => void) | undefined;

  provide(popoverChainKey, {
    register(close: () => void) {
      childCloses.add(close);
      return () => {
        childCloses.delete(close);
      };
    },
  });

  function close(): void {
    options.close();
  }

  function detach(): void {
    unregisterFromParent?.();
    unregisterFromParent = undefined;
    openTopLevelPopovers.delete(close);
  }

  watch(
    () => options.phase.value !== 'closed',
    (live) => {
      if (!live) {
        detach();
        return;
      }

      if (parent) {
        unregisterFromParent = parent.register(close);
        return;
      }

      for (const other of openTopLevelPopovers) other();
      openTopLevelPopovers.add(close);
    },
    { immediate: true },
  );

  watch(options.phase, (phase) => {
    if (phase !== 'closing') return;
    for (const closeChild of childCloses) closeChild();
  });

  onUnmounted(detach);
}
