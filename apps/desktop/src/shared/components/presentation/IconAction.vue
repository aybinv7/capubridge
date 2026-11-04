<script setup lang="ts">
import { computed } from "vue";
import { Button, Tooltip, type Color, type TooltipPosition } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";

/**
 * A quiet square icon button with a Cladd tooltip that names it. `label` is both the tooltip
 * text and the accessible name, so an icon never ships unexplained. `pressed` raises it like a
 * selected segment; `color` tints it only when the state means something (recording, error).
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    keys?: string;
    pressed?: boolean;
    toggle?: boolean;
    disabled?: boolean;
    loading?: boolean;
    color?: Color;
    size?: "sm" | "md";
    position?: TooltipPosition;
  }>(),
  {
    hint: undefined,
    keys: undefined,
    pressed: false,
    toggle: false,
    disabled: false,
    loading: false,
    color: undefined,
    size: "md",
    position: "bottom",
  },
);

const sizeClass = computed(() => (props.size === "sm" ? "size-6" : "size-7"));
const iconClass = computed(() => (props.size === "sm" ? "[&>svg]:size-3" : "[&>svg]:size-3.5"));
const toneClass = computed(() => {
  if (props.color) return "";
  if (props.pressed) return "text-foreground";
  return "text-[var(--fg-subtle)] hover:text-foreground";
});
</script>

<template>
  <Tooltip
    :position="position"
    :offset="6"
    content-class-name="flex max-w-60 items-center gap-2 px-2 py-1 text-xs"
  >
    <template #trigger>
      <Button
        v-bind="$attrs"
        :variant="pressed ? 'solid' : 'transparent'"
        :surface-level="pressed ? '+2' : undefined"
        :outline="pressed"
        :color="color"
        :disabled="disabled"
        :loading="loading"
        :aria-label="label"
        :aria-pressed="toggle ? pressed : undefined"
        square
        :class="[sizeClass, toneClass]"
        :content-class-name="iconClass"
      >
        <slot />
      </Button>
    </template>
    <span class="flex flex-col gap-0.5">
      <span class="text-foreground">{{ label }}</span>
      <span v-if="hint" class="font-normal text-muted-foreground">{{ hint }}</span>
    </span>
    <KeyCaps v-if="keys" :keys="keys" />
  </Tooltip>
</template>
