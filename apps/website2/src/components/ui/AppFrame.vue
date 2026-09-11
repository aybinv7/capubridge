<script setup lang="ts">
import { computed } from "vue";
import { captures } from "@/data/screenshots";

const props = withDefaults(
  defineProps<{
    capture: string;
    ratio?: string;
    crop?: boolean;
    priority?: boolean;
    /** False inside a flush grid that supplies its own dividers. */
    bordered?: boolean;
    showCaption?: boolean;
    /** Sets view-transition-name on the frame for a shared-element morph. */
    viewTransitionName?: string;
    /** Size from the available height instead of the available width, so the
     *  whole frame stays inside a height-bounded stage. */
    fill?: boolean;
  }>(),
  {
    ratio: "16 / 10",
    crop: true,
    priority: false,
    bordered: true,
    showCaption: true,
    fill: false,
  },
);

const shot = computed(() => captures[props.capture]);
const isPending = computed(() => shot.value?.status !== "clean");
const frameStyle = computed(() => ({
  aspectRatio: props.ratio,
  viewTransitionName: props.viewTransitionName,
  // Fill the stage without ever exceeding it: take the full width, derive the
  // height from the ratio, and let max-height cap it on short viewports.
  // Height-driven sizing overflows whenever the stage is wider than it is
  // tall, which is the usual case here.
  ...(props.fill ? { width: "100%", height: "auto", maxHeight: "100%" } : {}),
}));
</script>

<template>
  <figure v-if="shot" class="m-0" :class="fill ? 'flex w-full min-w-0 items-center' : ''">
    <div
      class="relative overflow-hidden bg-[var(--surface-1)]"
      :class="bordered ? 'rounded-lg border border-[var(--rule-strong)]' : ''"
      :style="frameStyle"
    >
      <div
        class="flex h-7 items-center gap-1.5 border-b border-[var(--rule)] bg-[var(--surface-2)] px-3"
      >
        <span class="h-2 w-2 rounded-full bg-white/15" />
        <span class="h-2 w-2 rounded-full bg-white/10" />
        <span class="h-2 w-2 rounded-full bg-white/10" />
        <span class="ml-2 font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">
          capubridge
        </span>
      </div>

      <img
        v-if="!isPending"
        :src="shot.src"
        :alt="shot.alt"
        class="h-[calc(100%-1.75rem)] w-full"
        :class="crop ? 'object-cover' : 'object-contain'"
        :style="{ objectPosition: shot.focal }"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
      />

      <div
        v-else
        class="flex h-[calc(100%-1.75rem)] flex-col items-center justify-center gap-3 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] px-6 text-center"
      >
        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
          Capture pending
        </p>
        <p class="max-w-[34ch] text-[12px] leading-5 text-[var(--ink-3)]">
          {{ shot.blocker }} — needs a recapture against the demo app before this ships.
        </p>
      </div>
    </div>

    <figcaption
      v-if="showCaption && ($slots.caption || shot.caption)"
      class="mt-3 flex gap-3 text-[12px] leading-5 text-[var(--ink-3)]"
    >
      <span class="mt-[7px] h-px w-6 shrink-0 bg-[var(--rule-strong)]" aria-hidden="true" />
      <slot name="caption">{{ shot.caption }}</slot>
    </figcaption>
  </figure>
</template>
