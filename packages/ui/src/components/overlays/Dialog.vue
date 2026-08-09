<script setup lang="ts">
import { computed, shallowRef, useAttrs, useId, useSlots } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useFocusTrap } from "../../composables/useFocusTrap.ts";
import { useOverlayDismiss } from "../../composables/useOverlayDismiss.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
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
  type DialogProps,
} from "./overlay.contracts.ts";
import { dialogRootContextKey, useOverlayRootContext } from "./overlayRootContext.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";

// Upstream keeps `className` (the dialog Surface) separate from `contentClassName` (the inner
// content column). Vue's `class` fallthrough would land on the trigger, so it is routed here.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogProps>(), {
  accent: undefined,
  backdropTransparent: undefined,
  contentClassName: undefined,
  cancelAccent: undefined,
  cancelText: undefined,
  closeOnBackdropClick: undefined,
  closeOnEscape: undefined,
  color: undefined,
  confirmAccent: undefined,
  confirmText: undefined,
  description: undefined,
  outline: undefined,
  requireConfirmText: undefined,
  root: undefined,
  surfaceLevel: undefined,
  title: undefined,
  variant: undefined,
});

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
const d = useComponentDefaults("Dialog", props, {
  backdropTransparent: false,
  cancelAccent: "neutral" as DialogProps["cancelAccent"],
  closeOnBackdropClick: true,
  closeOnEscape: true,
  surfaceLevel: 1,
  variant: "gradient" as DialogProps["variant"],
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
const titleId = `cui-dialog-title-${id}`;
const descriptionId = `cui-dialog-description-${id}`;
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const currentAccent = computed(
  () => d.value.confirmAccent ?? d.value.color ?? d.value.accent ?? ui.accentColor.value,
);
const currentOutline = computed(() => d.value.outline ?? ui.theme.value === "dark");
const confirmationValid = computed(
  () => !d.value.requireConfirmText || confirmationValue.value === d.value.requireConfirmText,
);
const containerClass = dialogContainerClasses;
const teleportTarget = computed(() => d.value.root ?? ui.overlaysRoot.value);

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
  const selector = d.value.requireConfirmText
    ? '[data-part="input"] input'
    : '[data-part="confirm"]';
  return container.value?.querySelector<HTMLElement>(selector);
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(dialogChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => d.value.closeOnEscape && !hasChildOverlay(),
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
  closeOnOutsideClick: () => d.value.closeOnBackdropClick,
  container,
  onClose: close,
  opened,
});
useFocusTrap({ active: opened, container, initialFocus });

const surfaceClass = computed(() =>
  cn(dialogSurfaceClasses, opened.value ? dialogOpenedClasses : dialogHiddenClasses, attrs.class),
);
const contentClass = computed(() => cn(dialogContentClasses, d.value.contentClassName));
const backdropClass = computed(() =>
  cn(
    overlayBackdropDurationClasses,
    d.value.backdropTransparent && overlayBackdropTransparentClasses,
    opened.value ? "opacity-100" : "opacity-0",
  ),
);

function onBackdropClick(): void {
  if (d.value.closeOnBackdropClick) close();
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
      :aria-describedby="d.description || $slots.description ? descriptionId : undefined"
      :aria-labelledby="d.title || $slots.title ? titleId : undefined"
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
      >
        <div
          v-if="d.title || $slots.title"
          :id="titleId"
          :class="dialogTitleClasses"
          data-part="title"
        >
          <slot name="title">{{ d.title }}</slot>
        </div>
        <div
          v-if="d.description || $slots.description"
          :id="descriptionId"
          :class="dialogTextClasses"
          data-part="text"
        >
          <slot name="description">{{ d.description }}</slot>
        </div>
        <slot :close="close" />
        <Input
          v-if="d.requireConfirmText && d.confirmText"
          v-model="confirmationValue"
          :accent="currentAccent"
          data-part="input"
          :info-message="`Type ${d.requireConfirmText} to confirm`"
          :placeholder="`Type ${d.requireConfirmText} to confirm`"
          size="lg"
        />
        <div
          v-if="$slots.actions || d.cancelText || d.confirmText"
          :class="dialogButtonsClasses"
          data-part="buttons"
        >
          <slot name="actions" :close="close">
            <Button
              v-if="d.cancelText"
              :accent="d.cancelAccent"
              :content-class-name="dialogButtonContentClasses"
              data-part="cancel"
              rounded
              size="lg"
              variant="transparent"
              @click="cancel"
            >
              {{ d.cancelText }}
            </Button>
            <Button
              v-if="d.confirmText"
              :accent="currentAccent"
              :content-class-name="dialogButtonContentClasses"
              data-part="confirm"
              :disabled="!confirmationValid"
              rounded
              size="lg"
              @click="confirm"
            >
              {{ d.confirmText }}
            </Button>
          </slot>
        </div>
      </Surface>
    </div>
  </Teleport>
</template>
