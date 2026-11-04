import { onMounted, onUnmounted, type Ref } from 'vue';

import { popoverContainerSelector } from '../components/overlay.contracts.ts';

export interface OverlayDismissOptions {
  closeOnOutsideClick: () => boolean;
  container: Ref<HTMLElement | undefined>;
  onClose: () => void;
  opened: Readonly<Ref<boolean>>;
}

export function useOverlayDismiss(options: OverlayDismissOptions): void {
  let wasPointerDown = false;
  let pointerDownInside = false;

  function onPointerDown(event: PointerEvent): void {
    wasPointerDown = true;
    const target = event.target;
    pointerDownInside = Boolean(
      target instanceof Node && options.container.value?.contains(target),
    );
  }

  function onDocumentClick(event: MouseEvent): void {
    if (!options.opened.value) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const container = options.container.value;
    if (container?.contains(target)) return;

    const targetOverlay = target.closest(popoverContainerSelector);
    if (targetOverlay) {
      const parentOverlayClicked = Boolean(
        container && targetOverlay.nextElementSibling === container,
      );
      if (!parentOverlayClicked) return;
    }

    if (!wasPointerDown) return;
    if (pointerDownInside) return;
    if (!target.closest('body')) return;
    if (!options.closeOnOutsideClick()) return;

    const nextSibling = container?.nextElementSibling;
    if (nextSibling?.matches(popoverContainerSelector)) return;

    options.onClose();
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('click', onDocumentClick);
  });

  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('click', onDocumentClick);
  });
}
