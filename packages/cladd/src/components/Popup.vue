<script setup lang="ts">
import { computed, shallowRef, useAttrs, useSlots, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useFocusTrap } from '../composables/useFocusTrap.ts';
import { useOverlayLifecycle } from '../composables/useOverlayLifecycle.ts';
import { useOverlayPhase } from '../composables/useOverlayPhase.ts';
import { provideSurfaceColorReset } from '../contexts/surfaceContext.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import Backdrop from './Backdrop.vue';
import Button from './Button.vue';
import CloseIcon from './icons/CloseIcon.vue';
import {
  overlayTriggerClasses,
  resolveOverlayElement,
} from './overlay.contracts.ts';
import {
  popupRootContextKey,
  useOverlayRootContext,
} from './overlayRootContext.ts';
import { cloneTriggerNode } from './overlayTrigger.ts';
import {
  popupBackdropClasses,
  popupBackdropClosedClasses,
  popupBackdropOpenedClasses,
  popupCloseButtonContentClasses,
  popupCloseWrapperClasses,
  popupCloseWrapperContentClasses,
  popupContainerClasses,
  popupContainerSelector,
  popupContentClasses,
  popupContentSelector,
  popupChildOverlaySelector,
  popupHeaderClasses,
  popupHeaderLeftClasses,
  popupHeaderRightClasses,
  popupInsideClickSelector,
  popupOpenedMarkerClasses,
  popupStackTransform,
  popupStackTransformOrigin,
  popupStackTransitionDuration,
  popupWrapperClasses,
  popupWrapperClosedClasses,
  popupWrapperOpenedClasses,
  type PopupProps,
} from './popup.contracts.ts';
import Surface from './Surface.vue';
import VNodeRenderer from './VNodeRenderer.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopupProps>(), {
  ariaDescribedby: undefined,
  ariaLabel: undefined,
  ariaLabelledby: undefined,
  backdrop: undefined,
  backdropClassName: undefined,
  closeButton: undefined,
  closeButtonColor: undefined,
  closeOnBackdropClick: undefined,
  closeOnEscape: undefined,
  contentClassName: undefined,
  header: undefined,
  headerClassName: undefined,
  inertContainer: undefined,
  lazy: undefined,
  root: undefined,
  wrapClassName: undefined,
});

defineSlots<{
  beforeContent?: () => unknown;
  closeButtonContent?: () => unknown;
  default?: (props: { close: () => void }) => unknown;
  headerLeft?: () => unknown;
  headerRight?: () => unknown;
  trigger?: () => unknown;
}>();

const emit = defineEmits<{
  closeButtonClick: [];
  closed: [];
  closing: [];
  opened: [];
  opening: [];
}>();

const modelOpen = defineModel<boolean | undefined>('open', {
  default: undefined,
});
const slots = useSlots();
const attrs = useAttrs();
const ui = useUiContext();
const root = useOverlayRootContext(popupRootContextKey);
const container = shallowRef<HTMLElement>();
const wrapper = shallowRef<HTMLElement>();
const d = useComponentDefaults('Popup', props, {
  backdrop: true,
  closeButton: true,
  closeOnBackdropClick: true,
  closeOnEscape: true,
  header: true,
  inertContainer: '.app-container',
  lazy: false,
});
const pointer = {
  distance: 0,
  moved: false,
  startPositions: [0, 0] as [number, number],
  target: null as EventTarget | null,
  touched: false,
};

// Own `open` wins, then the surrounding PopupRoot's state, then `false`.
const model = computed<boolean>({
  get: () => modelOpen.value ?? root?.open.value ?? false,
  set: (value) => {
    if (modelOpen.value !== undefined || !root) modelOpen.value = value;
    else root.setOpen(value);
  },
});

const { phase, setPhase } = useOverlayPhase(model);
const mounted = computed(() => phase.value !== 'closed');

function close(): void {
  model.value = false;
}

function open(): void {
  model.value = true;
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(popupChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => d.value.closeOnEscape && !hasChildOverlay(),
  element: wrapper,
  lazy: () => d.value.lazy,
  onClose: () => emit('closing'),
  onClosed: () => emit('closed'),
  onOpen: () => emit('opening'),
  onOpened: () => emit('opened'),
  phase,
  setPhase,
});

useFocusTrap({ active: opened, container, setInitialFocus: false });

const teleportTarget = computed(() => d.value.root ?? ui.overlaysRoot.value);
const containerClass = computed(() =>
  cn(
    popupContainerClasses,
    opened.value && popupOpenedMarkerClasses,
    attrs.class,
  ),
);
const backdropClass = computed(() =>
  cn(
    popupBackdropClasses,
    opened.value ? popupBackdropOpenedClasses : popupBackdropClosedClasses,
    d.value.backdropClassName,
  ),
);
const wrapperClass = computed(() =>
  cn(
    popupWrapperClasses,
    opened.value && popupWrapperOpenedClasses,
    !opened.value && popupWrapperClosedClasses,
    d.value.wrapClassName,
  ),
);
const contentClass = computed(() =>
  cn(popupContentClasses, d.value.contentClassName),
);
const containerAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

function inertTarget(): HTMLElement | null {
  if (!d.value.inertContainer) return null;
  return document.querySelector<HTMLElement>(d.value.inertContainer);
}

function previousPopups(): Element[] {
  const element = container.value;
  const parent = element?.parentElement;
  if (!element || !parent) return [];
  const all = [...parent.children].filter((child) =>
    child.matches(popupContainerSelector),
  );
  return all.slice(0, all.indexOf(element));
}

// Stacked popups: every popup behind the top one is pushed up and scaled down a step.
watch(opened, (value) => {
  const element = container.value;
  if (!element) return;
  const previous = previousPopups();
  previous.forEach((popupEl, index) => {
    const step = value ? previous.length - index : previous.length - index - 1;
    const contentEl = popupEl.querySelector<HTMLElement>(popupContentSelector);
    if (!contentEl) return;
    contentEl.style.transformOrigin = popupStackTransformOrigin;
    contentEl.style.transform = popupStackTransform(step);
    contentEl.style.transitionDuration = popupStackTransitionDuration;
  });
  const inert = inertTarget();
  if (!inert) return;
  if (value) inert.inert = true;
  else if (previous.length === 0) inert.inert = false;
});

watch(mounted, (value) => {
  if (value) return;
  const inert = inertTarget();
  if (inert && document.querySelectorAll(popupContainerSelector).length === 0)
    inert.inert = false;
});

function onPointer(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return;
  if (event.type === 'pointerdown') {
    pointer.touched = true;
    pointer.moved = false;
    pointer.target = event.target;
    pointer.startPositions = [event.pageX, event.pageY];
  }
  if (event.type === 'pointermove') {
    pointer.moved = true;
    const [x, y] = pointer.startPositions;
    pointer.distance = ((event.pageX - x) ** 2 + (event.pageY - y) ** 2) ** 0.5;
  }
  if (event.type === 'pointerup' && pointer.distance < 10) {
    pointer.moved = false;
  }
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (
    target.closest(popupInsideClickSelector) ||
    !document.documentElement.contains(target)
  )
    return;
  const inAnotherPopup =
    target.closest(popupContainerSelector) &&
    container.value !== target.closest(popupContainerSelector);
  if (inAnotherPopup) return;
  if (
    (pointer.target && pointer.target !== target) ||
    (pointer.target && pointer.moved)
  )
    return;
  if (!d.value.closeOnBackdropClick) return;
  close();
}

function onCloseButtonClick(): void {
  emit('closeButtonClick');
  close();
}

function setWrapper(value: unknown): void {
  wrapper.value = resolveOverlayElement(value);
}

const triggerNode = computed(() =>
  cloneTriggerNode(slots.trigger?.(), { onClick: open }),
);

provideSurfaceColorReset();

defineExpose({ close });
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span v-else-if="slots.trigger" :class="overlayTriggerClasses" @click="open">
    <slot name="trigger" />
  </span>
  <Teleport :to="teleportTarget">
    <div
      v-if="mounted"
      v-bind="containerAttrs"
      ref="container"
      :aria-describedby="d.ariaDescribedby"
      :aria-label="d.ariaLabel"
      :aria-labelledby="d.ariaLabelledby"
      aria-modal="true"
      :class="containerClass"
      :data-open="opened || undefined"
      role="dialog"
      @click="onClick"
      @pointerdown="onPointer"
      @pointermove="onPointer"
      @pointerup="onPointer"
    >
      <Backdrop v-if="d.backdrop" :class="backdropClass" />
      <div :ref="setWrapper" :class="wrapperClass" data-part="wrapper">
        <div
          :class="contentClass"
          :data-open="opened || undefined"
          data-part="content"
        >
          <slot name="beforeContent" />
          <div
            v-if="d.header"
            :class="cn(popupHeaderClasses, d.headerClassName)"
            data-part="header"
          >
            <div :class="popupHeaderLeftClasses" data-part="header-left">
              <slot name="headerLeft" />
            </div>
            <div
              v-if="$slots.headerRight || d.closeButton"
              :class="popupHeaderRightClasses"
              data-part="header-right"
            >
              <slot name="headerRight" />
              <Surface
                v-if="d.closeButton"
                :class="popupCloseWrapperClasses"
                :color="d.closeButtonColor"
                :content-class-name="popupCloseWrapperContentClasses"
                data-part="close-wrapper"
                :level="1"
                outline
                variant="gradient"
              >
                <Button
                  :content-class-name="popupCloseButtonContentClasses"
                  data-part="close"
                  :outline="false"
                  rounded
                  variant="transparent"
                  @click="onCloseButtonClick"
                >
                  <slot name="closeButtonContent"><CloseIcon /></slot>
                </Button>
              </Surface>
            </div>
          </div>
          <slot :close="close" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
