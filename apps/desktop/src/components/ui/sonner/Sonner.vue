<script lang="ts" setup>
import type { ToasterProps } from "vue-sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-vue-next";
import { Toaster as Sonner } from "vue-sonner";
import { useToastCopy } from "@/composables/useToastCopy";
import { cn } from "@/lib/utils";

const props = defineProps<ToasterProps>();

useToastCopy();
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    }"
    v-bind="props"
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>

<style>
[data-sonner-toast] {
  position: relative;
}

[data-sonner-toast] .cui-toast-copy {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  background: var(--popover);
  color: var(--popover-foreground);
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease;
}

[data-sonner-toast]:hover .cui-toast-copy,
[data-sonner-toast] .cui-toast-copy:focus-visible {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  [data-sonner-toast] .cui-toast-copy {
    transition: none;
  }
}
</style>
