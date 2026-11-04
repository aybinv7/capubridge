<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import type { LinkPresentation } from "@/lib/gates/link";
import { LINK_TONE_MARK, LINK_TONE_TEXT } from "./linkTone";

const props = defineProps<{
  link: LinkPresentation;
  prefix?: string;
  class?: HTMLAttributes["class"];
}>();

const text = computed(() =>
  props.prefix ? `${props.prefix} ${props.link.label}` : props.link.label,
);
</script>

<template>
  <span
    :class="
      cn(
        'flex shrink-0 items-center gap-1 font-mono text-2xs',
        LINK_TONE_TEXT[link.tone],
        props.class,
      )
    "
    :title="link.description"
    :data-link="link.health"
  >
    <span class="size-1.5 shrink-0" :class="LINK_TONE_MARK[link.tone]" aria-hidden="true" />
    {{ text }}
  </span>
</template>
