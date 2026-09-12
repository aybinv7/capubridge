<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui";
import { computed, type HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<
    TooltipContentProps & {
      class?: HTMLAttributes["class"];
      /** `inverted` is the compact one-liner; `surface` suits rich or interactive content. */
      variant?: "inverted" | "surface";
    }
  >(),
  {
    sideOffset: 4,
    variant: "inverted",
  },
);

const emits = defineEmits<TooltipContentEmits>();

const delegatedProps = reactiveOmit(props, "class", "variant");
const forwarded = useForwardPropsEmits(delegatedProps, emits);

const surfaceClass = computed(() =>
  props.variant === "surface"
    ? "bg-popover text-popover-foreground border shadow-md"
    : "bg-foreground text-background",
);

const arrowClass = computed(() =>
  props.variant === "surface" ? "bg-popover fill-popover" : "bg-foreground fill-foreground",
);
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance',
          surfaceClass,
          props.class,
        )
      "
    >
      <slot />

      <TooltipArrow
        :class="
          cn('z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]', arrowClass)
        "
      />
    </TooltipContent>
  </TooltipPortal>
</template>
