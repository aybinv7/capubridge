<script setup lang="ts">
import { computed, shallowRef, useAttrs, useId, useSlots } from "vue";

import { useFocusTrap } from "../../composables/useFocusTrap.ts";
import { useOverlayDismiss } from "../../composables/useOverlayDismiss.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import Button from "../actions/Button.vue";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import Input from "../forms/Input.vue";
import Surface from "../surface/Surface.vue";
import Backdrop from "./Backdrop.vue";
import {
  dialogButtonContentClasses,
  dialogButtonsClasses,
  dialogChildOverlaySelector,
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
} from "./overlay.contracts.ts";
import { dialogRootContextKey, useOverlayRootContext } from "./overlayRootContext.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";

// Upstream keeps `className` (the dialog Surface) separate from `contentClassName` (the inner
// content column). Vue's `class` fallthrough would land on the trigger, so it is routed here.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    backdropTransparent?: boolean;
    contentClassName?: string;
    cancelAccent?: UiAccent;
    cancelText?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    color?: UiAccent;
    confirmAccent?: UiAccent;
    confirmText?: string;
    description?: string;
    outline?: boolean;
    requireConfirmText?: string;
    root?: string | HTMLElement;
    surfaceLevel?: SurfaceLevelInput;
    title?: string;
    variant?: SurfaceVariant;
  }>(),
  {
    accent: undefined,
    backdropTransparent: false,
    contentClassName: undefined,
    cancelAccent: "neutral",
    cancelText: undefined,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    color: undefined,
    confirmAccent: undefined,
    confirmText: undefined,
    description: undefined,
    outline: undefined,
    requireConfirmText: undefined,
    root: undefined,
    surfaceLevel: 1,
    title: undefined,
    variant: "gradient",
  },
);

defineSlots<{
  actions?: (props: { close: () => void }) => unknown;
  default?: (props: { close: () => void }) => unknown;
  description?: () => unknown;
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

const modelOpen = defineModel<boolean>("open", { default: undefined });
const slots = useSlots();
const attrs = useAttrs();
const containerAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const confirmationValue = shallowRef("");
const container = shallowRef<HTMLElement>();
const surface = shallowRef<HTMLElement>();
const ui = useUiContext();
const root = useOverlayRootContext(dialogRootContextKey);

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
const titleId = `cui-dialog-title-${id}`;
const descriptionId = `cui-dialog-description-${id}`;
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const currentAccent = computed(
  () => props.confirmAccent ?? props.color ?? props.accent ?? ui.accentColor.value,
);
const currentOutline = computed(() => props.outline ?? ui.theme.value === "dark");
const confirmationValid = computed(
  () => !props.requireConfirmText || confirmationValue.value === props.requireConfirmText,
);
const containerClass = dialogContainerClasses;
const teleportTarget = computed(() => props.root ?? ui.overlaysRoot.value);

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
  emit("cancel");
  close();
}

function confirm(): void {
  if (!confirmationValid.value) return;
  emit("confirm");
  close();
}

function initialFocus(): HTMLElement | null | undefined {
  const selector = props.requireConfirmText ? '[data-part="input"] input' : '[data-part="confirm"]';
  return container.value?.querySelector<HTMLElement>(selector);
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(dialogChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => props.closeOnEscape && !hasChildOverlay(),
  element: surface,
  onClose: () => emit("closing"),
  onClosed: () => {
    confirmationValue.value = "";
    emit("closed");
  },
  onOpen: () => emit("opening"),
  onOpened: () => emit("opened"),
  phase,
  setPhase,
});

useOverlayDismiss({
  closeOnOutsideClick: () => props.closeOnBackdropClick,
  container,
  onClose: close,
  opened,
});
useFocusTrap({ active: opened, container, initialFocus });

const surfaceClass = computed(() =>
  cn(dialogSurfaceClasses, opened.value ? dialogOpenedClasses : dialogHiddenClasses, attrs.class),
);
const contentClass = computed(() => cn(dialogContentClasses, props.contentClassName));
const backdropClass = computed(() =>
  cn(
    overlayBackdropDurationClasses,
    props.backdropTransparent && overlayBackdropTransparentClasses,
    opened.value ? "opacity-100" : "opacity-0",
  ),
);

function onBackdropClick(): void {
  if (props.closeOnBackdropClick) close();
}

const triggerNode = computed(() => cloneTriggerNode(slots.trigger?.(), { onClick: open }));

provideSurfaceColorReset();
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
      :aria-describedby="props.description || $slots.description ? descriptionId : undefined"
      :aria-labelledby="props.title || $slots.title ? titleId : undefined"
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
        :data-cui-opened="opened || undefined"
        :level="props.surfaceLevel"
        :outline="currentOutline"
        :variant="props.variant"
      >
        <div
          v-if="props.title || $slots.title"
          :id="titleId"
          :class="dialogTitleClasses"
          data-part="title"
        >
          <slot name="title">{{ props.title }}</slot>
        </div>
        <div
          v-if="props.description || $slots.description"
          :id="descriptionId"
          :class="dialogTextClasses"
          data-part="text"
        >
          <slot name="description">{{ props.description }}</slot>
        </div>
        <slot :close="close" />
        <Input
          v-if="props.requireConfirmText && props.confirmText"
          v-model="confirmationValue"
          :accent="currentAccent"
          data-part="input"
          :info-message="`Type ${props.requireConfirmText} to confirm`"
          :placeholder="`Type ${props.requireConfirmText} to confirm`"
          size="lg"
        />
        <div
          v-if="$slots.actions || props.cancelText || props.confirmText"
          :class="dialogButtonsClasses"
          data-part="buttons"
        >
          <slot name="actions" :close="close">
            <Button
              v-if="props.cancelText"
              :accent="props.cancelAccent"
              :content-class-name="dialogButtonContentClasses"
              data-part="cancel"
              rounded
              size="lg"
              variant="transparent"
              @click="cancel"
            >
              {{ props.cancelText }}
            </Button>
            <Button
              v-if="props.confirmText"
              :accent="currentAccent"
              :content-class-name="dialogButtonContentClasses"
              data-part="confirm"
              :disabled="!confirmationValid"
              rounded
              size="lg"
              @click="confirm"
            >
              {{ props.confirmText }}
            </Button>
          </slot>
        </div>
      </Surface>
    </div>
  </Teleport>
</template>
