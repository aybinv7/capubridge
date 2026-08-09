<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useAttrs, type Component } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import Button from "../actions/Button.vue";
import { resolveOverlayElement } from "../overlays/overlay.contracts.ts";
import { toastRootContextKey, useOverlayRootContext } from "../overlays/overlayRootContext.ts";
import Surface from "../surface/Surface.vue";
import CloseIcon from "./CloseIcon.vue";
import {
  toastCloseWrapperClasses,
  toastClosingClasses,
  toastContentCloseButtonClasses,
  toastContentClasses,
  toastContentNoCloseButtonClasses,
  toastContentWithBothClasses,
  toastContentWithOneClasses,
  toastCopyClasses,
  toastDefaultTimeout,
  toastHiddenClasses,
  toastIconClasses,
  toastOpenedClasses,
  toastSurfaceClasses,
  toastTextClasses,
  toastTitleClasses,
} from "./toast.contracts.ts";
import type { ToastProps } from "./feedback.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastProps>(), {
  closeButton: undefined,
  color: undefined,
  icon: undefined,
  iconProps: undefined,
  outline: undefined,
  root: undefined,
  stopPropagationOnClick: undefined,
  surfaceLevel: undefined,
  text: undefined,
  timeout: undefined,
  title: undefined,
  variant: undefined,
});

const d = useComponentDefaults("Toast", props, {
  closeButton: true,
  color: "neutral" as UiAccent,
  outline: true,
  stopPropagationOnClick: false,
  timeout: toastDefaultTimeout,
  variant: "gradient" as SurfaceVariant,
});

defineSlots<{
  default?: () => unknown;
  text?: () => unknown;
  title?: () => unknown;
}>();

const emit = defineEmits<{
  closed: [];
}>();

const modelOpen = defineModel<boolean>("open", { default: undefined });
const attrs = useAttrs();
const ui = useUiContext();
const root = useOverlayRootContext(toastRootContextKey);
const surface = shallowRef<HTMLElement>();
let timeoutId: number | undefined;

const model = computed<boolean>({
  get: () => modelOpen.value ?? root?.open.value ?? false,
  set: (value) => {
    if (modelOpen.value !== undefined || !root) modelOpen.value = value;
    else root.setOpen(value);
  },
});

const { phase, setPhase } = useOverlayPhase(model);
const mounted = computed(() => phase.value !== "closed");
const currentSurfaceLevel = computed(
  () => d.value.surfaceLevel ?? (ui.theme.value === "dark" ? 3 : 1),
);
const teleportTarget = computed(() => d.value.root ?? ui.overlaysRoot.value);

function setSurface(value: unknown): void {
  surface.value = resolveOverlayElement(value);
}

function close(): void {
  model.value = false;
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => false,
  element: surface,
  onClosed: () => emit("closed"),
  phase,
  setPhase,
});

const surfaceClass = computed(() =>
  cn(
    toastSurfaceClasses,
    !opened.value && toastHiddenClasses,
    opened.value && toastOpenedClasses,
    phase.value === "closing" && toastClosingClasses,
    attrs.class,
  ),
);
const contentClass = computed(() =>
  cn(
    toastContentClasses,
    d.value.title && d.value.text ? toastContentWithBothClasses : toastContentWithOneClasses,
    d.value.closeButton ? toastContentCloseButtonClasses : toastContentNoCloseButtonClasses,
  ),
);
const surfaceAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

function onClick(event: MouseEvent): void {
  if (d.value.stopPropagationOnClick) event.stopPropagation();
}

onMounted(() => {
  if (d.value.timeout && d.value.timeout > 0) {
    timeoutId = window.setTimeout(close, d.value.timeout);
  }
});

onUnmounted(() => {
  if (timeoutId !== undefined) window.clearTimeout(timeoutId);
});

provideSurfaceColorReset();
</script>

<template>
  <Teleport :to="teleportTarget">
    <Surface
      v-if="mounted"
      v-bind="surfaceAttrs"
      :ref="setSurface"
      :class="surfaceClass"
      :color="d.color"
      :content-class-name="contentClass"
      :data-open="opened || undefined"
      :level="currentSurfaceLevel"
      :outline="d.outline"
      :variant="d.variant"
      @click="onClick"
    >
      <div v-if="d.icon" :class="toastIconClasses" data-part="icon">
        <component :is="d.icon" v-bind="d.iconProps" />
      </div>
      <div
        v-if="d.title || d.text || $slots.title || $slots.text"
        :class="toastCopyClasses"
        data-part="content"
      >
        <div v-if="d.title || $slots.title" :class="toastTitleClasses" data-part="title">
          <slot name="title">{{ d.title }}</slot>
        </div>
        <div v-if="d.text || $slots.text" :class="toastTextClasses" data-part="text">
          <slot name="text">{{ d.text }}</slot>
        </div>
      </div>

      <slot />

      <div v-if="d.closeButton" :class="toastCloseWrapperClasses">
        <Button data-part="close" :outline="false" rounded variant="transparent" @click="close">
          <CloseIcon />
        </Button>
      </div>
    </Surface>
  </Teleport>
</template>
