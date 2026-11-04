import { onUnmounted, shallowRef, type Ref } from 'vue';

import { resolveOverlayElement } from '../components/overlay.contracts.ts';

let anchorSequence = 0;

export interface AnchorPosition {
  anchorElement: Readonly<Ref<HTMLElement | undefined>>;
  anchorName: Readonly<Ref<string>>;
  setAnchorElement: (value: unknown) => void;
}

export function useAnchorPosition(): AnchorPosition {
  anchorSequence += 1;
  const anchorElement = shallowRef<HTMLElement>();
  const anchorName = shallowRef(`--cladd-anchor-${anchorSequence}`);
  const ownedElements = new Set<HTMLElement>();

  function setAnchorElement(value: unknown): void {
    const element = resolveOverlayElement(value);
    anchorElement.value = element;
    if (!element) return;

    const existing = element.style.getPropertyValue('anchor-name');
    if (existing) {
      anchorName.value = existing;
      return;
    }

    element.style.setProperty('anchor-name', anchorName.value);
    ownedElements.add(element);
  }

  onUnmounted(() => {
    for (const element of ownedElements) {
      element.style.removeProperty('anchor-name');
    }
    ownedElements.clear();
  });

  return { anchorElement, anchorName, setAnchorElement };
}
