<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  shallowRef,
  useAttrs,
  useId,
  useSlots,
} from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useFocusTrap } from '../composables/useFocusTrap.ts';
import { useOverlayDismiss } from '../composables/useOverlayDismiss.ts';
import { useOverlayLifecycle } from '../composables/useOverlayLifecycle.ts';
import { useOverlayPhase } from '../composables/useOverlayPhase.ts';
import { provideSurfaceColorReset } from '../contexts/surfaceContext.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import Backdrop from './Backdrop.vue';
import Button from './Button.vue';
import Input from './Input.vue';
import {
  dialogButtonContentClasses,
  dialogButtonsClasses,
  dialogChildOverlaySelector,
  dialogInertHoldSelector,
  dialogContainerClasses,
  dialogContentClasses,
  dialogHiddenClasses,
  dialogOpenedClasses,
  dialogSurfaceClasses,
  dialogTextClasses,
  dialogTitleClasses,
  overlayBackdropDurationClasses,
  overlayBackdropTransparentClasses,
  overlayTriggerClasses,
  resolveOverlayElement,
  type DialogProps,
} from './overlay.contracts.ts';
import {
  dialogRootContextKey,
  useOverlayRootContext,
} from './overlayRootContext.ts';
import { cloneTriggerNode } from './overlayTrigger.ts';
import Surface from './Surface.vue';
import VNodeRenderer from './VNodeRenderer.ts';

// Upstream keeps `className` (the dialog Surface) separate from `contentClassName` (the inner
// content column). Vue's `class` fallthrough would land on the trigger, so it is routed here.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogProps>(), {
  backdropTransparent: undefined,
  'aria-label': undefined,
  'aria-labelledby': undefined,
  'aria-describedby': undefined,
  ariaLabel: undefined,
  ariaDescribedby: undefined,
  ariaLabelledby: undefined,
  buttons: undefined,
  contentClassName: undefined,
  cancelButtonColor: undefined,
  cancelButtonText: undefined,
  closeOnBackdropClick: undefined,
  closeOnEscape: undefined,
  inertContainer: undefined,
  lazy: undefined,
  stopPropagationOnClick: undefined,
  color: undefined,
  confirmButtonColor: undefined,
  confirmButtonText: undefined,
  text: undefined,
  outline: undefined,
  requireConfirmText: undefined,
  root: undefined,
  surfaceLevel: undefined,
  title: undefined,
  variant: undefined,
});

defineSlots<{
  actions?: (props: { close: () => void }) => unknown;
  buttons?: (props: { close: () => void }) => unknown;
  default?: (props: { close: () => void }) => unknown;
  text?: () => unknown;
  title?: () => unknown;
  trigger?: () => unknown;
}>();

const emit = defineEmits<{
  cancel: [];
  closed: [];
  closing: [];
  confirm: [];
  opened: [];
  opening: [];
}>();

const modelOpen = defineModel<boolean | undefined>('open', {
  default: undefined,
});
const slots = useSlots();
const attrs = useAttrs();
const containerAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const confirmationValue = shallowRef('');
const container = shallowRef<HTMLElement>();
const surface = shallowRef<HTMLElement>();
const ui = useUiContext();
const root = useOverlayRootContext(dialogRootContextKey);
const d = useComponentDefaults('Dialog', props, {
  backdropTransparent: false,
  cancelButtonColor: 'neutral' as NonNullable<DialogProps['cancelButtonColor']>,
  closeOnBackdropClick: true,
  closeOnEscape: true,
  inertContainer: '.app-container',
  lazy: false,
  stopPropagationOnClick: false,
  surfaceLevel: 1,
  variant: 'gradient' as NonNullable<DialogProps['variant']>,
});

// Own `open` wins, then the surrounding DialogRoot's state, then `false` — upstream's
// `open ?? ctx?.open ?? false`.
const model = computed<boolean>({
  get: () => modelOpen.value ?? root?.open.value ?? false,
  set: (value) => {
    if (modelOpen.value !== undefined || !root) modelOpen.value = value;
    else root.setOpen(value);
  },
});

const id = useId();
const titleId = `cladd-dialog-title-${id}`;
const descriptionId = `cladd-dialog-description-${id}`;
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== 'closed');
const currentAccent = computed(
  () => d.value.confirmButtonColor ?? d.value.color ?? ui.accentColor.value,
);
const currentOutline = computed(
  () => d.value.outline ?? ui.theme.value === 'dark',
);
const confirmationValid = computed(
  () =>
    !d.value.requireConfirmText ||
    confirmationValue.value === d.value.requireConfirmText,
);
const containerClass = dialogContainerClasses;
const teleportTarget = computed(() => {
  const root = d.value.root;
  if (root === false) return undefined;
  return (root as string | HTMLElement | undefined) ?? ui.overlaysRoot.value;
});
const isInline = computed(() => d.value.root === false);
const ariaLabelledby = computed(
  () =>
    d.value.ariaLabelledby ??
    d.value['aria-labelledby'] ??
    (d.value.title || slots.title ? titleId : undefined),
);
const ariaDescribedby = computed(
  () =>
    d.value.ariaDescribedby ??
    d.value['aria-describedby'] ??
    (d.value.text || slots.text ? descriptionId : undefined),
);
const ariaLabel = computed(() => d.value.ariaLabel ?? d.value['aria-label']);

function setSurface(value: unknown): void {
  surface.value = resolveOverlayElement(value);
}

function close(): void {
  model.value = false;
}

function open(): void {
  model.value = true;
}

function cancel(): void {
  emit('cancel');
  close();
}

function confirm(): void {
  if (!confirmationValid.value) return;
  emit('confirm');
  close();
}

function initialFocus(): HTMLElement | null | undefined {
  const selector = d.value.requireConfirmText
    ? '[data-part="input"] input'
    : '[data-part="confirm"]';
  return container.value?.querySelector<HTMLElement>(selector);
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(dialogChildOverlaySelector));
}

function inertTarget(): HTMLElement | null {
  return document.querySelector<HTMLElement>(d.value.inertContainer);
}

function setInert(next: boolean): void {
  const target = inertTarget();
  if (!target) return;
  // Only modals that inert the container themselves may keep it inert. Popovers
  // never set it, and counting them let one still mounted (closing, or stuck)
  // freeze the whole app after the dialog closed.
  if (!next) {
    const holders = [
      ...document.querySelectorAll(dialogInertHoldSelector),
    ].filter((element) => element !== container.value);
    if (holders.length > 0) return;
  }
  target.inert = next;
}

onBeforeUnmount(() => setInert(false));

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => d.value.closeOnEscape && !hasChildOverlay(),
  element: surface,
  lazy: () => d.value.lazy,
  onClose: () => {
    setInert(false);
    emit('closing');
  },
  onClosed: () => {
    confirmationValue.value = '';
    emit('closed');
  },
  onOpen: () => emit('opening'),
  onOpened: () => {
    setInert(true);
    emit('opened');
  },
  phase,
  setPhase,
});

useOverlayDismiss({
  closeOnOutsideClick: () => d.value.closeOnBackdropClick,
  container,
  onClose: close,
  opened,
});
useFocusTrap({ active: opened, container, initialFocus });

const surfaceClass = computed(() =>
  cn(
    dialogSurfaceClasses,
    opened.value ? dialogOpenedClasses : dialogHiddenClasses,
    attrs.class,
  ),
);
const contentClass = computed(() =>
  cn(dialogContentClasses, d.value.contentClassName),
);
const backdropClass = computed(() =>
  cn(
    overlayBackdropDurationClasses,
    d.value.backdropTransparent && overlayBackdropTransparentClasses,
    opened.value ? 'opacity-100' : 'opacity-0',
  ),
);

function onBackdropClick(event: MouseEvent): void {
  if (d.value.stopPropagationOnClick) event.stopPropagation();
  if (d.value.closeOnBackdropClick) close();
}

function onSurfaceClick(event: MouseEvent): void {
  if (d.value.stopPropagationOnClick) event.stopPropagation();
}

const triggerNode = computed(() =>
  cloneTriggerNode(slots.trigger?.(), { onClick: open }),
);

provideSurfaceColorReset();
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span v-else-if="slots.trigger" :class="overlayTriggerClasses" @click="open">
    <slot name="trigger" />
  </span>
  <Teleport v-if="!isInline" :to="teleportTarget">
    <div
      v-if="mounted"
      v-bind="containerAttrs"
      ref="container"
      :aria-describedby="ariaDescribedby"
      :aria-label="ariaLabel || undefined"
      :aria-labelledby="ariaLabelledby"
      aria-modal="true"
      :class="containerClass"
      role="dialog"
    >
      <Backdrop :class="backdropClass" @click="onBackdropClick" />
      <Surface
        :ref="setSurface"
        :class="surfaceClass"
        :content-class-name="contentClass"
        data-part="content"
        :data-open="opened || undefined"
        :level="d.surfaceLevel"
        :outline="currentOutline"
        :variant="d.variant"
        @click="onSurfaceClick"
      >
        <div
          v-if="d.title || $slots.title"
          :id="titleId"
          :class="dialogTitleClasses"
          data-part="title"
        >
          <slot name="title"><VNodeRenderer :node="d.title" /></slot>
        </div>
        <div
          v-if="d.text || $slots.text"
          :id="descriptionId"
          :class="dialogTextClasses"
          data-part="text"
        >
          <slot name="text"><VNodeRenderer :node="d.text" /></slot>
        </div>
        <slot :close="close" />
        <Input
          v-if="d.requireConfirmText && d.confirmButtonText"
          v-model="confirmationValue"
          :color="currentAccent"
          data-part="input"
          :info-message="`Type ${d.requireConfirmText} to confirm`"
          :placeholder="`Type ${d.requireConfirmText} to confirm`"
          size="lg"
        />
        <div
          v-if="
            $slots.buttons ||
            $slots.actions ||
            d.buttons ||
            d.cancelButtonText ||
            d.confirmButtonText
          "
          :class="dialogButtonsClasses"
          data-part="buttons"
        >
          <slot v-if="$slots.buttons" name="buttons" :close="close" />
          <slot v-else-if="$slots.actions" name="actions" :close="close">
            <template v-if="d.buttons">{{ d.buttons }}</template>
            <template v-else>
              <Button
                v-if="d.cancelButtonText"
                :color="d.cancelButtonColor"
                :content-class-name="dialogButtonContentClasses"
                data-part="cancel"
                rounded
                size="lg"
                variant="transparent"
                @click="cancel"
              >
                <VNodeRenderer :node="d.cancelButtonText" />
              </Button>
              <Button
                v-if="d.confirmButtonText"
                :color="confirmationValid ? currentAccent : undefined"
                :content-class-name="dialogButtonContentClasses"
                data-part="confirm"
                :disabled="!confirmationValid"
                rounded
                size="lg"
                @click="confirm"
              >
                <VNodeRenderer :node="d.confirmButtonText" />
              </Button>
            </template>
          </slot>
          <template v-else-if="d.buttons">{{ d.buttons }}</template>
          <template v-else>
            <Button
              v-if="d.cancelButtonText"
              :color="d.cancelButtonColor"
              :content-class-name="dialogButtonContentClasses"
              data-part="cancel"
              rounded
              size="lg"
              variant="transparent"
              @click="cancel"
            >
              <VNodeRenderer :node="d.cancelButtonText" />
            </Button>
            <Button
              v-if="d.confirmButtonText"
              :color="confirmationValid ? currentAccent : undefined"
              :content-class-name="dialogButtonContentClasses"
              data-part="confirm"
              :disabled="!confirmationValid"
              rounded
              size="lg"
              @click="confirm"
            >
              <VNodeRenderer :node="d.confirmButtonText" />
            </Button>
          </template>
        </div>
      </Surface>
    </div>
  </Teleport>
  <div
    v-if="isInline && mounted"
    v-bind="containerAttrs"
    ref="container"
    :aria-describedby="ariaDescribedby"
    :aria-label="ariaLabel || undefined"
    :aria-labelledby="ariaLabelledby"
    aria-modal="true"
    :class="containerClass"
    role="dialog"
  >
    <Backdrop :class="backdropClass" @click="onBackdropClick" />
    <Surface
      :ref="setSurface"
      :class="surfaceClass"
      :content-class-name="contentClass"
      data-part="content"
      :data-open="opened || undefined"
      :level="d.surfaceLevel"
      :outline="currentOutline"
      :variant="d.variant"
      @click="onSurfaceClick"
    >
      <div
        v-if="d.title || $slots.title"
        :id="titleId"
        :class="dialogTitleClasses"
        data-part="title"
      >
        <slot name="title"><VNodeRenderer :node="d.title" /></slot>
      </div>
      <div
        v-if="d.text || $slots.text"
        :id="descriptionId"
        :class="dialogTextClasses"
        data-part="text"
      >
        <slot name="text"><VNodeRenderer :node="d.text" /></slot>
      </div>
      <slot :close="close" />
      <Input
        v-if="d.requireConfirmText && d.confirmButtonText"
        v-model="confirmationValue"
        :color="currentAccent"
        data-part="input"
        :info-message="`Type ${d.requireConfirmText} to confirm`"
        :placeholder="`Type ${d.requireConfirmText} to confirm`"
        size="lg"
      />
      <div
        v-if="
          $slots.buttons ||
          $slots.actions ||
          d.buttons ||
          d.cancelButtonText ||
          d.confirmButtonText
        "
        :class="dialogButtonsClasses"
        data-part="buttons"
      >
        <slot v-if="$slots.buttons" name="buttons" :close="close" />
        <slot v-else-if="$slots.actions" name="actions" :close="close">
          <template v-if="d.buttons">{{ d.buttons }}</template>
          <template v-else>
            <Button
              v-if="d.cancelButtonText"
              :color="d.cancelButtonColor"
              :content-class-name="dialogButtonContentClasses"
              data-part="cancel"
              rounded
              size="lg"
              variant="transparent"
              @click="cancel"
            >
              <VNodeRenderer :node="d.cancelButtonText" />
            </Button>
            <Button
              v-if="d.confirmButtonText"
              :color="confirmationValid ? currentAccent : undefined"
              :content-class-name="dialogButtonContentClasses"
              data-part="confirm"
              :disabled="!confirmationValid"
              rounded
              size="lg"
              @click="confirm"
            >
              <VNodeRenderer :node="d.confirmButtonText" />
            </Button>
          </template>
        </slot>
        <template v-else-if="d.buttons">{{ d.buttons }}</template>
        <template v-else>
          <Button
            v-if="d.cancelButtonText"
            :color="d.cancelButtonColor"
            :content-class-name="dialogButtonContentClasses"
            data-part="cancel"
            rounded
            size="lg"
            variant="transparent"
            @click="cancel"
          >
            <VNodeRenderer :node="d.cancelButtonText" />
          </Button>
          <Button
            v-if="d.confirmButtonText"
            :color="confirmationValid ? currentAccent : undefined"
            :content-class-name="dialogButtonContentClasses"
            data-part="confirm"
            :disabled="!confirmationValid"
            rounded
            size="lg"
            @click="confirm"
          >
            <VNodeRenderer :node="d.confirmButtonText" />
          </Button>
        </template>
      </div>
    </Surface>
  </div>
</template>
