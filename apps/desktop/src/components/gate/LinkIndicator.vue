<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import type { LinkPresentation, LinkTone } from "@/lib/gates/link";

const props = defineProps<{
  link: LinkPresentation;
  prefix?: string;
  class?: HTMLAttributes["class"];
}>();

const TONE_TEXT: Record<LinkTone, string> = {
  live: "text-signal-live",
  waiting: "text-warning",
  warning: "text-warning",
  error: "text-error",
  muted: "text-muted-foreground",
};

const TONE_MARK: Record<LinkTone, string> = {
  live: "rounded-full bg-signal-live",
  waiting: "rounded-full ring-1 ring-inset ring-warning",
  warning: "rounded-none bg-warning",
  error: "rounded-none bg-error",
  muted: "rounded-full bg-[var(--fg-subtle)]",
};

const text = computed(() =>
  props.prefix ? `${props.prefix} ${props.link.label}` : props.link.label,
);
</script>

<template>
  <span
    :class="
      cn('flex shrink-0 items-center gap-1 font-mono text-2xs', TONE_TEXT[link.tone], props.class)
    "
    :title="link.description"
    :data-link="link.health"
  >
    <span class="size-1.5 shrink-0" :class="TONE_MARK[link.tone]" aria-hidden="true" />
    {{ text }}
  </span>
</template>
