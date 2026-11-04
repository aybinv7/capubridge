import { onUnmounted, shallowRef, watch, watchEffect, type Ref } from 'vue';

import type { OverlayPhase } from '../foundations/contracts.ts';
import { nextTick } from '../shared/nextTick.ts';

export interface OverlayLifecycleOptions {
  closeOnEscape?: () => boolean;
  element: Ref<HTMLElement | undefined>;
  lazy?: () => boolean;
  onClose?: () => void;
  onClosed?: () => void;
  onOpen?: (element?: HTMLElement) => void;
  onOpened?: (element?: HTMLElement) => void;
  phase: Readonly<Ref<OverlayPhase>>;
  setPhase: (phase: OverlayPhase) => void;
}

export interface OverlayLifecycle {
  close: () => void;
  open: () => void;
  opened: Readonly<Ref<boolean>>;
}

function noop(): void {}

// Wraps the upstream-ported `nextTick` (double-rAF) with cancellation, which
// Vue's `watchEffect`/`onCleanup` needs and React's effect model doesn't -
// React never fires a stale rAF callback into a torn-down effect closure the
// way an uncancelled Vue effect can.
function runAfterTwoFrames(callback: () => void): () => void {
  let cancelled = false;
  nextTick(() => {
    if (!cancelled) callback();
  });
  return () => {
    cancelled = true;
  };
}

function isElementVisible(element: HTMLElement): boolean {
  const check = (element as { checkVisibility?: () => boolean })
    .checkVisibility;
  return typeof check === 'function' ? check.call(element) : false;
}

export function useOverlayLifecycle(
  options: OverlayLifecycleOptions,
): OverlayLifecycle {
  const opened = shallowRef(false);
  let initiallyOpened = false;
  let closedFired = false;
  let cancelActivation = noop;
  let cancelOpenCallback = noop;
  let cancelLazyOpen = noop;

  function fireClosed(): void {
    if (closedFired) return;
    closedFired = true;
    options.setPhase('closed');
    options.onClosed?.();
  }

  function close(): void {
    opened.value = false;
    options.onClose?.();
    options.setPhase('closing');
  }

  function open(): void {
    // A deferred open (the activation rAF) must not revive an overlay that was
    // closed before it ran.
    if (options.phase.value === 'closing') return;
    closedFired = false;
    initiallyOpened = true;
    cancelLazyOpen();

    if (options.lazy?.()) {
      cancelLazyOpen = runAfterTwoFrames(() => {
        opened.value = true;
      });
      return;
    }

    opened.value = true;
  }

  function completeTransition(element: HTMLElement): void {
    const phase = options.phase.value;

    if (phase === 'closing') {
      fireClosed();
      return;
    }

    if (phase === 'opening' || phase === 'opened') {
      options.onOpened?.(element);
      if (phase === 'opening') options.setPhase('opened');
    }
  }

  function onTransitionEnd(event: Event): void {
    const element = options.element.value;
    if (!element || event.target !== element) return;
    completeTransition(element);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (options.closeOnEscape && !options.closeOnEscape()) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  watch(
    () => options.phase.value !== 'closed',
    (active, _previous, onCleanup) => {
      cancelActivation();

      if (!active) {
        opened.value = false;
        initiallyOpened = false;
        closedFired = false;
        return;
      }

      const frame = requestAnimationFrame(() => {
        open();
      });

      cancelActivation = () => cancelAnimationFrame(frame);
      document.addEventListener('keydown', onKeydown);
      onCleanup(() => document.removeEventListener('keydown', onKeydown));
    },
    { immediate: true },
  );

  watch(options.phase, (phase) => {
    if (phase === 'closing') {
      if (opened.value) {
        opened.value = false;
        options.onClose?.();
      }
      return;
    }

    if (phase === 'opening' || phase === 'opened') {
      if (!opened.value && initiallyOpened) open();
    }
  });

  watch(opened, (value) => {
    cancelOpenCallback();
    if (!value) return;
    cancelOpenCallback = runAfterTwoFrames(() =>
      options.onOpen?.(options.element.value),
    );
  });

  watchEffect((onCleanup) => {
    const element = options.element.value;
    const active = options.phase.value !== 'closed';
    if (!element || !active) return;

    if (!isElementVisible(element)) {
      completeTransition(element);
      return;
    }

    element.addEventListener('transitionend', onTransitionEnd);
    onCleanup(() =>
      element.removeEventListener('transitionend', onTransitionEnd),
    );
  });

  // Closing without a running transition (closed before it ever showed, or
  // styles that do not animate) never gets a transitionend, which would leave
  // the overlay mounted in 'closing' forever. getAnimations() flushes styles,
  // so a transition the closed state just started is already listed.
  watch(
    [options.phase, opened],
    ([phase, isOpened]) => {
      if (phase !== 'closing' || isOpened) return;
      const element = options.element.value;
      if (!element || typeof element.getAnimations !== 'function') return;
      if (typeof CSSTransition === 'undefined') return;
      const transitioning = element
        .getAnimations()
        .some((animation) => animation instanceof CSSTransition);
      if (!transitioning) fireClosed();
    },
    { flush: 'post' },
  );

  onUnmounted(() => {
    cancelActivation();
    cancelOpenCallback();
    cancelLazyOpen();
    document.removeEventListener('keydown', onKeydown);
    if (options.phase.value === 'closing') fireClosed();
  });

  return { close, open, opened };
}
