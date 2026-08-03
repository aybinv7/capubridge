<script setup lang="ts">
import { computed, shallowRef, useId, useSlots } from "vue";

import { useFocusTrap } from "../../composables/useFocusTrap.ts";
import { useOverlayDismiss } from "../../composables/useOverlayDismiss.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import Button from "../actions/Button.vue";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import Input from "../forms/Input.vue";
import Surface from "../surface/Surface.vue";
import { dialogChildOverlaySelector } from "./overlay.contracts.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    backdropTransparent?: boolean;
    cancelAccent?: UiAccent;
    cancelText?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
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
    cancelAccent: "neutral",
    cancelText: undefined,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    confirmAccent: undefined,
    confirmText: undefined,
    description: undefined,
    outline: undefined,
    requireConfirmText: undefined,
    root: "body",
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

const model = defineModel<boolean>({ default: false });
const slots = useSlots();
const confirmationValue = shallowRef("");
const container = shallowRef<HTMLElement>();
const layer = shallowRef<HTMLElement>();
const ui = useUiContext();
const parentSurface = useSurface();
const id = useId();
const titleId = `cui-dialog-title-${id}`;
const descriptionId = `cui-dialog-description-${id}`;
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const currentAccent = computed(() => props.confirmAccent ?? props.accent ?? ui.accent.value);
const currentOutline = computed(() => props.outline ?? ui.theme.value === "dark");
const confirmationValid = computed(
  () => !props.requireConfirmText || confirmationValue.value === props.requireConfirmText,
);

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
  const selector = props.requireConfirmText ? ".cui-dialog__confirmation" : '[data-part="confirm"]';
  return container.value?.querySelector<HTMLElement>(selector);
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(dialogChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => props.closeOnEscape && !hasChildOverlay(),
  element: layer,
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
useFocusTrap({ container, initialFocus, open: model });

const triggerNode = computed(() => cloneTriggerNode(slots.trigger?.(), { onClick: open }));

provideSurfaceContext(
  () => parentSurface.level.value,
  () => undefined,
);
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span v-else-if="slots.trigger" class="cui-overlay-trigger" @click="open">
    <slot name="trigger" />
  </span>
  <Teleport :to="props.root">
    <div
      v-if="mounted"
      ref="layer"
      class="cui-dialog__layer cui-theme"
      :data-cui-opened="opened || undefined"
      data-cui-overlay="dialog"
      :data-cui-theme="ui.theme.value"
    >
      <div
        class="cui-dialog__backdrop"
        :data-transparent="props.backdropTransparent || undefined"
      />
      <div
        ref="container"
        :aria-describedby="props.description || $slots.description ? descriptionId : undefined"
        :aria-labelledby="props.title || $slots.title ? titleId : undefined"
        aria-modal="true"
        class="cui-dialog cui-dialog__container"
        role="dialog"
        tabindex="-1"
      >
        <Surface
          class="cui-dialog__content"
          :level="props.surfaceLevel"
          :outline="currentOutline"
          :variant="props.variant"
        >
          <div v-if="props.title || $slots.title" :id="titleId" class="cui-dialog__title">
            <slot name="title">{{ props.title }}</slot>
          </div>
          <div
            v-if="props.description || $slots.description"
            :id="descriptionId"
            class="cui-dialog__description"
          >
            <slot name="description">{{ props.description }}</slot>
          </div>
          <div class="cui-dialog__body">
            <slot :close="close" />
          </div>
          <Input
            v-if="props.requireConfirmText && props.confirmText"
            v-model="confirmationValue"
            :accent="currentAccent"
            class="cui-dialog__confirmation"
            :info-message="`Type ${props.requireConfirmText} to confirm`"
            :placeholder="`Type ${props.requireConfirmText} to confirm`"
          />
          <div
            v-if="$slots.actions || props.cancelText || props.confirmText"
            class="cui-dialog__actions"
          >
            <slot name="actions" :close="close">
              <Button
                v-if="props.cancelText"
                :accent="props.cancelAccent"
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
    </div>
  </Teleport>
</template>
