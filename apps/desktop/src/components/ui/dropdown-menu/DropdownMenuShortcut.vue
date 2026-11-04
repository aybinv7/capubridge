<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <span
    data-slot="dropdown-menu-shortcut"
    :class="cn('ml-auto pl-4 font-mono text-cladd-2xs text-cladd-fg-softer', props.class)"
  >
    <slot />
  </span>
</template>
