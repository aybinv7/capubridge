<script setup lang="ts">
import type { ContextMenuSubTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { ChevronRight } from "lucide-vue-next";
import { ContextMenuSubTrigger, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<
  ContextMenuSubTriggerProps & { class?: HTMLAttributes["class"]; inset?: boolean }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <ContextMenuSubTrigger
    data-slot="context-menu-sub-trigger"
    :data-inset="inset ? '' : undefined"
    v-bind="forwardedProps"
    :class="
      cn(
        'focus:bg-cladd-surface-hover focus:text-cladd-fg data-[state=open]:bg-cladd-surface-hover flex cursor-default items-center min-h-cladd-sm rounded-cladd-sm px-2 py-1 text-cladd-xs outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        props.class,
      )
    "
  >
    <slot />
    <ChevronRight class="ml-auto" />
  </ContextMenuSubTrigger>
</template>
